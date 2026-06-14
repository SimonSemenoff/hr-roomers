from __future__ import annotations
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import asyncio
import json
import os
from pathlib import Path
from dotenv import load_dotenv

from hh_agent import search_hh, connect_hh
from analyzer import analyze_candidate

load_dotenv()

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_FILE = Path(__file__).parent / "data.json"
HH_SESSION = Path(__file__).parent / "hh_session.json"
TG_SESSION = Path(__file__).parent / "tg_session.json"


def load_data() -> dict:
    if DATA_FILE.exists():
        return json.loads(DATA_FILE.read_text())
    return {"vacancies": {}, "candidates": {}}


def save_data(data: dict):
    DATA_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2))


class VacancyBody(BaseModel):
    id: str
    title: str
    keywords: str
    candidate_profile: Optional[str] = None
    salary_from: Optional[int] = None
    notes: Optional[str] = None
    sources: list[str] = ["hh"]
    candidate_count: int = 0


class VacancyUpdate(BaseModel):
    title: str
    keywords: str
    candidate_profile: Optional[str] = None
    salary_from: Optional[int] = None
    notes: Optional[str] = None
    sources: list[str] = ["hh"]


class SearchRequest(BaseModel):
    search_id: str
    title: str
    keywords: str
    candidate_profile: Optional[str] = None
    salary_from: Optional[int] = None
    notes: Optional[str] = None
    sources: list[str] = ["hh"]


# ── Health ─────────────────────────────────────────────────
@app.get("/api/health")
def health_check():
    return {"status": "ok"}


# ── Vacancies ──────────────────────────────────────────────
@app.get("/api/vacancies")
def list_vacancies():
    data = load_data()
    return list(data["vacancies"].values())


@app.post("/api/vacancies")
def create_vacancy(body: VacancyBody):
    data = load_data()
    data["vacancies"][body.id] = body.dict()
    data["vacancies"][body.id]["status"] = "idle"
    save_data(data)
    return data["vacancies"][body.id]


@app.put("/api/vacancies/{vacancy_id}")
def update_vacancy(vacancy_id: str, body: VacancyUpdate):
    data = load_data()
    if vacancy_id in data["vacancies"]:
        data["vacancies"][vacancy_id].update(body.dict())
    save_data(data)
    return data["vacancies"].get(vacancy_id)


@app.delete("/api/vacancies/{vacancy_id}")
def delete_vacancy(vacancy_id: str):
    data = load_data()
    data["vacancies"].pop(vacancy_id, None)
    data["candidates"].pop(vacancy_id, None)
    save_data(data)
    return {"ok": True}


# ── Search ─────────────────────────────────────────────────
@app.post("/api/search")
async def run_search(req: SearchRequest, background_tasks: BackgroundTasks):
    data = load_data()
    if req.search_id in data["vacancies"]:
        data["vacancies"][req.search_id]["status"] = "running"
        save_data(data)
    background_tasks.add_task(do_search, req)
    return {"status": "started"}


@app.get("/api/search/{search_id}/candidates")
def get_candidates(search_id: str):
    data = load_data()
    return {
        "search": data["vacancies"].get(search_id),
        "candidates": data["candidates"].get(search_id, []),
    }


@app.get("/api/searches")
def list_searches():
    data = load_data()
    return list(data["vacancies"].values())


@app.patch("/api/candidate/{search_id}/{candidate_id}")
def update_candidate(search_id: str, candidate_id: str, body: dict):
    data = load_data()
    for c in data["candidates"].get(search_id, []):
        if c["id"] == candidate_id:
            c["status"] = body.get("status", c["status"])
            break
    save_data(data)
    return {"ok": True}


# ── Sources ────────────────────────────────────────────────
@app.get("/api/sources")
def list_sources():
    return [
        {
            "id": "hh",
            "name": "HH.ru",
            "connected": HH_SESSION.exists(),
            "account": "hh.ru" if HH_SESSION.exists() else None,
        },
        {
            "id": "telegram",
            "name": "Telegram",
            "connected": TG_SESSION.exists(),
        },
    ]


@app.post("/api/sources/hh/connect")
async def connect_hh_account():
    success = await connect_hh()
    return {"status": "ok" if success else "error"}


@app.post("/api/sources/telegram/send_code")
async def tg_send_code(body: dict):
    try:
        from tg_agent import send_code
        await send_code(body["phone"])
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.post("/api/sources/telegram/verify")
async def tg_verify(body: dict):
    try:
        from tg_agent import verify_code
        await verify_code(body["phone"], body["code"])
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ── Background search ─────────────────────────────────────
async def do_search(req: SearchRequest):
    data = load_data()
    seen_ids = {c["id"] for c in data["candidates"].get(req.search_id, [])}

    try:
        raw_candidates = []
        if "hh" in req.sources:
            raw_candidates += await search_hh(req)

        for raw in raw_candidates:
            if raw["id"] in seen_ids:
                continue
            seen_ids.add(raw["id"])
            analysis = await analyze_candidate(raw, req)
            if analysis["score"] >= 6:
                candidate = {
                    "id": raw["id"],
                    "name": raw.get("name", ""),
                    "age": raw.get("age"),
                    "city": raw.get("city", ""),
                    "title": raw.get("title", ""),
                    "salary": raw.get("salary", ""),
                    "url": raw.get("url", ""),
                    "photo": raw.get("photo", ""),
                    "summary": analysis["summary"],
                    "score": analysis["score"],
                    "why_fits": analysis["why_fits"],
                    "red_flags": analysis.get("red_flags", ""),
                    "status": "new",
                    "source": "hh",
                }
                data = load_data()
                if req.search_id not in data["candidates"]:
                    data["candidates"][req.search_id] = []
                data["candidates"][req.search_id].append(candidate)
                data["vacancies"][req.search_id]["candidate_count"] = len(data["candidates"][req.search_id])
                save_data(data)

        data = load_data()
        if req.search_id in data["vacancies"]:
            data["vacancies"][req.search_id]["status"] = "done"
            save_data(data)

    except Exception as e:
        data = load_data()
        if req.search_id in data["vacancies"]:
            data["vacancies"][req.search_id]["status"] = "idle"
            save_data(data)
        print(f"Search error: {e}")
