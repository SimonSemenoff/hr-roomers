from __future__ import annotations
from fastapi import FastAPI, BackgroundTasks, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
import asyncio
import json
import os
import uuid
from pathlib import Path
from dotenv import load_dotenv

from hh_agent import search_hh, connect_hh, fetch_employer_vacancies, fetch_vacancy_responses, fetch_favorites_folder
from analyzer import analyze_candidate
from file_extract import extract_text

load_dotenv()

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://hr-roomers-production.up.railway.app",
    ],
    allow_origin_regex=r"https://.*\.up\.railway\.app",
    allow_methods=["*"],
    allow_headers=["*"],
)

# DATA_DIR points at a persistent volume in production (set DATA_DIR=/data on
# Railway and mount a volume there). Falls back to the agent/ folder for local
# development, where the filesystem is already persistent.
DATA_DIR = Path(os.getenv("DATA_DIR", str(Path(__file__).parent)))
DATA_DIR.mkdir(parents=True, exist_ok=True)

DATA_FILE = DATA_DIR / "data.json"
HH_SESSION = DATA_DIR / "hh_session.json"
TG_SESSION = DATA_DIR / "tg_session.json"
UPLOADS_DIR = DATA_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

# On startup, restore HH.ru session from env var if provided (for headless
# deployments where the browser-based connect flow can't run).
if not HH_SESSION.exists() and os.getenv("HH_SESSION_B64"):
    import base64
    try:
        HH_SESSION.write_bytes(base64.b64decode(os.getenv("HH_SESSION_B64")))
        print("Restored hh_session.json from HH_SESSION_B64 env var")
    except Exception as e:
        print(f"Failed to restore HH session from env var: {e}")


def load_data() -> dict:
    if DATA_FILE.exists():
        data = json.loads(DATA_FILE.read_text())
    else:
        data = {"vacancies": {}, "candidates": {}}
    data.setdefault("vacancies", {})
    data.setdefault("candidates", {})
    data.setdefault("company_profile", {"description": "", "links": [], "files": []})
    return data


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
    hh_vacancy_id: Optional[str] = None
    hh_url: Optional[str] = None


class VacancyUpdate(BaseModel):
    title: str
    keywords: str
    candidate_profile: Optional[str] = None
    salary_from: Optional[int] = None
    notes: Optional[str] = None
    sources: list[str] = ["hh"]
    hh_vacancy_id: Optional[str] = None
    hh_url: Optional[str] = None


class ImportVacanciesBody(BaseModel):
    vacancies: list[dict]


class CompanyProfileBody(BaseModel):
    description: str = ""
    links: list[str] = []


class SearchRequest(BaseModel):
    search_id: str
    title: str
    keywords: str
    candidate_profile: Optional[str] = None
    salary_from: Optional[int] = None
    notes: Optional[str] = None
    sources: list[str] = ["hh"]
    hh_vacancy_id: Optional[str] = None


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


# ── Company profile ("идеальный портрет кандидата Roomers") ──
@app.get("/api/company-profile")
def get_company_profile():
    data = load_data()
    return data["company_profile"]


@app.put("/api/company-profile")
def update_company_profile(body: CompanyProfileBody):
    data = load_data()
    data["company_profile"]["description"] = body.description
    data["company_profile"]["links"] = body.links
    save_data(data)
    return data["company_profile"]


@app.post("/api/company-profile/files")
async def upload_company_profile_file(file: UploadFile = File(...)):
    file_id = uuid.uuid4().hex
    suffix = Path(file.filename or "").suffix
    stored_name = f"{file_id}{suffix}"
    dest = UPLOADS_DIR / stored_name
    content = await file.read()
    dest.write_bytes(content)

    data = load_data()
    entry = {"id": file_id, "name": file.filename, "stored_name": stored_name}
    data["company_profile"]["files"].append(entry)
    save_data(data)
    return entry


@app.get("/api/company-profile/files/{file_id}")
def download_company_profile_file(file_id: str):
    data = load_data()
    entry = next((f for f in data["company_profile"]["files"] if f["id"] == file_id), None)
    if not entry:
        raise HTTPException(status_code=404, detail="Файл не найден")
    path = UPLOADS_DIR / entry["stored_name"]
    if not path.exists():
        raise HTTPException(status_code=404, detail="Файл не найден")
    return FileResponse(path, filename=entry["name"])


@app.delete("/api/company-profile/files/{file_id}")
def delete_company_profile_file(file_id: str):
    data = load_data()
    entry = next((f for f in data["company_profile"]["files"] if f["id"] == file_id), None)
    if entry:
        path = UPLOADS_DIR / entry["stored_name"]
        if path.exists():
            path.unlink()
        data["company_profile"]["files"] = [
            f for f in data["company_profile"]["files"] if f["id"] != file_id
        ]
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
            if "feedback" in body:
                c["feedback"] = body.get("feedback")
            if "feedback_comment" in body:
                c["feedback_comment"] = body.get("feedback_comment")
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


@app.get("/api/sources/hh/vacancies")
async def get_hh_vacancies():
    """List the employer's active vacancies on HH.ru, for import."""
    if not HH_SESSION.exists():
        return {"status": "error", "message": "HH.ru не подключён", "vacancies": []}
    try:
        vacancies = await fetch_employer_vacancies()
        # Mark which ones are already imported
        data = load_data()
        existing_hh_ids = {
            v.get("hh_vacancy_id") for v in data["vacancies"].values() if v.get("hh_vacancy_id")
        }
        for v in vacancies:
            v["imported"] = v["hh_id"] in existing_hh_ids
        return {"status": "ok", "vacancies": vacancies}
    except Exception as e:
        return {"status": "error", "message": str(e), "vacancies": []}


@app.post("/api/vacancies/import_hh")
def import_hh_vacancies(body: ImportVacanciesBody):
    """Create local vacancy entries from selected HH.ru vacancies."""
    data = load_data()
    created = []
    for v in body.vacancies:
        vacancy_id = f"hh_{v['hh_id']}"
        if vacancy_id in data["vacancies"]:
            continue
        entry = {
            "id": vacancy_id,
            "title": v["title"],
            "keywords": v["title"],
            "candidate_profile": "",
            "salary_from": None,
            "notes": "",
            "sources": ["hh"],
            "candidate_count": 0,
            "hh_vacancy_id": v["hh_id"],
            "hh_url": v.get("url"),
            "status": "idle",
        }
        data["vacancies"][vacancy_id] = entry
        created.append(entry)
    save_data(data)
    return {"status": "ok", "created": created}


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


def build_company_context(data: dict) -> str:
    """Build a text summary of the company's "ideal candidate" profile —
    general description, reference links, and text extracted from uploaded
    example CVs — to give the AI extra context beyond the per-vacancy profile."""
    profile = data.get("company_profile", {})
    parts = []

    if profile.get("description"):
        parts.append(profile["description"])

    if profile.get("links"):
        parts.append("Ссылки на примеры подходящих кандидатов:\n" + "\n".join(profile["links"]))

    for f in profile.get("files", []):
        path = UPLOADS_DIR / f["stored_name"]
        if path.exists():
            text = extract_text(path)
            if text:
                parts.append(f"Пример успешного резюме ({f['name']}):\n{text}")

    return "\n\n".join(parts)


def build_feedback_context(data: dict, max_each: int = 5) -> str:
    """Build a text summary of recent HR feedback ("good"/"bad") on candidates
    across all vacancies, so the AI can learn from real HR decisions over time."""
    good, bad = [], []
    for candidates in data.get("candidates", {}).values():
        for c in candidates:
            fb = c.get("feedback")
            if fb not in ("good", "bad"):
                continue
            entry = f"- {c.get('title', '')}: {c.get('summary', '')}"
            if c.get("feedback_comment"):
                entry += f" (комментарий HR: {c['feedback_comment']})"
            (good if fb == "good" else bad).append(entry)

    parts = []
    if good:
        parts.append("Кандидаты, которых HR ОДОБРИЛ (ищи похожих):\n" + "\n".join(good[-max_each:]))
    if bad:
        parts.append("Кандидаты, которых HR ОТКЛОНИЛ (избегай похожих):\n" + "\n".join(bad[-max_each:]))

    return "\n\n".join(parts)


# ── Background search ─────────────────────────────────────
def _save_debug(search_id: str, **kwargs):
    """Persist progress/diagnostics for a search run so the frontend (and we,
    via /api/searches) can see what happened without digging through Railway
    logs."""
    data = load_data()
    if search_id not in data["vacancies"]:
        return
    debug = data["vacancies"][search_id].get("debug", {})
    debug.update(kwargs)
    data["vacancies"][search_id]["debug"] = debug
    save_data(data)


async def do_search(req: SearchRequest):
    data = load_data()
    seen_ids = {c["id"] for c in data["candidates"].get(req.search_id, [])}
    company_context = build_company_context(data)
    feedback_context = build_feedback_context(data)

    _save_debug(
        req.search_id,
        responses=None, favorites=None, hh_results=None,
        total_raw=None, already_seen=len(seen_ids),
        evaluated=[], error=None,
    )

    try:
        raw_candidates = []
        response_ids = set()
        favorite_ids = set()
        if "hh" in req.sources:
            if req.hh_vacancy_id:
                responses = await fetch_vacancy_responses(req.hh_vacancy_id)
                response_ids = {c["id"] for c in responses}
                raw_candidates += responses
                print(f"[search {req.search_id}] responses: {len(responses)}")
                _save_debug(req.search_id, responses=len(responses))

            favorites = await fetch_favorites_folder()
            favorite_ids = {c["id"] for c in favorites}
            for c in favorites:
                if c["id"] not in response_ids:
                    raw_candidates.append(c)
            print(f"[search {req.search_id}] favorites: {len(favorites)}")
            _save_debug(req.search_id, favorites=len(favorites))

            hh_results = await search_hh(req)
            raw_candidates += hh_results
            print(f"[search {req.search_id}] hh search results: {len(hh_results)}")
            _save_debug(req.search_id, hh_results=len(hh_results))

        print(f"[search {req.search_id}] total raw candidates: {len(raw_candidates)}, already seen: {len(seen_ids)}")
        _save_debug(req.search_id, total_raw=len(raw_candidates))

        evaluated = []
        for raw in raw_candidates:
            if raw["id"] in seen_ids:
                continue
            seen_ids.add(raw["id"])
            analysis = await analyze_candidate(raw, req, company_context, feedback_context)
            print(f"[search {req.search_id}] candidate {raw.get('name')!r} score={analysis['score']}")
            evaluated.append({
                "name": raw.get("name", ""),
                "score": analysis["score"],
                "passed": analysis["score"] >= 6,
            })
            _save_debug(req.search_id, evaluated=evaluated)
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
                    "feedback": None,
                    "feedback_comment": "",
                    "source": (
                        "hh_response" if raw["id"] in response_ids
                        else "hh_favorite" if raw["id"] in favorite_ids
                        else "hh"
                    ),
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
        _save_debug(req.search_id, error=str(e))
