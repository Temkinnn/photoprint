# Backend API — On-Premise AI-ассистент руководителя ООО «Фотопринт» (Трек 3)

Серверная часть корпоративного ассистента руководителя.
- **Python**: `3.12.10`
- **База данных**: `PostgreSQL` (без SQLite, строго реляционная СУБД с полной схемой)
- **Фреймворк**: `FastAPI` + `SQLAlchemy 2.0` (через нативный `psycopg2` / `libpq`)
- **Функционал**: ролевой доступ (RBAC), журнал аудита действий, управление встречами, протоколами и расшифровками, Human-in-the-Loop согласование задач, RAG-поиск по регламентам.

---

## 🛠 Требования к окружению
- **Python**: `3.12.10` (зафиксирован в `runtime.txt`, `.python-version`, `pyproject.toml`)
- **СУБД**: `PostgreSQL 16+` (локальный демон или Docker Compose)

---

## 🚀 Быстрый запуск

### Вариант 1: Docker Compose (рекомендуемый для развертывания)
```bash
cd backend
docker-compose up -d --build
```

### Вариант 2: Локальный запуск (Linux)
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

### Вариант 3: Windows
Двойной клик на `run_backend.bat` или вручную:
```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

После старта сервер доступен по адресу:
* API: `http://localhost:8000`
* Интерактивная документация Swagger: `http://localhost:8000/docs`

---

## 📡 Реализованные API Эндпоинты

### 1. Аутентификация и Роли (`/api/v1/auth`)
* `GET /api/v1/auth/me` — текущий профиль пользователя и его права.
* `POST /api/v1/auth/switch-role` — безопасное переключение между ролями (Гендиректор, Начальник производства, Сервис заботы).

### 2. Встречи и Календарь (`/api/v1/meetings`)
* `GET /api/v1/meetings/` — реестр прошедших и запланированных встреч.
* `GET /api/v1/meetings/calendar/slots` — доступные временные слоты календаря.
* `POST /api/v1/meetings/create` — создание встречи после явного утверждения пользователем.
* `POST /api/v1/meetings/analyze-transcript` — анализ расшифровки встречи локальной LLM (Qwen 2.5): выделение решений (resolved/proposed/discussed/needs_clarification), рисков и задач.
* `POST /api/v1/meetings/confirm-tasks` — утверждение задач в реестр (Human-in-the-Loop).

### 3. Реестр Задач (`/api/v1/tasks`)
* `GET /api/v1/tasks/` — список задач с исполнителями, дедлайнами и основаниями.
* `PATCH /api/v1/tasks/{id}` — обновление статуса, исполнителя или срока.
* `DELETE /api/v1/tasks/{id}` — удаление задачи.

### 4. База знаний и RAG (`/api/v1/rag`)
* `GET /api/v1/rag/documents` — список документов, разрешенных текущей роли.
* `POST /api/v1/rag/query` — вопросно-ответная система по регламентам с обязательным цитированием (AI-01) и защитой от несанкционированного доступа (AI-02).

### 5. Обзор и Аудит (`/api/v1/overview`)
* `GET /api/v1/overview/metrics` — оперативные KPI компании (выручка, брак, SLA, мощности).
* `GET /api/v1/overview/audit` — журнал аудита действий и инцидентов безопасности.

### 6. Системные функции (`/api/v1/system`)
* `POST /api/v1/system/reset-demo` — сброс состояния стенда к начальным эталонным данным.
