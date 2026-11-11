import json
import os
import copy
from typing import Dict, List, Optional
from datetime import datetime
from app.schemas import (
    UserProfile, DocumentItem, KPIMetric, CalendarSlot, 
    AuditLogEntry, TaskItem, MeetingItem, UserRole,
    TranscriptItem, DecisionItem, RiskItem, CriticalIssueItem, OverviewBriefResponse
)

# Начальный эталонный датасет
INITIAL_USERS: Dict[str, UserProfile] = {
    "ROLE_DIRECTOR": UserProfile(
        id="u-1",
        name="Смирнов Алексей Викторович",
        role="ROLE_DIRECTOR",
        roleTitle="Генеральный директор",
        department="Дирекция",
        avatarInitials="АС",
        clearance="Допуск 1 · Полный",
        description="Полный доступ ко всей отчетности: финансовые планы, маржинальность, фонд окладов, цех и клиентский сервис."
    ),
    "ROLE_PRODUCTION_HEAD": UserProfile(
        id="u-2",
        name="Иванов Игорь Сергеевич",
        role="ROLE_PRODUCTION_HEAD",
        roleTitle="Начальник производства",
        department="Производственный цех",
        avatarInitials="ИИ",
        clearance="Допуск 2 · Цех",
        description="Доступ к техкартам станков, нормативам брака, графикам смен и оборудованию. Финансовая тайна закрыта."
    ),
    "ROLE_SUPPORT_HEAD": UserProfile(
        id="u-3",
        name="Ковалева Елена Дмитриевна",
        role="ROLE_SUPPORT_HEAD",
        roleTitle="Руководитель клиентского сервиса",
        department="Служба заботы picPac.by",
        avatarInitials="ЕК",
        clearance="Допуск 3 · Сервис",
        description="Доступ к рекламациям, стандартам SLA, возвратам заказов и модерации фотопродуктов."
    )
}

INITIAL_DOCUMENTS: List[DocumentItem] = [
    # 1. Финансы и стратегия (Только Генеральный директор - minClearance = 1)
    DocumentItem(
        id="doc-fin-01",
        title="Бюджет доходов и расходов (БДР) ООО «Фотопринт» на 4 квартал 2026",
        category="Финансы и стратегия",
        date="2026-10-01",
        minClearance=1,
        summary="Утвержденный план выручки — 48.5 млн руб. Валовая маржинальность — 42%. Лимит фонда премирования цеха — 3.2 млн руб.",
        content="Плановые показатели выручки ООО «Фотопринт» на Q4 2026 установлены на уровне 48 500 000 руб. Плановая себестоимость сырья и расходных материалов составляет 18 200 000 руб. Фонд премирования производственной смены при выполнении норматива брака ниже 2.5% составляет 3 200 000 руб. Все финансовые транзакции свыше 500 000 руб. подлежат личному акцепту Генерального директора."
    ),
    DocumentItem(
        id="doc-fin-02",
        title="Штатное расписание и сетка окладов топ-менеджмента на 2026 год",
        category="Финансы и стратегия",
        date="2026-01-15",
        minClearance=1,
        summary="Конфиденциальная ведомость базовых окладов и KPI-надбавок руководящего состава.",
        content="Конфиденциально. Документ категории особой коммерческой тайны. Фиксированные оклады руководящего состава: Генеральный директор — 420 000 руб., Начальник производства — 210 000 руб. + квартальный бонус до 40% за соблюдение плана отгрузок, Руководитель клиентского сервиса — 180 000 руб. + бонус за SLA выше 95%."
    ),
    DocumentItem(
        id="doc-fin-03",
        title="Сводный финансовый P&L отчет за 9 месяцев 2026 года",
        category="Финансы и стратегия",
        date="2026-10-10",
        minClearance=1,
        summary="Фактическая чистая прибыль за 9 месяцев составила 14.8 млн руб. Рост к прошлому году +18%.",
        content="Совокупная чистая выручка за 9 месяцев 2026 года составила 112.4 млн руб. EBITDA — 22.3 млн руб. Чистая прибыль после уплаты налогов — 14.8 млн руб. Основной драйвер роста — мобильное приложение picPac.by (+34% в сегменте фотокниг)."
    ),
    DocumentItem(
        id="doc-fin-04",
        title="Инвестиционный меморандум: закупка промышленного пресса Canon V1000",
        category="Финансы и стратегия",
        date="2026-09-18",
        minClearance=1,
        summary="Инвестиции в расширение мощностей — 16.5 млн руб. Окупаемость — 14 месяцев.",
        content="Для устранения дефицита мощностей в ноябрьский пик согласована лизинговая сделка на закупку цифровой печатной машины Canon ImagePRESS V1000. Общий объем инвестиций 16.5 млн руб., авансовый платеж 3.3 млн руб. со сроком ввода в эксплуатацию до 1 декабря 2026."
    ),

    # 2. Производство и качество (minClearance = 2: Директор и Производство)
    DocumentItem(
        id="doc-prod-01",
        title="Технологическая карта цифровой печати на ЦПМ HP Indigo 7900",
        category="Производство",
        date="2026-08-15",
        minClearance=2,
        summary="Регламент скорости печати (120 стр/мин), калибровки спектрофотометра и допустимого смещения приводки (до 0.2 мм).",
        content="Базовая скорость печати в 4 краски (CMYK) — 120 стр/мин для мелованной бумаги плотностью 130-250 г/м2. Калибровка встроенного спектрофотометра выполняется каждые 4 часа непрерывной работы либо при каждой смене рулона бумаги. Допустимое оптическое отклонение Delta-E <= 2.0. Максимальное технологическое смещение приводки сторон — 0.2 мм."
    ),
    DocumentItem(
        id="doc-prod-02",
        title="Регламент технического обслуживания и чистки ламинатора GMP Pro-355",
        category="Производство",
        date="2026-07-20",
        minClearance=2,
        summary="Чистка силиконовых валов — ежедневно в начале смены. Температурный режим глянца: 105-110°C, софт-тач: 95°C.",
        content="Перед началом каждой производственной смены оператор обязан очистить горячие силиконовые валы специализированным составом SiliconClean. Рабочий температурный режим для глянцевой пленки 28 мкм: 105-110°C при давлении 4.5 бар. Для пленок Soft-Touch температура строго 95-98°C во избежание деструкции бархатистого слоя."
    ),
    DocumentItem(
        id="doc-prod-03",
        title="Классификатор брака и нормы технологических отходов фотокниг",
        category="Производство",
        date="2026-09-01",
        minClearance=2,
        summary="Допустимый норматив отходов при приладке — 2.5%. Брак свыше нормы списывается за счет производственного подразделения.",
        content="К критическому браку относятся: полошение печати, пузыри под ламинатом, косина сборки блока более 1.0 мм, замятие углов переплета. Заказы с критическим браком подлежат немедленной утилизации и внеочередной перепечатке за 3 часа. Плановый лимит брака по цеху — не более 2.5% от тиража в смену."
    ),
    DocumentItem(
        id="doc-prod-04",
        title="Инструкция по перенастройке линии термоклеевого скрепления Horizon BQ-270",
        category="Производство",
        date="2026-06-12",
        minClearance=2,
        summary="Время прогрева клея PUR — 45 минут. Толщина блока фотокниги — от 4 до 40 мм.",
        content="Перенастройка клеевой каретки на формат 20x20 см занимает не более 12 минут. Температура PUR-клея в ванне должна поддерживаться в диапазоне 125-130°C. Тест на прочность скрепления страниц на разрыв проводится на первом контрольном экземпляре каждой партии."
    ),
    DocumentItem(
        id="doc-prod-05",
        title="График смен и регламент сверхурочных работ цеха на пиковый сезон",
        category="Производство",
        date="2026-10-15",
        minClearance=2,
        summary="Переход на двухсменный 12-часовой график (2/2) с 15 ноября. Доплата за ночные часы +40%.",
        content="С 15 ноября по 31 декабря производственный цех переводится на круглосуточный режим: 2 смены по 12 часов. Дневная смена: 08:00–20:00, ночная смена: 20:00–08:00. Ночные смены оплачиваются с коэффициентом 1.4 к базовой часовой ставке."
    ),

    # 3. Клиентский сервис и picPac.by (minClearance = 3: Все роли)
    DocumentItem(
        id="doc-sup-01",
        title="Регламент обработки рекламаций клиентов сервиса picPac.by",
        category="Клиентский сервис",
        date="2026-08-01",
        minClearance=3,
        summary="Первичный ответ клиенту — до 15 минут. Решение по перепечатке принимается в течение 2 часов.",
        content="При получении претензии на качество фотопродукции через приложение picPac.by оператор поддержки обязан зафиксировать фото дефекта, номер заказа и направить клиенту ответ в течение 15 минут. Если подтвержден брак печати, заказ автоматически направляется на бесплатную внеочередную перепечатку со статусом «Срочно» (срок выпуска до 24 часов)."
    ),
    DocumentItem(
        id="doc-sup-02",
        title="Стандарты SLA службы клиентской поддержки и каналы связи",
        category="Клиентский сервис",
        date="2026-09-10",
        minClearance=3,
        summary="Целевой показатель SLA — не менее 95% тикетов, решенных в срок. Время первого ответа — до 5 минут в чате.",
        content="Каналы поддержки: чат в мобильном приложении picPac.by, Telegram-бот, email support@picpac.by. Рабочие часы омниканальной линии: 09:00–21:00 ежедневно. Время первого ответа в онлайн-чате — не более 5 минут. Уровень удовлетворенности клиентов (CSAT) по итогам диалога должен составлять не менее 4.8 из 5."
    ),
    DocumentItem(
        id="doc-sup-03",
        title="Политика возврата денежных средств при отказе от заказа",
        category="Клиентский сервис",
        date="2026-07-05",
        minClearance=3,
        summary="Возврат 100% до момента передачи в печать. После запуска в печать возврат возможен только при производственном браке.",
        content="В соответствии с законом о защите прав потребителей, фотопродукция, изготовленная по индивидуальному заказу (фотографии, фотокниги с персональными снимками), не подлежит возврату надлежащего качества. Полный возврат средств осуществляется, если заказ отменен в статусе «Черновик» или «На модерации». При выявлении брака цеха клиенту предоставляется выбор: повторная перепечатка либо 100% возврат денежных средств."
    ),
    DocumentItem(
        id="doc-sup-04",
        title="Требования к качеству фотографий и предпечатная проверка (Pre-flight)",
        category="Клиентский сервис",
        date="2026-05-18",
        minClearance=3,
        summary="Минимальное разрешение для печати 300 DPI. Цветовое пространство sRGB или AdobeRGB.",
        content="Мобильное приложение picPac.by выполняет автоматический анализ разрешения каждого снимка при компоновке макета. Если разрешение снимка на развороте ниже 150 DPI, приложение выводит предупреждение «Низкое разрешение: фото может получиться размытым». Пользователь обязан либо подтвердить продолжение печати, либо заменить фото."
    ),
    DocumentItem(
        id="doc-sup-05",
        title="Правила применения промокодов и скидочных программ PicPac",
        category="Клиентский сервис",
        date="2026-08-25",
        minClearance=3,
        summary="Максимальный размер скидки по промокоду — 25%. Промокоды не суммируются со стоимостью курьерской доставки.",
        content="Маркетинговые промокоды действуют только на стоимость изготовления фотопродукции и не распространяются на логистические услуги курьерских служб. Промокод первого заказа WELCOME15 дает скидку 15% на любой фотопродукт при сумме корзины от 1 000 руб."
    ),
    DocumentItem(
        id="doc-gen-01",
        title="Правила внутреннего трудового распорядка и сменного графика ООО «Фотопринт»",
        category="Общие регламенты",
        date="2026-01-10",
        minClearance=3,
        summary="Двухсменный режим работы цеха (8:00-20:00 / 20:00-8:00), порядок учета сверхурочных часов.",
        content="Производственный департамент работает по сменному графику 2/2 с продолжительностью смены 12 часов (включая 1 час перерыва на обед). Дневная смена: 08:00 - 20:00. Ночная смена: 20:00 - 08:00. Переработки в пиковый сезон оплачиваются в полуторном размере за первые два часа и в двойном — за последующие."
    ),
    DocumentItem(
        id="doc-gen-02",
        title="Политика информационной безопасности и защиты коммерческой тайны",
        category="Безопасность",
        date="2026-05-12",
        minClearance=3,
        summary="Запрет передачи исходных макетов клиентов и финансовых сводок во внешние облачные сервисы.",
        content="Строго запрещается загрузка макетов клиентов, клиентских фотографий, а также внутренней управленческой отчетности в сторонние публичные сервисы AI и файлообменники. Вся обработка конфиденциальных данных и AI-ассистирование выполняются исключительно в локальном контуре предприятия (On-Premise)."
    )
]

INITIAL_METRICS: List[KPIMetric] = [
    KPIMetric(
        id="kpi-1",
        name="Заказы, сданные точно в срок",
        value="96.4%",
        target="98.0%",
        status="warning",
        sourceSystem="ERP / Производство",
        updatedAt="2026-11-11 14:30",
        trend="down"
    ),
    KPIMetric(
        id="kpi-2",
        name="Уровень брака цеха (оттиски и сборка)",
        value="3.2%",
        target="< 2.5%",
        status="critical",
        sourceSystem="ERP / Отдел контроля качества",
        updatedAt="2026-11-11 14:00",
        trend="up"
    ),
    KPIMetric(
        id="kpi-3",
        name="SLA службы заботы (ответ до 15 мин)",
        value="98.2%",
        target="95.0%",
        status="normal",
        sourceSystem="CRM / picPac.by",
        updatedAt="2026-11-11 15:00",
        trend="up"
    ),
    KPIMetric(
        id="kpi-4",
        name="Загрузка основных мощностей печати",
        value="87.0%",
        target="80–85%",
        status="warning",
        sourceSystem="ERP / Диспетчеризация",
        updatedAt="2026-11-11 14:15",
        trend="up"
    ),
    KPIMetric(
        id="kpi-5",
        name="Средний чек заказа (приложение PicPac)",
        value="1 420 ₽",
        target="1 350 ₽",
        status="normal",
        sourceSystem="1С / Управление торговлей",
        updatedAt="2026-11-11 13:00",
        trend="up"
    ),
    KPIMetric(
        id="kpi-6",
        name="Обеспеченность сменами печатников",
        value="100%",
        target="100%",
        status="normal",
        sourceSystem="1С / ЗУП",
        updatedAt="2026-11-11 09:00",
        trend="stable"
    )
]

INITIAL_SLOTS: List[CalendarSlot] = [
    CalendarSlot(id="slot-1", date="2026-11-12", startTime="10:00", endTime="11:00", isAvailable=True, participantsFree=["Смирнов А.В.", "Иванов И.С.", "Ковалева Е.Д."]),
    CalendarSlot(id="slot-2", date="2026-11-12", startTime="14:30", endTime="15:30", isAvailable=True, participantsFree=["Смирнов А.В.", "Иванов И.С."]),
    CalendarSlot(id="slot-3", date="2026-11-13", startTime="11:00", endTime="12:00", isAvailable=True, participantsFree=["Смирнов А.В.", "Иванов И.С.", "Ковалева Е.Д."]),
    CalendarSlot(id="slot-4", date="2026-11-13", startTime="16:00", endTime="17:00", isAvailable=False, participantsFree=["Ковалева Е.Д."]),
]

INITIAL_TASKS: List[TaskItem] = [
    TaskItem(
        id="task-init-1",
        title="Выполнить плановую замену резинотканевых полотен на ЦПМ HP Indigo",
        assigneeName="Иванов И.С. (Начальник производства)",
        deadline="2026-11-13",
        sourceQuote="Регламент ТО оборудования: замена полотна каждые 150 тыс. оттисков",
        status="active",
        meetingTitle="Планерка техобслуживания"
    ),
    TaskItem(
        id="task-init-2",
        title="Обновить макеты фотокниг Новогодней коллекции 2027 в каталоге PicPac",
        assigneeName="Ковалева Е.Д. (Клиентский сервис)",
        deadline="2026-11-14",
        sourceQuote="Решение маркетингового комитета от 02.11",
        status="active",
        meetingTitle="Запуск сезонной кампании"
    ),
    TaskItem(
        id="task-init-3",
        title="Провести сверку взаиморасчетов с поставщиком картона «Балтика-Пак»",
        assigneeName="Смирнов А.В. (Директор)",
        deadline="2026-11-09",
        sourceQuote="Финансовый комитет 28.10: завершить сверку до поставки новой партии",
        status="overdue",
        meetingTitle="Финансовый комитет"
    ),
    TaskItem(
        id="task-init-4",
        title="Предоставить акт списания бракованных оттисков лакировки за октябрь",
        assigneeName="Иванов И.С. (Начальник производства)",
        deadline="2026-11-08",
        sourceQuote="Производственная планерка 01.11: согласовать с бухгалтерией объем списания",
        status="overdue",
        meetingTitle="Производственная планерка"
    ),
    TaskItem(
        id="task-101",
        title="Заменить тефлоновый нагревательный вал на ламинаторе Foliant",
        assigneeName="Иванов И.С. (Начальник производства)",
        deadline="2026-11-13",
        sourceQuote="Игорь, бери замену вала на себя, к вечеру четверга ламинатор должен работать идеально",
        status="active",
        meetingTitle="Внеплановое совещание по всплеску брака в цехе"
    ),
    TaskItem(
        id="task-102",
        title="Подготовить служебную записку на лизинг дополнительной ЦПМ Canon V1000",
        assigneeName="Иванов И.С. (Начальник производства)",
        deadline="2026-11-15",
        sourceQuote="Нужно формализовать расчет мощности и передать экономистам до 15 ноября",
        status="active",
        meetingTitle="Внеплановое совещание по всплеску брака в цехе"
    ),
]

INITIAL_MEETINGS: List[MeetingItem] = [
    MeetingItem(
        id="m-prev-01",
        title="Внеплановое совещание по всплеску брака в цехе",
        date="2026-11-10",
        time="15:00",
        durationMinutes=45,
        participants=["Смирнов А.В.", "Иванов И.С."],
        status="completed",
        agenda=["Анализ причин брака 1200 обложек", "Техсостояние Foliant Vega 400", "Сроки перепечатки"],
        openQuestions=["Наличие запчастей на складе поставщика в Минске"]
    ),
    MeetingItem(
        id="m-prev-02",
        title="Разбор клиентских рекламаций picPac.by",
        date="2026-11-09",
        time="11:00",
        durationMinutes=30,
        participants=["Смирнов А.В.", "Ковалева Е.Д."],
        status="completed",
        agenda=["Динамика жалоб за выходные", "Компенсации за задержки курьеров"],
        openQuestions=["Расширение лимита компенсаций для первой линии"]
    )
]

INITIAL_AUDIT: List[AuditLogEntry] = [
    AuditLogEntry(
        id="aud-1",
        timestamp="2026-11-11 14:20:15",
        userId="u-1",
        userName="Смирнов А.В.",
        userRole="ROLE_DIRECTOR",
        action="LOGIN",
        targetObject="Session",
        status="success",
        details="Успешная авторизация в локальном контуре с полными привилегиями"
    ),
    AuditLogEntry(
        id="aud-2",
        timestamp="2026-11-11 14:25:30",
        userId="u-1",
        userName="Смирнов А.В.",
        userRole="ROLE_DIRECTOR",
        action="RAG_SEARCH",
        targetObject="Document: doc-fin-01",
        status="success",
        details="Запрос 'Плановый бюджет на Q4' -> Документ открыт с цитированием оснований"
    ),
    AuditLogEntry(
        id="aud-3",
        timestamp="2026-11-11 14:45:10",
        userId="u-2",
        userName="Иванов И.С.",
        userRole="ROLE_PRODUCTION_HEAD",
        action="RAG_SEARCH_RESTRICTED",
        targetObject="Document: doc-fin-02",
        status="blocked",
        details="Попытка запросить фонд окладов топ-менеджмента. Заблокировано сервером (RBAC ОТ-02)"
    )
]

INITIAL_TRANSCRIPTS: List[TranscriptItem] = [
    TranscriptItem(
        id="tr-01",
        title="Производственная планерка цеха: Сбой УФ-лакировки и срыв сроков",
        date="2026-11-10",
        type="Цех и производство",
        content="""[00:01] Смирнов А.В. (Директор): Коллеги, начинаем планерку. Вчера по приложению PicPac поступило 18 жалоб на задержку отгрузки фотокниг серии Premium. Игорь, доложи, что произошло на участке лакировки?
[00:35] Иванов И.С. (Нач. цеха): На линии УФ-лакировки вышел из строя датчик вязкости полимера. Валы начали наносить состав неравномерно, пошли наплывы на глянце. Пришлось экстренно остановить линию на 3.5 часа и отправить в брак 45 готовых обложек.
[01:15] Смирнов А.В.: Это недопустимо в преддверии праздничного сезона. Какое решение принято?
[01:25] Иванов И.С.: Мы заменили форсунку и почистили датчик, линия снова в строю. Но нам нужен запасной комплект датчиков. Я договорился с поставщиком «Полиграф-Сервис», они готовы отгрузить его завтра.
[01:50] Смирнов А.В.: Хорошо. Тогда фиксируем: Иванову заказать запасной датчик вязкости у «Полиграф-Сервис» до 14 ноября, бюджет согласован в пределах 65 тысяч рублей.
[02:15] Ковалева Е.Д. (Клиентский сервис): Алексей Викторович, клиенты в чате волнуются. Заказы опаздывают уже на сутки.
[02:30] Смирнов А.В.: Елена, подготовьте персональные промокоды на 500 рублей всем 18 пострадавшим клиентам и отправьте извинительные сообщения в чате PicPac до сегодняшнего вечера, крайний срок — 19:00.
[02:55] Ковалева Е.Д.: Принято, сделаю сегодня до семи вечера.
[03:10] Иванов И.С.: Еще момент — по перепечатке брака. Мы успеем отпечатать эти 45 обложек к ночной смене, но нам нужно вывести дополнительного печатника на Indigo.
[03:30] Смирнов А.В.: Выводите. Ответственный — Иванов, обеспечить полную перепечатку бракованной партии до 12 ноября 10:00 утра.
[03:50] Смирнов А.В.: А что у нас с калибровкой резального плоттера Zund? Кто отвечает?
[04:05] Иванов И.С.: Там вроде инженер смотрел, но точный срок калибровки пока не ясен, надо уточнить у сервисной службы.
[04:20] Смирнов А.В.: Значит этот вопрос пока открыт, требует уточнения. Планерка окончена.""",
        stagedTasks=[
            TaskItem(
                id="task-tr1-1",
                title="Заказать запасной датчик вязкости полимера у поставщика «Полиграф-Сервис»",
                assigneeName="Иванов И.С. (Начальник производства)",
                deadline="2026-11-14",
                sourceQuote="Иванову заказать запасной датчик вязкости у «Полиграф-Сервис» до 14 ноября, бюджет согласован в пределах 65 тысяч рублей",
                timestamp="01:50",
                status="pending_approval"
            ),
            TaskItem(
                id="task-tr1-2",
                title="Отправить извинительные сообщения и промокоды на 500 руб 18 задержанным клиентам PicPac",
                assigneeName="Ковалева Е.Д. (Клиентский сервис)",
                deadline="2026-11-10 19:00",
                sourceQuote="Елена, подготовьте персональные промокоды на 500 рублей всем 18 пострадавшим клиентам до сегодняшнего вечера, крайний срок — 19:00",
                timestamp="02:30",
                status="pending_approval"
            ),
            TaskItem(
                id="task-tr1-3",
                title="Обеспечить внеочередную перепечатку 45 бракованных обложек фотокниг на ЦПМ Indigo",
                assigneeName="Иванов И.С. (Начальник производства)",
                deadline="2026-11-12 10:00",
                sourceQuote="Ответственный — Иванов, обеспечить полную перепечатку бракованной партии до 12 ноября 10:00 утра",
                timestamp="03:30",
                status="pending_approval"
            ),
            TaskItem(
                id="task-tr1-4",
                title="Провести калибровку резального плоттера Zund",
                assigneeName="требует уточнения",
                deadline="требует уточнения",
                sourceQuote="Там вроде инженер смотрел, но точный срок калибровки пока не ясен, надо уточнить у сервисной службы",
                timestamp="04:05",
                status="pending_approval"
            )
        ],
        summary="Разбор инцидента аварийной остановки линии УФ-лакировки. Выявлена причина — сбой датчика вязкости полимера, в брак ушло 45 обложек фотокниг. Утверждены компенсирующие меры для клиентов и график внеочередной перепечатки.",
        decisions=[
            DecisionItem(id="d-1", category="resolved", text="Утверждена закупка резервного комплекта датчиков вязкости у «Полиграф-Сервис» за 65 000 руб.", speaker="Смирнов А.В.", timestamp="01:50"),
            DecisionItem(id="d-2", category="resolved", text="Выдать промокоды по 500 руб всем 18 клиентам задержанных заказов.", speaker="Смирнов А.В.", timestamp="02:30"),
            DecisionItem(id="d-3", category="proposed", text="Предложение вывести дополнительного оператора на ЦПМ в ночную смену.", speaker="Иванов И.С.", timestamp="03:10"),
            DecisionItem(id="d-4", category="needs_clarification", text="Сроки сервисного обслуживания и калибровки плоттера Zund не согласованы.", speaker="Иванов И.С.", timestamp="04:05")
        ],
        risks=[
            RiskItem(id="r-1", riskDescription="Повторный сбой линии лакировки при отсутствии запчастей в пиковый сезон ноябрь-декабрь.", impact="High", suggestedMitigation="Создать неснижаемый складской запас датчиков и форсунок к 15 ноября."),
            RiskItem(id="r-2", riskDescription="Отток постоянных клиентов приложения PicPac из-за срыва объявленного срока доставки.", impact="Medium", suggestedMitigation="Превентивные пуш-уведомления со статусом печати.")
        ]
    ),
    TranscriptItem(
        id="tr-02",
        title="Разбор качества PicPac: Претензии по цветопередаче фотополотен",
        date="2026-11-08",
        type="Клиентский сервис и препресс",
        content="""[00:05] Ковалева Е.Д. (Клиентский сервис): Коллеги, за последнюю неделю получили 12 жалоб на темные тени при печати фотохолстов 40х60. На экранах смартфонов iPhone фото выглядят ярче, чем на готовом холсте.
[00:45] Иванов И.С. (Нач. цеха): Холст матовый и имеет естественное впитывание чернил, поэтому точка черного визуально глубже. Плюс пользователи отправляют фото в цветовом пространстве Display P3, а профиль плоттера настроен на стандартный CMYK Fogra39.
[01:20] Смирнов А.В. (Директор): Нужно автоматизировать цветокоррекцию на входе. Елена, подготовьте вместе с дизайнерами памятку для мобильного приложения с рекомендациями по яркости до 16 ноября.
[01:45] Ковалева Е.Д.: Сделаем. Также предлагаю добавить в карточку продукта PicPac предупреждение об особенностях матового холста.
[02:10] Смирнов А.В.: Поддерживаю. Иванову: обновить ICC-профиль широкоформатного плоттера Epson SC-P9000 до 15 ноября. Срок и исполнитель зафиксированы.""",
        stagedTasks=[
            TaskItem(
                id="task-tr2-1",
                title="Разработать экранную памятку и подсказки по экспозиции фото для пользователей picPac.by",
                assigneeName="Ковалева Е.Д. (Клиентский сервис)",
                deadline="2026-11-16",
                sourceQuote="Елена, подготовьте вместе с дизайнерами памятку для мобильного приложения с рекомендациями по яркости до 16 ноября",
                timestamp="01:20",
                status="pending_approval"
            ),
            TaskItem(
                id="task-tr2-2",
                title="Перестроить ICC-профиль и провести спектрофотометрию плоттера Epson SC-P9000 под холсты",
                assigneeName="Иванов И.С. (Начальник производства)",
                deadline="2026-11-15",
                sourceQuote="Иванову: обновить ICC-профиль широкоформатного плоттера Epson SC-P9000 до 15 ноября",
                timestamp="02:10",
                status="pending_approval"
            )
        ],
        summary="Анализ расхождений между экранами смартфонов и матовыми фотохолстами. Принято решение внедрить автоматическое предупреждение в приложении и выполнить профилирование плоттера.",
        decisions=[
            DecisionItem(id="d-21", category="resolved", text="Обновить ICC-профиль плоттера Epson SC-P9000 для компенсации растискивания на холсте.", speaker="Смирнов А.В.", timestamp="02:10"),
            DecisionItem(id="d-22", category="resolved", text="Добавить предупреждение в UI корзины PicPac о контрасте на матовых материалах.", speaker="Ковалева Е.Д.", timestamp="01:45")
        ],
        risks=[
            RiskItem(id="r-21", riskDescription="Рост себестоимости перепечаток крупноформатных холстов при отсутствии валидации sRGB/Display P3.", impact="Medium", suggestedMitigation="Внедрение Pre-flight конвертации в приложении.")
        ]
    ),
    TranscriptItem(
        id="tr-03",
        title="Совет директоров: Стратегия Q4 и подготовка к пиковому сезону",
        date="2026-11-05",
        type="Стратегическое планирование",
        content="""[00:10] Смирнов А.В. (Директор): Коллеги, главный вопрос повестки — готовность к декабрьскому всплеску заказов. Прогноз спроса показывает рост до 4 200 заказов в сутки в период 10–25 декабря. Текущая мощность цеха — 3 100 заказов.
[00:55] Иванов И.С. (Нач. цеха): Без запуска резервной ЦПМ Canon V1000 мы войдем в жесткий дефицит на 51-й неделе года. Срок пусконаладки — 5 рабочих дней.
[01:30] Смирнов А.В.: Договор лизинга подписан, первый транш 3.3 млн рублей отправлен. Иванову: подготовить фундамент и силовые кабели для монтажа машины до 20 ноября.
[02:00] Ковалева Е.Д. (Клиентский сервис): По клиентской поддержке: в декабре потребуется усиление линии до 6 операторов в смену. Нужно нанять 3 временных операторов поддержки на период 1 декабря — 15 января.
[02:35] Смирнов А.В.: Согласовано. Ковалевой: согласовать профили кандидатов и завершить найм 3 операторов до 25 ноября.
[03:10] Смирнов А.В.: Вопрос по дополнительной аренде склада упаковки пока открыт, ждем ответа арендодателя.""",
        stagedTasks=[
            TaskItem(
                id="task-tr3-1",
                title="Подготовить площадку и электропитание 380В для монтажа печатной машины Canon V1000",
                assigneeName="Иванов И.С. (Начальник производства)",
                deadline="2026-11-20",
                sourceQuote="Иванову: подготовить фундамент и силовые кабели для монтажа машины до 20 ноября",
                timestamp="01:30",
                status="pending_approval"
            ),
            TaskItem(
                id="task-tr3-2",
                title="Организовать найм и обучение 3 временных операторов службы заботы PicPac на декабрь",
                assigneeName="Ковалева Е.Д. (Клиентский сервис)",
                deadline="2026-11-25",
                sourceQuote="Ковалевой: согласовать профили кандидатов и завершить найм 3 операторов до 25 ноября",
                timestamp="02:35",
                status="pending_approval"
            ),
            TaskItem(
                id="task-tr3-3",
                title="Согласовать договор субаренды теплого склада для готовых тиражей",
                assigneeName="требует уточнения",
                deadline="требует уточнения",
                sourceQuote="Вопрос по дополнительной аренде склада упаковки пока открыт, ждем ответа арендодателя",
                timestamp="03:10",
                status="pending_approval"
            )
        ],
        summary="Утверждение плана масштабирования мощностей на пиковый новогодний сезон. Согласован ввод машины Canon V1000 и расширение штата омниканальной поддержки на 3 человека.",
        decisions=[
            DecisionItem(id="d-31", category="resolved", text="Утвержден ввод в строй новой ЦПМ Canon V1000 до 1 декабря 2026.", speaker="Смирнов А.В.", timestamp="01:30"),
            DecisionItem(id="d-32", category="resolved", text="Выделен бюджет на найм 3 сезонных операторов поддержки на 1.5 месяца.", speaker="Смирнов А.В.", timestamp="02:35"),
            DecisionItem(id="d-33", category="needs_clarification", text="Договор субаренды дополнительного склада упаковки ожидает согласования ставки.", speaker="Смирнов А.В.", timestamp="03:10")
        ],
        risks=[
            RiskItem(id="r-31", riskDescription="Дефицит мощности в 1 100 заказов/сутки при задержке монтажа Canon V1000.", impact="High", suggestedMitigation="План аварийного распределения тиражей на резервные плоттеры цеха.")
        ]
    )
]

INITIAL_OVERVIEW_BRIEF = OverviewBriefResponse(
    situationBrief="Внимание участка послепечатной обработки: из-за аварии датчика УФ-лакировки брак составил 3.2% (порог цеха 2.5%), сдача тиражей в срок снизилась до 96.4%. Служба заботы PicPac удерживает показатель SLA 98.2%. Загрузка основного парка плоттеров и ЦПМ достигла 87%, подтверждая необходимость ускоренного ввода ЦПМ Canon V1000 к 50-й неделе.",
    dataFreshness="2026-11-11 15:00:00",
    criticalIssues=[
        CriticalIssueItem(
            id="iss-1",
            title="Закупка запасного комплекта датчиков вязкости для УФ-линии",
            description="Поставщик «Полиграф-Сервис» (Бюджет 65 000 руб.). Ответственный: Иванов И.С.",
            deadline="14.11.2026"
        ),
        CriticalIssueItem(
            id="iss-2",
            title="Согласование ставки субаренды упаковочного склада",
            description="Риск дефицита площади упаковки тиражей к декабрю. Ответственный: Смирнов А.В.",
            deadline="15.11.2026"
        )
    ]
)

from app.db.session import SessionLocal, init_tables
from app.db.models import (
    DBUser, DBDocument, DBMeeting, DBTask,
    DBCalendarSlot, DBAuditLog, DBKPIMetric,
    DBTranscript, DBOverviewBrief
)

class PersistentList(list):
    def __init__(self, iterable, on_insert=None, on_remove=None):
        super().__init__(iterable)
        self.on_insert = on_insert
        self.on_remove = on_remove

    def insert(self, index, item):
        super().insert(index, item)
        if self.on_insert:
            self.on_insert(item)

    def append(self, item):
        super().append(item)
        if self.on_insert:
            self.on_insert(item)

    def remove(self, item):
        super().remove(item)
        if self.on_remove:
            self.on_remove(item)

class PostgresStorage:
    def __init__(self):
        self.current_role: UserRole = "ROLE_DIRECTOR"
        self._init_and_load()

    def _init_and_load(self):
        init_tables()
        self.reload_from_db()

    def reload_from_db(self):
        with SessionLocal() as db:
            # Users
            db_users = db.query(DBUser).all()
            self.users = {
                u.role: UserProfile(
                    id=u.id,
                    name=u.name,
                    role=u.role,
                    roleTitle=u.role_title,
                    department=u.department,
                    avatarInitials=u.avatar_initials,
                    clearance=u.clearance,
                    description=u.description
                )
                for u in db_users
            }
            if not self.users:
                self.users = copy.deepcopy(INITIAL_USERS)

            # Documents
            db_docs = db.query(DBDocument).all()
            self.documents = [
                DocumentItem(
                    id=d.id,
                    title=d.title,
                    category=d.category,
                    date=d.date,
                    minClearance=d.min_clearance,
                    summary=d.summary,
                    content=d.content
                )
                for d in db_docs
            ]

            # Metrics
            db_metrics = db.query(DBKPIMetric).all()
            self.metrics = [
                KPIMetric(
                    id=m.id,
                    name=m.name,
                    value=m.value,
                    target=m.target,
                    status=m.status,
                    sourceSystem=m.source_system,
                    updatedAt=m.updated_at,
                    trend=m.trend
                )
                for m in db_metrics
            ]

            # Slots
            db_slots = db.query(DBCalendarSlot).all()
            self.slots = [
                CalendarSlot(
                    id=s.id,
                    startTime=s.start_time,
                    endTime=s.end_time,
                    date=s.date,
                    isAvailable=s.is_available,
                    participantsFree=s.participants_free or []
                )
                for s in db_slots
            ]

            # Tasks
            db_tasks = db.query(DBTask).all()
            task_items = [
                TaskItem(
                    id=t.id,
                    title=t.title,
                    assigneeName=t.assignee_name,
                    deadline=t.deadline,
                    sourceQuote=t.source_quote,
                    timestamp=t.timestamp,
                    status=t.status,
                    meetingTitle=t.meeting_title,
                    protocolId=t.protocol_id
                )
                for t in db_tasks
            ]
            self._tasks = PersistentList(task_items, on_insert=self._on_task_insert)

            # Meetings
            db_meetings = db.query(DBMeeting).all()
            meeting_items = [
                MeetingItem(
                    id=mt.id,
                    title=mt.title,
                    date=mt.date,
                    time=mt.time,
                    durationMinutes=mt.duration_minutes,
                    participants=mt.participants or [],
                    status=mt.status,
                    agenda=mt.agenda or [],
                    openQuestions=mt.open_questions or [],
                    protocolId=mt.protocol_id
                )
                for mt in db_meetings
            ]
            self._meetings = PersistentList(meeting_items, on_insert=self._on_meeting_insert)

            # Audit Logs
            db_logs = db.query(DBAuditLog).order_by(DBAuditLog.timestamp.desc()).all()
            log_items = [
                AuditLogEntry(
                    id=a.id,
                    timestamp=a.timestamp,
                    userId=a.user_id,
                    userName=a.user_name,
                    userRole=a.user_role,
                    action=a.action,
                    targetObject=a.target_object,
                    status=a.status,
                    details=a.details
                )
                for a in db_logs
            ]
            self._audit_logs = PersistentList(log_items, on_insert=self._on_audit_insert)

            # Transcripts
            db_transcripts = db.query(DBTranscript).all()
            self.transcripts = [
                TranscriptItem(
                    id=tr.id,
                    title=tr.title,
                    date=tr.date,
                    type=tr.type,
                    content=tr.content,
                    summary=tr.summary,
                    stagedTasks=[TaskItem(**st) for st in (tr.staged_tasks or [])],
                    decisions=[DecisionItem(**d) for d in (tr.decisions or [])],
                    risks=[RiskItem(**r) for r in (tr.risks or [])]
                )
                for tr in db_transcripts
            ]

            # Overview Brief
            db_brief = db.query(DBOverviewBrief).filter_by(id="default").first()
            if db_brief:
                self.overview_brief = OverviewBriefResponse(
                    situationBrief=db_brief.situation_brief,
                    dataFreshness=db_brief.data_freshness,
                    criticalIssues=[CriticalIssueItem(**ci) for ci in (db_brief.critical_issues or [])]
                )
            else:
                self.overview_brief = copy.deepcopy(INITIAL_OVERVIEW_BRIEF)

    @property
    def tasks(self) -> PersistentList:
        return self._tasks

    @tasks.setter
    def tasks(self, new_tasks):
        with SessionLocal() as db:
            current_ids = {t.id for t in new_tasks}
            db.query(DBTask).filter(~DBTask.id.in_(current_ids)).delete(synchronize_session=False)
            db.commit()
        self._tasks = PersistentList(list(new_tasks), on_insert=self._on_task_insert)

    @property
    def meetings(self) -> PersistentList:
        return self._meetings

    @meetings.setter
    def meetings(self, new_meetings):
        self._meetings = PersistentList(list(new_meetings), on_insert=self._on_meeting_insert)

    @property
    def audit_logs(self) -> PersistentList:
        return self._audit_logs

    @audit_logs.setter
    def audit_logs(self, new_logs):
        self._audit_logs = PersistentList(list(new_logs), on_insert=self._on_audit_insert)

    def _on_task_insert(self, item: TaskItem):
        with SessionLocal() as db:
            db_task = DBTask(
                id=item.id,
                title=item.title,
                assignee_name=item.assigneeName,
                deadline=item.deadline,
                source_quote=item.sourceQuote,
                timestamp=item.timestamp,
                status=item.status,
                meeting_title=item.meetingTitle,
                protocol_id=item.protocolId
            )
            db.merge(db_task)
            db.commit()

    def _on_meeting_insert(self, item: MeetingItem):
        with SessionLocal() as db:
            db_meeting = DBMeeting(
                id=item.id,
                title=item.title,
                date=item.date,
                time=item.time,
                duration_minutes=item.durationMinutes,
                participants=item.participants,
                status=item.status,
                agenda=item.agenda,
                open_questions=item.openQuestions,
                protocol_id=item.protocolId
            )
            db.merge(db_meeting)
            db.commit()

    def _on_audit_insert(self, item: AuditLogEntry):
        with SessionLocal() as db:
            db_log = DBAuditLog(
                id=item.id,
                timestamp=item.timestamp,
                user_id=item.userId,
                user_name=item.userName,
                user_role=item.userRole,
                action=item.action,
                target_object=item.targetObject,
                status=item.status,
                details=item.details
            )
            db.merge(db_log)
            db.commit()

    def save_task(self, item: TaskItem):
        self._on_task_insert(item)

    def get_current_user(self) -> UserProfile:
        return self.users.get(self.current_role, self.users.get("ROLE_DIRECTOR", list(self.users.values())[0]))

    def switch_role(self, role: UserRole) -> UserProfile:
        if role in self.users:
            self.current_role = role
        return self.get_current_user()

    def add_audit_log(self, action: str, target: str, status: str, details: str):
        user = self.get_current_user()
        entry = AuditLogEntry(
            id=f"aud-{len(self._audit_logs) + 1}",
            timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            userId=user.id,
            userName=user.name,
            userRole=user.role,
            action=action,
            targetObject=target,
            status=status,
            details=details
        )
        self._audit_logs.insert(0, entry)
        return entry

    def reset_to_default(self):
        from app.db.seed import seed_database
        with SessionLocal() as db:
            from app.db.models import Base
            Base.metadata.drop_all(db.bind)
            Base.metadata.create_all(db.bind)
        seed_database()
        self.current_role = "ROLE_DIRECTOR"
        self.reload_from_db()

storage = PostgresStorage()
