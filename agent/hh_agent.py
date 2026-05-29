from playwright.async_api import async_playwright
import asyncio
import json
import os
from pathlib import Path

HH_SESSION_FILE = Path(__file__).parent / "hh_session.json"

SEARCH_QUERIES = {
    "horeca_sales": [
        "менеджер по продажам HoReCa",
        "менеджер по продажам ресторанам",
        "продажи морепродукты",
        "продажи стейки мясо рестораны",
        "менеджер по продажам оборудование кухня",
        "управляющий ресторан",
        "account manager HoReCa",
    ]
}


async def search_hh(req) -> list[dict]:
    queries = _build_queries(req)
    results = []
    seen_ids = set()

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await _load_or_create_context(browser)
        page = await context.new_page()

        # Check if logged in
        await page.goto("https://hh.ru/employer/resumesearch")
        await asyncio.sleep(2)

        if "login" in page.url or "account/login" in page.url:
            await _do_login(page)

        await _save_session(context)

        for query in queries:
            found = await _search_query(page, query, req)
            for c in found:
                if c["id"] not in seen_ids:
                    seen_ids.add(c["id"])
                    results.append(c)

        await browser.close()

    return results


def _build_queries(req) -> list[str]:
    base = req.keywords or req.title
    queries = [base]
    # Add standard HoReCa queries
    queries += SEARCH_QUERIES["horeca_sales"]
    return list(set(queries))


async def _search_query(page, query: str, req) -> list[dict]:
    results = []
    try:
        url = _build_search_url(query, req)
        await page.goto(url)
        await asyncio.sleep(2)

        resume_links = await page.query_selector_all("a.resume-search-item__name")
        urls = []
        for link in resume_links[:10]:  # max 10 per query
            href = await link.get_attribute("href")
            if href:
                urls.append("https://hh.ru" + href if href.startswith("/") else href)

        for url in urls:
            candidate = await _parse_resume(page, url)
            if candidate:
                results.append(candidate)
            await asyncio.sleep(1)

    except Exception as e:
        print(f"Error searching query '{query}': {e}")

    return results


def _build_search_url(query: str, req) -> str:
    import urllib.parse
    params = {
        "text": query,
        "area": 1,  # Moscow
        "relocation": "living_or_relocation",
        "order_by": "relevance",
        "search_period": 30,
    }
    if req.salary_from:
        params["salary"] = req.salary_from
    return "https://hh.ru/search/resume?" + urllib.parse.urlencode(params)


async def _parse_resume(page, url: str) -> dict | None:
    try:
        await page.goto(url)
        await asyncio.sleep(1.5)

        name = await _get_text(page, "[data-qa='resume-personal-name']")
        title = await _get_text(page, "[data-qa='resume-block-title-position']")
        city = await _get_text(page, "[data-qa='resume-personal-address']")
        age = await _get_text(page, "[data-qa='resume-personal-age']")

        # Get full text for Claude analysis
        body = await _get_text(page, ".resume")

        salary_el = await page.query_selector("[data-qa='resume-block-salary']")
        salary = await salary_el.inner_text() if salary_el else ""

        photo_el = await page.query_selector(".resume-header-avatar img")
        photo = await photo_el.get_attribute("src") if photo_el else ""

        resume_id = url.split("/")[-1].split("?")[0]

        return {
            "id": resume_id,
            "name": name,
            "title": title,
            "city": city,
            "age": age,
            "salary": salary,
            "url": url,
            "photo": photo,
            "full_text": body[:4000],
        }
    except Exception as e:
        print(f"Error parsing resume {url}: {e}")
        return None


async def _get_text(page, selector: str) -> str:
    try:
        el = await page.query_selector(selector)
        return (await el.inner_text()).strip() if el else ""
    except:
        return ""


async def connect_hh() -> bool:
    """Open browser for manual HH.ru login, save session."""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()
        await page.goto("https://hh.ru/account/login")
        print("Войдите в HH.ru вручную...")
        try:
            await page.wait_for_url("https://hh.ru/**", timeout=120000)
            await _save_session(context)
            await browser.close()
            return True
        except Exception:
            await browser.close()
            return False


async def _do_login(page):
    print("HH.ru: нужна авторизация. Войдите вручную в браузере...")
    await page.wait_for_url("**/employer/**", timeout=120000)
    print("Авторизация успешна!")


async def _load_or_create_context(browser):
    if HH_SESSION_FILE.exists():
        storage = json.loads(HH_SESSION_FILE.read_text())
        return await browser.new_context(storage_state=storage)
    return await browser.new_context()


async def _save_session(context):
    storage = await context.storage_state()
    HH_SESSION_FILE.write_text(json.dumps(storage))
