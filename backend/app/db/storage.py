import json
import os
import copy
from typing import Dict, List, Optional
from datetime import datetime
from app.schemas import (
    UserProfile, DocumentItem, KPIMetric, CalendarSlot, 
    AuditLogEntry, TaskItem, MeetingItem, UserRole
)

# Начальный эталонный датасет
INITIAL_USERS: Dict[str, UserProfile] = {
    "ROLE_DIRECTOR": UserProfile(
        id="u-1",
        name="Смирнов Алексей Викторович",
        role="ROLE_DIRECTOR",
        roleTitle="Генеральный директор",
        department="Дирекция",
        avatarInitials="АС"
    ),
    "ROLE_PRODUCTION_HEAD": UserProfile(
        id="u-2",
        name="Иванов Игорь Сергеевич",
        role="ROLE_PRODUCTION_HEAD",
        roleTitle="Начальник производства",
        department="Производственный цех",
        avatarInitials="ИИ"
    ),
    "ROLE_SUPPORT_HEAD": UserProfile(
        id="u-3",
        name="Ковалева Елена Дмитриевна",
        role="ROLE_SUPPORT_HEAD",
        roleTitle="Руководитель клиентского сервиса",
        department="Служба заботы picPac.by",
        avatarInitials="ЕК"
    )
}

INITIAL_DOCUMENTS: List[DocumentItem] = [
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
        title="Регламент контроля входного сырья и отбраковки бумаги",
        category="Производство",
        date="2026-07-22",
        minClearance=2,
        summary="Нормы влажности (50±5%), акклиматизации паллет (не менее 24 ч) и критерии брака мелованного слоя.",
        content="Вся поступающая мелованная и дизайнерская бумага должна проходить технологическую выдержку в цехе не менее 24 часов до распаковки паллеты. Рабочая влажность в цехе поддерживается на уровне 50±5%, температура 21±2°C. Партии с короблением краев свыше 3 мм бракуются на входе с оформлением акта рекламации поставщику."
    ),
    DocumentItem(
        id="doc-prod-03",
        title="Инструкция по переналадке термоклеевого биндера Horizon BQ-470",
        category="Производство",
        date="2026-06-10",
        minClearance=2,
        summary="Нормативное время переналадки на фотокниги PUR-клеем — не более 18 минут.",
        content="При переходе с термоклеевого блока (EVA) на полиуретановый клей (PUR) оператор обязан полностью очистить клеевую ванну с использованием смывки Solv-40. Температура нанесения PUR-клея строго 130°C. Нормативное время технологической переналадки — 18 минут."
    ),
    DocumentItem(
        id="doc-prod-04",
        title="Акт расследования технологического сбоя ламинатора Foliant Vega 400",
        category="Производство",
        date="2026-10-28",
        minClearance=2,
        summary="Причина брака партии тиража 1 200 обложек — износ тефлонового вала нагревателя.",
        content="27 октября 2026 года зафиксирован брак тиража фотокниг «Выпускной-Премиум» в количестве 1 200 шт. из-за пузырения глянцевой пленки Soft-touch. Экспертиза установила локальный износ тефлонового покрытия нагревательного цилиндра. Требуется внеплановая замена вала и калибровка датчика температуры."
    ),
    DocumentItem(
        id="doc-prod-05",
        title="План профилактического техобслуживания оборудования на ноябрь 2026",
        category="Производство",
        date="2026-10-25",
        minClearance=2,
        summary="График плановых остановов оборудования перед пиковым новогодним сезоном.",
        content="Плановое ТО: ЦПМ HP Indigo 7900 — 3 ноября (1 сброс, 8 часов); гильотина Polar 92 — 5 ноября (заточка ножей, 4 часа); ламинатор — 7 ноября (замена валов). Запрещены плановые остановки в период с 15 ноября по 31 декабря без личной визы Начальника производства."
    ),
    DocumentItem(
        id="doc-supp-01",
        title="Регламент обработки претензий клиентов мобильного приложения picPac.by",
        category="Клиентский сервис",
        date="2026-09-01",
        minClearance=3,
        summary="SLA первого ответа — до 15 минут. Лимит мгновенной компенсации оператором — 1 500 руб.",
        content="Время первичного ответа в чате поддержки picPac.by не должно превышать 15 минут в рабочее время (8:00 - 22:00). При подтвержденном производственном браке оператор первой линии уполномочен выдать промокод на скидку 100% либо согласовать повторную печать заказа стоимостью до 1 500 руб. без согласования с тимлидом."
    ),
    DocumentItem(
        id="doc-supp-02",
        title="Политика возврата денежных средств и перепечатки брака",
        category="Клиентский сервис",
        date="2026-08-10",
        minClearance=3,
        summary="Срок перепечатки бракованного заказа — до 24 часов с момента подтверждения дефекта.",
        content="При признании брака перепечатка фотопродукции ставится в производственную очередь с наивысшим приоритетом 'Hot Urgent'. Срок изготовления перепечатки — не более 24 часов. Доставка клиенту осуществляется за счет компании экспресс-курьером."
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
        id="m-1",
        name="Выручка за октябрь (план/факт)",
        value="16.4 млн ₽",
        target="16.0 млн ₽",
        status="normal",
        sourceSystem="1С:ERP",
        updatedAt="2026-11-11 09:00",
        trend="up"
    ),
    KPIMetric(
        id="m-2",
        name="Уровень производственного брака",
        value="4.1%",
        target="< 2.5%",
        status="critical",
        sourceSystem="MES / Учет брака",
        updatedAt="2026-11-11 11:30",
        trend="up"
    ),
    KPIMetric(
        id="m-3",
        name="Соблюдение сроков заказов (On-Time Delivery)",
        value="91.2%",
        target="> 96.0%",
        status="warning",
        sourceSystem="picPac.by Tracking",
        updatedAt="2026-11-11 12:00",
        trend="down"
    ),
    KPIMetric(
        id="m-4",
        name="SLA первой реакции поддержки",
        value="8.4 мин",
        target="< 15.0 мин",
        status="normal",
        sourceSystem="HelpDesk CRM",
        updatedAt="2026-11-11 13:15",
        trend="up"
    ),
    KPIMetric(
        id="m-5",
        name="Загрузка основного печатного парка",
        value="94.8%",
        target="85.0%",
        status="critical",
        sourceSystem="SCADA / HP Indigo",
        updatedAt="2026-11-11 13:00",
        trend="up"
    )
]

INITIAL_SLOTS: List[CalendarSlot] = [
    CalendarSlot(id="cs-1", date="2026-11-12", startTime="10:00", endTime="10:45", isAvailable=True, participantsFree=["Смирнов А.В.", "Иванов И.С."]),
    CalendarSlot(id="cs-2", date="2026-11-12", startTime="11:30", endTime="12:15", isAvailable=False, participantsFree=["Ковалева Е.Д."]),
    CalendarSlot(id="cs-3", date="2026-11-12", startTime="14:00", endTime="14:45", isAvailable=True, participantsFree=["Смирнов А.В.", "Иванов И.С.", "Ковалева Е.Д."]),
    CalendarSlot(id="cs-4", date="2026-11-12", startTime="16:00", endTime="16:45", isAvailable=True, participantsFree=["Смирнов А.В.", "Ковалева Е.Д."]),
    CalendarSlot(id="cs-5", date="2026-11-13", startTime="11:00", endTime="11:45", isAvailable=True, participantsFree=["Смирнов А.В.", "Иванов И.С.", "Ковалева Е.Д."])
]

INITIAL_TASKS: List[TaskItem] = [
    TaskItem(
        id="task-101",
        title="Заменить тефлоновый нагревательный вал на ламинаторе Foliant",
        assigneeName="Иванов И.С.",
        deadline="2026-11-13",
        sourceQuote="«Игорь, бери замену вала на себя, к вечеру четверга ламинатор должен работать идеально»",
        status="active",
        meetingTitle="Внеплановое совещание по всплеску брака в цехе"
    ),
    TaskItem(
        id="task-102",
        title="Подготовить служебную записку на лизинг дополнительной ЦПМ Canon V1000",
        assigneeName="Иванов И.С.",
        deadline="2026-11-15",
        sourceQuote="«Нужно формализовать расчет мощности и передать экономистам до 15 ноября»",
        status="active",
        meetingTitle="Внеплановое совещание по всплеску брака в цехе"
    ),
    TaskItem(
        id="task-103",
        title="Внедрить авто-оповещение клиентов picPac о задержке печати тиражей",
        assigneeName="Ковалева Е.Д.",
        deadline="2026-11-14",
        sourceQuote="«Лена, давай пуши в приложение сделаем для тех, чьи заказы задерживаются больше чем на 4 часа»",
        status="active",
        meetingTitle="Разбор клиентских рекламаций picPac.by"
    )
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
        timestamp="2026-11-11 11:32:05",
        userId="u-1",
        userName="Смирнов А.В.",
        userRole="ROLE_DIRECTOR",
        action="VIEW_DOCUMENT",
        targetObject="doc-fin-01 (БДР на Q4 2026)",
        status="success",
        details="Успешный доступ к финансовому отчету (уровень допуска 1)"
    ),
    AuditLogEntry(
        id="aud-2",
        timestamp="2026-11-11 12:05:14",
        userId="u-2",
        userName="Иванов И.С.",
        userRole="ROLE_PRODUCTION_HEAD",
        action="RAG_SEARCH_ATTEMPT",
        targetObject="doc-fin-02 (Сетка окладов руководства)",
        status="blocked",
        details="Отказ в доступе (403 Forbidden). Зафиксирована попытка несанкционированного запроса к закрытым данным."
    ),
    AuditLogEntry(
        id="aud-3",
        timestamp="2026-11-11 13:40:22",
        userId="u-1",
        userName="Смирнов А.В.",
        userRole="ROLE_DIRECTOR",
        action="CONFIRM_TASK_CREATION",
        targetObject="task-101",
        status="success",
        details="Руководитель подтвердил создание задачи из протокола встречи"
    )
]

class MemoryStorage:
    def __init__(self):
        self.reset_to_default()

    def reset_to_default(self):
        self.current_role: UserRole = "ROLE_DIRECTOR"
        self.users: Dict[str, UserProfile] = copy.deepcopy(INITIAL_USERS)
        self.documents: List[DocumentItem] = copy.deepcopy(INITIAL_DOCUMENTS)
        self.metrics: List[KPIMetric] = copy.deepcopy(INITIAL_METRICS)
        self.slots: List[CalendarSlot] = copy.deepcopy(INITIAL_SLOTS)
        self.tasks: List[TaskItem] = copy.deepcopy(INITIAL_TASKS)
        self.meetings: List[MeetingItem] = copy.deepcopy(INITIAL_MEETINGS)
        self.audit_logs: List[AuditLogEntry] = copy.deepcopy(INITIAL_AUDIT)

    def get_current_user(self) -> UserProfile:
        return self.users.get(self.current_role, self.users["ROLE_DIRECTOR"])

    def switch_role(self, role: UserRole) -> UserProfile:
        if role in self.users:
            self.current_role = role
        return self.get_current_user()

    def add_audit_log(self, action: str, target: str, status: str, details: str):
        user = self.get_current_user()
        entry = AuditLogEntry(
            id=f"aud-{len(self.audit_logs) + 1}",
            timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            userId=user.id,
            userName=user.name,
            userRole=user.role,
            action=action,
            targetObject=target,
            status=status,
            details=details
        )
        self.audit_logs.insert(0, entry)
        return entry

storage = MemoryStorage()
