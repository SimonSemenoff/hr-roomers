from __future__ import annotations
from playwright.async_api import async_playwright
import asyncio
import json
import os
import re
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
                await add_to_favorites_folder(page)
            await asyncio.sleep(1)

    except Exception as e:
        print(f"Error searching query '{query}': {e}")

    return results


FAVORITES_FOLDER_NAME = "AI Roomers"


async def add_to_favorites_folder(page, folder_name: str = FAVORITES_FOLDER_NAME) -> bool:
    """Add the resume currently open in `page` to the given HH.ru favorites folder
    (e.g. "AI Roomers"), so the employer can review it later in their account.
    """
    try:
        fav_btn = await page.query_selector('[data-qa="resume-favorite-button"]')
        if not fav_btn:
            return False
        await fav_btn.click()
        await asyncio.sleep(1)

        items = await page.query_selector_all('li[data-qa^="resume-serp__favourite-popup-item_"]')
        target_label = None
        target_checkbox = None
        for item in items:
            title_el = await item.query_selector('[data-qa="resume-serp__favourite-popup-item-title"]')
            if title_el and (await title_el.inner_text()).strip() == folder_name:
                target_label = await item.query_selector("label")
                target_checkbox = await item.query_selector('input[type="checkbox"]')
                break

        if not target_label:
            print(f"Folder '{folder_name}' not found in favorites popup")
            return False

        already_checked = await target_checkbox.is_checked() if target_checkbox else False
        if not already_checked:
            await target_label.click()
            await asyncio.sleep(0.5)

        save_btn = await page.query_selector('[data-qa="resume-serp__favourite-popup-save"]')
        if save_btn:
            await save_btn.click()
            await asyncio.sleep(1)
        return True
    except Exception as e:
        print(f"Error adding resume to favorites folder: {e}")
        return False


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
            # HH.ru sets a "hhrole" cookie = "anonymous" until the user logs in,
            # and "applicant"/"employer" afterwards. Poll for that change.
            deadline = asyncio.get_event_loop().time() + 120
            logged_in = False
            while asyncio.get_event_loop().time() < deadline:
                cookies = await context.cookies()
                hhrole = next((c["value"] for c in cookies if c["name"] == "hhrole"), None)
                if hhrole and hhrole != "anonymous":
                    logged_in = True
                    break
                await asyncio.sleep(1)

            if logged_in:
                await page.wait_for_timeout(2000)
                await _save_session(context)
                await browser.close()
                return True
            else:
                print("Вход не выполнен — истекло время ожидания (120 сек)")
                await browser.close()
                return False
        except Exception as e:
            print(f"Ошибка при ожидании входа: {e}")
            await browser.close()
            return False


async def _do_login(page):
    print("HH.ru: нужна авторизация. Войдите вручную в браузере...")
    await page.wait_for_url("**/employer/**", timeout=120000)
    print("Авторизация успешна!")


async def fetch_employer_vacancies() -> list[dict]:
    """Fetch the list of the employer's active vacancies from HH.ru."""
    results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await _load_or_create_context(browser)
        page = await context.new_page()
        await page.goto("https://hh.ru/employer/vacancies", wait_until="domcontentloaded")
        await asyncio.sleep(2)

        cards = await page.query_selector_all('[data-qa="vacancies-dashboard-vacancy"]')
        for card in cards:
            try:
                name_link = await card.query_selector('a[data-qa="vacancies-dashboard-vacancy-name"]')
                if not name_link:
                    continue
                title = (await name_link.inner_text()).strip()
                href = await name_link.get_attribute("href")
                vacancy_id = href.split("/vacancy/")[-1].split("?")[0] if href else None

                resp_el = await card.query_selector('[data-qa="vacancies-dashboard-vacancy-responses-count-total"]')
                responses_raw = (await resp_el.inner_text()).strip() if resp_el else "0"
                responses = responses_raw.split("\n")[0].strip()

                if vacancy_id:
                    results.append({
                        "hh_id": vacancy_id,
                        "title": title,
                        "url": f"https://hh.ru/vacancy/{vacancy_id}",
                        "responses_count": responses,
                    })
            except Exception as e:
                print(f"Error parsing vacancy card: {e}")

        await browser.close()
    return results


async def fetch_vacancy_responses(hh_vacancy_id: str, limit: int = 20) -> list[dict]:
    """Fetch candidates who responded ('откликнулись') to a specific HH.ru vacancy."""
    results = []
    seen_ids = set()
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await _load_or_create_context(browser)
        page = await context.new_page()
        url = f"https://hh.ru/employer/vacancyresponses?vacancyId={hh_vacancy_id}"
        await page.goto(url, wait_until="domcontentloaded")
        await asyncio.sleep(2)

        links = await page.query_selector_all('a[href*="/resume/"]')
        resume_urls = []
        for link in links:
            href = await link.get_attribute("href")
            if not href or "/resume/" not in href:
                continue
            # Only actual applicants ("responses"), not suggested matches
            if "hhtmFromLabel=responses" not in href:
                continue
            resume_id = href.split("/resume/")[1].split("?")[0]
            if resume_id in seen_ids:
                continue
            seen_ids.add(resume_id)
            full_url = href if href.startswith("http") else "https://hh.ru" + href
            resume_urls.append(full_url)
            if len(resume_urls) >= limit:
                break

        for r_url in resume_urls:
            candidate = await _parse_resume(page, r_url)
            if candidate:
                results.append(candidate)
            await asyncio.sleep(1)

        await browser.close()
    return results


async def fetch_favorites_folder(folder_name: str = FAVORITES_FOLDER_NAME, limit: int = 50) -> list[dict]:
    """Fetch candidates saved to the given HH.ru favorites folder (e.g. "AI Roomers"),
    so they show up as candidates on the site."""
    results = []
    seen_ids = set()
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await _load_or_create_context(browser)
        page = await context.new_page()

        # Resolve the folder id by name
        await page.goto("https://hh.ru/employer/resumefolders", wait_until="domcontentloaded")
        await asyncio.sleep(2)
        html = await page.content()
        folder_id = None
        m = re.search(r'"foldersInvariants":\{(.*?),"totalResumesCount"', html)
        if m:
            try:
                folders_json = "{" + m.group(1) + "}"
                folders = json.loads(folders_json)
                for fid, info in {**folders.get("own", {}), **folders.get("shared", {})}.items():
                    if info.get("name") == folder_name:
                        folder_id = fid
                        break
            except Exception as e:
                print(f"Error parsing resume folders: {e}")

        if not folder_id:
            print(f"Favorites folder '{folder_name}' not found")
            await browser.close()
            return results

        await page.goto(f"https://hh.ru/employer/resumefolders?folder={folder_id}", wait_until="domcontentloaded")
        await asyncio.sleep(2)

        links = await page.query_selector_all('a[href*="/resume/"]')
        resume_urls = []
        for link in links:
            href = await link.get_attribute("href")
            if not href or "/resume/" not in href:
                continue
            if "hhtmFrom=employer_folders_grid" not in href:
                continue
            resume_id = href.split("/resume/")[1].split("?")[0]
            if resume_id in seen_ids:
                continue
            seen_ids.add(resume_id)
            full_url = href if href.startswith("http") else "https://hh.ru" + href
            resume_urls.append(full_url)
            if len(resume_urls) >= limit:
                break

        for r_url in resume_urls:
            candidate = await _parse_resume(page, r_url)
            if candidate:
                results.append(candidate)
            await asyncio.sleep(1)

        await browser.close()
    return results


async def _load_or_create_context(browser):
    if HH_SESSION_FILE.exists():
        storage = json.loads(HH_SESSION_FILE.read_text())
        return await browser.new_context(storage_state=storage)
    return await browser.new_context()


async def _save_session(context):
    storage = await context.storage_state()
    HH_SESSION_FILE.write_text(json.dumps(storage))
