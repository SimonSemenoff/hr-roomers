from __future__ import annotations
import anthropic
import json
import os

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

SYSTEM_PROMPT = """Ты HR-аналитик. Оцени резюме кандидата строго по профилю который задал HR-менеджер.
Отвечай ТОЛЬКО в JSON формате."""

ANALYSIS_PROMPT = """Оцени резюме кандидата.

=== ОБЩИЙ ПОРТРЕТ ИДЕАЛЬНОГО КАНДИДАТА КОМПАНИИ ===
{company_context}

=== ПРОФИЛЬ КАНДИДАТА ДЛЯ ЭТОЙ ВАКАНСИИ (задан HR-менеджером) ===
{candidate_profile}

=== ДОПОЛНИТЕЛЬНЫЕ ТРЕБОВАНИЯ ===
{hr_notes}

=== ОБРАТНАЯ СВЯЗЬ HR ПО ПРЕДЫДУЩИМ КАНДИДАТАМ ===
Учти эти реальные решения HR-менеджера при оценке — постарайся находить похожих на одобренных и избегать похожих на отклонённых:
{feedback_context}

=== РЕЗЮМЕ ===
Должность: {title}
Город: {city}
{full_text}

Оцени насколько кандидат соответствует профилю. Верни JSON:
{{
  "score": <число от 1 до 10>,
  "why_fits": "<1-2 предложения почему подходит под профиль>",
  "summary": "<краткое резюме опыта в 2-3 предложениях>",
  "red_flags": "<что не соответствует профилю, или пусто если всё хорошо>"
}}"""

DEFAULT_PROFILE = """Менеджер по продажам посуды и кухонного инвентаря для HoReCa.
Идеальный кандидат:
- Продавал в сегменте HoReCa: морепродукты, мясо/стейки, алкоголь, кухонное оборудование, продукты питания премиум-класса
- Работал с ЛПР ресторанов: шеф-повара, управляющие, закупщики
- Или был управляющим/директором ресторана — знает кухню изнутри
- Живёт в Москве или готов переехать"""


async def analyze_candidate(raw: dict, req, company_context: str = "", feedback_context: str = "") -> dict:
    profile = req.candidate_profile or DEFAULT_PROFILE

    prompt = ANALYSIS_PROMPT.format(
        company_context=company_context or "не задан",
        candidate_profile=profile,
        hr_notes=req.notes or "нет",
        feedback_context=feedback_context or "пока нет оценённых кандидатов",
        title=raw.get("title", ""),
        city=raw.get("city", ""),
        full_text=raw.get("full_text", ""),
    )

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )

    text = message.content[0].text.strip()
    if "```" in text:
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]

    return json.loads(text)
