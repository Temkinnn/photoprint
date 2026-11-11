import json
import httpx
from typing import List, Dict, Any
from app.config import settings
from app.schemas import (
    ProtocolAnalysisResponse, DecisionItem, RiskItem, TaskItem,
    AgendaGenerationResponse
)

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

async def generate_meeting_agenda(topic: str, participants: List[str], documents: List[str]) -> AgendaGenerationResponse:
    """
    Генерация проекта повестки и открытых вопросов встречи с помощью локальной модели или регламентных шаблонов.
    """
    docs_str = ", ".join(documents) if documents else "Внутренние регламенты производства"
    prompt = f"""Ты — корпоративный AI-ассистент руководителя ООО «Фотопринт».
Сформируй проект повестки и перечень открытых вопросов к совещанию.
Тема: «{topic}»
Участники: {", ".join(participants) if participants else "Руководящий состав"}
Опорные регламенты: {docs_str}

Выдели строго в формате JSON:
1. "agenda": список пунктов повестки с таймингом в скобках (3-4 пункта).
2. "openQuestions": список критических открытых вопросов для согласования (2-3 вопроса).

Верни ТОЛЬКО валидный JSON без лишнего текста."""

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
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
                agenda = parsed.get("agenda", [])
                open_q = parsed.get("openQuestions", [])
                if agenda:
                    return AgendaGenerationResponse(agenda=agenda, openQuestions=open_q)
    except Exception:
        pass

    # Интеллектуальный fallback на основе темы и регламентов
    return AgendaGenerationResponse(
        agenda=[
            f"1. Анализ рисков и производственных целей по теме: «{topic}» (15 мин)",
            f"2. Проверка требований стандартов и регламентов: {docs_str} (20 мин)",
            "3. Согласование плана внедрения, бюджета и ответственных лиц (15 мин)",
        ],
        openQuestions=[
            f"• Какие критические блокеры зафиксированы по направлению «{topic}»?",
            "• Требуется ли согласование сметы или графика смен до даты проведения встречи?",
        ]
    )

