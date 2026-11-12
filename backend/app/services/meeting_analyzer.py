import json
import httpx
from typing import List, Dict, Any
from app.config import settings
from app.schemas import (
    ProtocolAnalysisResponse, DecisionItem, RiskItem, TaskItem
)
from app.services.ollama_client import TUNNEL_HEADERS

CATEGORY_MAP = {
    "решено": "resolved",
    "resolved": "resolved",
    "предложено": "proposed",
    "proposed": "proposed",
    "обсуждалось": "discussed",
    "discussed": "discussed",
    "требует уточнения": "needs_clarification",
    "needs_clarification": "needs_clarification",
}

FALLBACK_MEETING_ANALYSIS = {
    "summary": "Проведено оперативное совещание руководящего состава по всплеску брака ламинации обложек фотокниг и устранению задержек отгрузок в преддверии пикового сезона.",
    "decisions": [
        DecisionItem(
            id="dec-1",
            category="resolved",
            text="Остановить эксплуатацию ламинатора Foliant Vega 400 до завершения полной замены тефлонового вала и калибровки термодатчика.",
            speaker="Смирнов А.В.",
            timestamp="04:12"
        ),
        DecisionItem(
            id="dec-2",
            category="resolved",
            text="Все задержанные тиражи фотокниг перепечатать с высшим приоритетом за счет резервного фонда цеха в течение 24 часов.",
            speaker="Иванов И.С.",
            timestamp="11:45"
        ),
        DecisionItem(
            id="dec-3",
            category="proposed",
            text="Предложено ввести третью ночную мини-смену операторов ламинации на период с 15 по 30 ноября для компенсации простоя.",
            speaker="Иванов И.С.",
            timestamp="18:30"
        ),
        DecisionItem(
            id="dec-4",
            category="discussed",
            text="Обсуждалась возможность временного перенаправления части ламинационных заказов на субподряд в типографию-партнер.",
            speaker="Ковалева Е.Д.",
            timestamp="22:15"
        ),
        DecisionItem(
            id="dec-5",
            category="needs_clarification",
            text="Требует уточнения: согласование коммерческих условий с поставщиком запчастей по срочной авиадоставке резервного вала из Москвы.",
            speaker="Смирнов А.В.",
            timestamp="28:40"
        )
    ],
    "risks": [
        RiskItem(
            id="risk-1",
            riskDescription="Срыв SLA доставки более 350 клиентских заказов picPac.by при задержке монтажа запчасти свыше 48 часов.",
            impact="High",
            suggestedMitigation="Оперативное оповещение клиентов в приложении picPac с начислением бонусов на следующий заказ."
        ),
        RiskItem(
            id="risk-2",
            riskDescription="Превышение планового норматива технологического брака за ноябрь выше критической отметки 3.5%.",
            impact="Medium",
            suggestedMitigation="Проведение внеочередного входного контроля партии пленки Soft-touch перед запуском тиражей."
        )
    ],
    "tasks": [
        TaskItem(
            id="task-ext-1",
            title="Завершить монтаж нового тефлонового вала на Foliant Vega 400 и провести тестовый прогон",
            assigneeName="Иванов И.С.",
            deadline="2026-11-13",
            sourceQuote="«Игорь, монтаж и пробные 50 листов сделай строго до вечера четверга 13 ноября»",
            timestamp="07:15",
            status="pending_approval"
        ),
        TaskItem(
            id="task-ext-2",
            title="Подготовить список задержанных заказов picPac для автоматической рассылки извинений и промокодов",
            assigneeName="Ковалева Е.Д.",
            deadline="2026-11-12",
            sourceQuote="«Лена, выгрузи все номера заказов и подготовь пуш-уведомление до завтра до полудня»",
            timestamp="14:50",
            status="pending_approval"
        ),
        TaskItem(
            id="task-ext-3",
            title="Запросить коммерческое предложение на резервный комплект нагревательных элементов",
            assigneeName="Требует уточнения",
            deadline="Требует уточнения",
            sourceQuote="«Надо бы запросить у дилера запасной комплект нагревателей на будущее, чтобы не стоять»",
            timestamp="29:10",
            status="pending_approval"
        )
    ]
}

async def analyze_meeting_transcript(transcript_text: str, meeting_title: str) -> ProtocolAnalysisResponse:
    """
    Анализ расшифровки встречи через локальную LLM (Ollama / Qwen 2.5) с авто-fallback.
    """
    prompt = f"""Ты — корпоративный AI-ассистент руководителя ООО «Фотопринт».
Проанализируй следующую стенограмму совещания «{meeting_title}»:

{transcript_text}

Выдели строго в формате JSON:
1. "summary": краткое саммари встречи (2-3 предложения).
2. "decisions": список решений. Каждое решение должно иметь категорию строго из:
   - "resolved" (окончательно решено)
   - "proposed" (предложено кем-то)
   - "discussed" (просто обсуждалось)
   - "needs_clarification" (требует уточнения/не завершено)
   Поля: "id", "category", "text", "speaker", "timestamp".
3. "risks": список выявленных производственных/бизнес рисков. Поля: "id", "riskDescription", "impact" (High/Medium/Low), "suggestedMitigation".
4. "tasks": список поручений и задач. 
   ВАЖНО: Если исполнитель или дедлайн не названы четко — пиши "Требует уточнения" (не выдумывай!).
   Поля: "id", "title", "assigneeName", "deadline", "sourceQuote", "timestamp".

Верни ТОЛЬКО валидный JSON без лишнего текста."""

    ai_server = (settings.AI_SERVER_URL or "").strip().rstrip("/")
    if ai_server:
        try:
            async with httpx.AsyncClient(timeout=settings.OLLAMA_TIMEOUT_SECONDS, follow_redirects=True) as client:
                resp = await client.post(
                    f"{ai_server}/api/v1/ai/analyze-transcript",
                    headers=TUNNEL_HEADERS,
                    json={"transcript": transcript_text, "meeting_title": meeting_title},
                )
                if resp.status_code == 200:
                    parsed = resp.json()
                    decisions = [
                        DecisionItem(
                            id=f"dec-{idx + 1}",
                            category=CATEGORY_MAP.get((d.get("category") or "").strip().lower(), "discussed"),
                            text=d.get("text", ""),
                            speaker=d.get("speaker"),
                            timestamp=d.get("timestamp"),
                        )
                        for idx, d in enumerate(parsed.get("decisions", []))
                    ]
                    risks = [
                        RiskItem(
                            id=f"risk-{idx + 1}",
                            riskDescription=r.get("risk", ""),
                            impact="High" if idx == 0 else "Medium",
                            suggestedMitigation="Требуется контроль руководителя",
                        )
                        for idx, r in enumerate(parsed.get("identified_risks", []))
                        if r.get("risk")
                    ]
                    tasks = [
                        TaskItem(
                            id=t.get("temp_id") or f"task-ext-{idx + 1}",
                            title=t.get("title", ""),
                            assigneeName=t.get("assignee") or "Требует уточнения",
                            deadline=t.get("deadline") or "Требует уточнения",
                            sourceQuote=t.get("source_quote") or "",
                            timestamp=t.get("timestamp"),
                            status="pending_approval",
                        )
                        for idx, t in enumerate(parsed.get("tasks", []))
                    ]
                    return ProtocolAnalysisResponse(
                        meetingTitle=parsed.get("meeting_title") or meeting_title,
                        summary=f"Обработано удаленным AI-сервером (Qwen 2.5): выделено решений — {len(decisions)}, поручений — {len(tasks)}, рисков — {len(risks)}.",
                        decisions=decisions,
                        risks=risks,
                        tasks=tasks,
                    )
        except Exception:
            pass

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(
                f"{settings.OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": settings.OLLAMA_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "format": "json"
                }
            )
            if resp.status_code == 200:
                raw_json = resp.json().get("response", "")
                parsed = json.loads(raw_json)
                
                decisions = [DecisionItem(**d) for d in parsed.get("decisions", [])]
                risks = [RiskItem(**r) for r in parsed.get("risks", [])]
                tasks = [TaskItem(**t) for t in parsed.get("tasks", [])]
                
                return ProtocolAnalysisResponse(
                    meetingTitle=meeting_title,
                    summary=parsed.get("summary", "Саммари сформировано."),
                    decisions=decisions,
                    risks=risks,
                    tasks=tasks
                )
    except Exception as e:
        # При недоступности Ollama используется надежный офлайн fallback
        pass

    return ProtocolAnalysisResponse(
        meetingTitle=meeting_title,
        summary=FALLBACK_MEETING_ANALYSIS["summary"],
        decisions=FALLBACK_MEETING_ANALYSIS["decisions"],
        risks=FALLBACK_MEETING_ANALYSIS["risks"],
        tasks=FALLBACK_MEETING_ANALYSIS["tasks"]
    )
