from datetime import datetime
from typing import List, Tuple
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

    # Поиск наиболее релевантных совпадений по ключевым словам и семантике
    matching_docs = []
    for doc in allowed_docs:
        score = 0
        doc_text = (doc.title + " " + doc.summary + " " + doc.content).lower()
        for word in query_lower.split():
            if len(word) > 3 and word in doc_text:
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
