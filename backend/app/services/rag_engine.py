import httpx
from datetime import datetime
from typing import List, Tuple
from app.config import settings
from app.db.storage import storage
from app.schemas import RAGResponse, Citation, UserRole

def get_role_clearance(role: UserRole) -> int:
    """
    1 = Директор (видит всё: финансы, зарплаты, производство, регламенты)
    2 = Руководитель производства (видит производство, техкарты, общие регламенты; НЕ видит финансы и зарплаты)
    3 = Руководитель поддержки / Общие сотрудники (видит сервис, SLA, общие регламенты)
    """
    if role == "ROLE_DIRECTOR":
        return 1
    elif role == "ROLE_PRODUCTION_HEAD":
        return 2
    else:
        return 3

async def execute_rag_search(query: str, user_role: UserRole) -> RAGResponse:
    user_clearance = get_role_clearance(user_role)
    query_lower = query.lower()

    # Проверка на попытку несанкционированного доступа к закрытым данным
    is_finance_or_salary_probe = any(
        kw in query_lower for kw in [
            "зарплат", "оклад", "сетка окладов", "бдр", "прибыль", "p&l", 
            "сколько зарабатывает", "доход топ-менеджмент", "премиальн"
        ]
    )

    if is_finance_or_salary_probe and user_clearance > 1:
        # Фиксация нарушения безопасности в аудит-лог (AI-06)
        storage.add_audit_log(
            action="RAG_SECURITY_BLOCK",
            target="Конфиденциальные финансовые документы (doc-fin-*)",
            status="blocked",
            details=f"Заблокирован запрос: '{query}'. У роли {user_role} недостаточно прав (требуется допуск 1-го уровня)."
        )
        return RAGResponse(
            id=f"rag-denied-{int(datetime.now().timestamp())}",
            text="⛔ Доступ ограничен политикой безопасности предприятия. У вас отсутствуют права на просмотр финансовой отчетности, фонда оплаты труда и персональных окладов руководства ООО «Фотопринт». Попытка доступа зарегистрирована в журнале аудита информационной безопасности.",
            timestamp=datetime.now().strftime("%H:%M"),
            citations=[],
            status="access_denied"
        )

    # Фильтрация документов только по разрешенному уровню допуска (AI-02)
    allowed_docs = [
        doc for doc in storage.documents 
        if doc.minClearance >= user_clearance
    ]

    # Поиск наиболее релевантных совпадений по корням слов и семантике
    matching_docs = []
    
    # Обработка общих обзорных запросов ("что по докам", "какие документы", "список регламентов")
    is_general_overview = any(
        kw in query_lower for kw in ["что по докам", "по докам", "все документы", "какие документы", "список регламент", "база знаний", "какие регламенты"]
    )
    if is_general_overview:
        matching_docs = [(doc, 1) for doc in allowed_docs[:4]]
    else:
        for doc in allowed_docs:
            score = 0
            doc_text = (doc.title + " " + doc.summary + " " + doc.content).lower()
            for word in query_lower.split():
                clean_word = "".join(ch for ch in word if ch.isalnum())
                if len(clean_word) >= 3:
                    stem = clean_word[:4] if len(clean_word) >= 5 else clean_word
                    if stem in doc_text or clean_word in doc_text:
                        score += 1
            if score > 0:
                matching_docs.append((doc, score))

    matching_docs.sort(key=lambda x: x[1], reverse=True)

    if not matching_docs:
        storage.add_audit_log(
            action="RAG_SEARCH_EMPTY",
            target="База знаний регламентов",
            status="warning",
            details=f"Запрос '{query}' не дал прямых совпадений в разрешенной базе регламентов."
        )
        return RAGResponse(
            id=f"rag-empty-{int(datetime.now().timestamp())}",
            text="В доступных регламентах и документах ООО «Фотопринт» прямых оснований для ответа не найдено. Согласно регламенту безопасности AI-05, утверждение помечено как «требует уточнения / данные отсутствуют». Сформулируйте запрос иначе либо обратитесь к автору регламента.",
            timestamp=datetime.now().strftime("%H:%M"),
            citations=[],
            status="needs_clarification"
        )

    # Формируем ответ с точными ссылками на документы и даты (AI-01)
    best_doc, _ = matching_docs[0]
    citations = [
        Citation(
            documentId=doc.id,
            documentTitle=doc.title,
            documentDate=doc.date,
            category=doc.category,
            excerpt=doc.content[:220] + "..."
        )
        for doc, _ in matching_docs[:2]
    ]

    answer_text = f"На основании внутреннего регламента «{best_doc.title}» (редакция от {best_doc.date}):\n\n{best_doc.summary}\n\nКлючевая выдержка: {best_doc.content}"

    ai_generated = False
    # Запрос к удаленной модели Qwen 2.5 на AI-сервере для формулирования ответа по регламентам (AI-01, AI-05)
    if getattr(settings, "AI_SERVER_URL", None):
        try:
            headers = {"Bypass-Tunnel-Reminder": getattr(settings, "AI_SERVER_BYPASS_HEADER", "true")}
            context_docs = "\n\n".join([
                f"Регламент: «{doc.title}» (от {doc.date}, категория: {doc.category}):\n{doc.content}"
                for doc, _ in matching_docs[:2]
            ])
            rag_prompt = f"""Ответь на вопрос пользователя строго по предоставленным регламентам предприятия ООО «Фотопринт». Не выдумывай факты, которых нет в тексте регламентов.

Вопрос: {query}

{context_docs}

Дай четкий структурированный ответ со ссылкой на регламент и точные нормативы:"""
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(
                    f"{settings.AI_SERVER_URL}/api/v1/ai/generate",
                    headers=headers,
                    json={
                        "prompt": rag_prompt,
                        "system": "Ты — корпоративный AI-ассистент по регламентам ООО «Фотопринт». Отвечай точно, емко и строго по тексту регламентов.",
                        "temperature": 0.1
                    }
                )
                if resp.status_code == 200:
                    ai_answer = resp.json().get("response", "").strip()
                    if ai_answer:
                        answer_text = ai_answer
                        ai_generated = True
        except Exception:
            pass

    # Интеллектуальный синтез ответа через локальную нейросеть Qwen 2.5 (Ollama)
    if not ai_generated:
        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                resp = await client.post(
                    f"{settings.OLLAMA_BASE_URL}/api/generate",
                    json={
                        "model": settings.OLLAMA_MODEL,
                        "prompt": f"""Ты — корпоративный ассистент руководителя ООО «Фотопринт».
Ответь кратко, емко и строго по существу вопроса руководителя на основе внутреннего регламента:
Документ: «{best_doc.title}» (редакция от {best_doc.date})
Содержание статьи:
{best_doc.content}

Вопрос руководителя: {query}

Требования:
- Отвечай профессионально и конкретно, опираясь строго на факты из текста.
- Обязательно назови документ «{best_doc.title}» и дату редакции.
- Не выдумывай факты (AI-05).""",
                        "stream": False
                    }
                )
                if resp.status_code == 200:
                    generated = resp.json().get("response", "").strip()
                    if generated:
                        answer_text = generated
        except Exception:
            pass

    storage.add_audit_log(
        action="RAG_SEARCH_SUCCESS",
        target=f"{best_doc.id} ({best_doc.title})",
        status="success",
        details=f"Успешный ответ по регламенту с формированием {len(citations)} цитат."
    )

    return RAGResponse(
        id=f"rag-res-{int(datetime.now().timestamp())}",
        text=answer_text,
        timestamp=datetime.now().strftime("%H:%M"),
        citations=citations,
        status="grounded"
    )
