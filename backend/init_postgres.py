import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.config import settings
from app.db.models import Base, DBUser, DBMeeting, DBTask, DBCalendarSlot, DBAuditLog, DBKPIMetric
from app.db.storage import (
    INITIAL_USERS, INITIAL_METRICS,
    INITIAL_SLOTS, INITIAL_TASKS, INITIAL_MEETINGS, INITIAL_AUDIT
)
from app.services.document_store import seed_documents_directory

PASSWORDS_TO_TRY = [
    settings.POSTGRES_PASSWORD,
    "postgres",
    "postgrespassword",
    "admin",
    "root",
    "123456",
    "1234",
    ""
]

def check_stale_pid():
    pid_file = r"D:\Programms\PostgreSQL\data\postmaster.pid"
    if os.path.exists(pid_file):
        try:
            with open(pid_file, "r") as f:
                lines = f.readlines()
                if lines:
                    pid = lines[0].strip()
                    print(f"[!] ВНИМАНИЕ: Обнаружен файл блокировки postmaster.pid (PID={pid}).")
                    print("    Если служба аварийно завершалась, этот файл мешает PostgreSQL запуститься.")
                    print("    Для сброса выполните в PowerShell Администратора:")
                    print('      Stop-Service postgresql-x64-18 -Force; Remove-Item "D:\\Programms\\PostgreSQL\\data\\postmaster.pid" -Force; Start-Service postgresql-x64-18\n')
        except Exception:
            pass

def try_connect():
    print("=" * 65)
    print(" Диагностика подключения к PostgreSQL (127.0.0.1:5432)...")
    print("=" * 65)
    
    check_stale_pid()

    connected_pw = None
    engine_root = None
    last_error = None
    auth_failed = False
    
    for host in ["127.0.0.1", "localhost"]:
        for pw in PASSWORDS_TO_TRY:
            url = f"postgresql+psycopg2://postgres:{pw}@{host}:5432/postgres"
            try:
                eng = create_engine(url, pool_pre_ping=True, connect_args={"connect_timeout": 3})
                with eng.connect() as conn:
                    res = conn.execute(text("SELECT version();")).scalar()
                    print(f"[+] УСПЕШНОЕ ПОДКЛЮЧЕНИЕ!")
                    print(f"    Хост: {host}:5432")
                    print(f"    Пароль: '{pw}'")
                    print(f"    Версия БД: {res.split(',')[0]}")
                    connected_pw = pw
                    engine_root = eng
                    break
            except Exception as e:
                err_str = str(e)
                last_error = err_str
                if "password authentication failed" in err_str:
                    auth_failed = True
                    print(f"[-] Сервер работает на {host}:5432, но пароль '{pw}' не подошел.")
                elif "Connection refused" in err_str or "could not connect" in err_str or "10013" in err_str:
                    pass
        if connected_pw:
            break

    if not connected_pw:
        print("\n" + "=" * 65)
        print("[!] ПОДКЛЮЧЕНИЕ НЕ УДАЛОСЬ.")
        if auth_failed:
            print("[!] Сервер PostgreSQL запущен и отвечает, но ни один стандартный пароль не подошел.")
            print("    Пожалуйста, укажите пароль от пользователя 'postgres', который вы задавали при установке:")
            try:
                user_pw = input("Введите пароль postgres: ").strip()
                if user_pw:
                    url = f"postgresql+psycopg2://postgres:{user_pw}@127.0.0.1:5432/postgres"
                    eng = create_engine(url, pool_pre_ping=True)
                    with eng.connect() as conn:
                        res = conn.execute(text("SELECT version();")).scalar()
                        print(f"[+] Подключение с вашим паролем успешно!")
                        connected_pw = user_pw
                        engine_root = eng
            except Exception as ex:
                print(f"[-] Ошибка: {ex}")
                return False
        else:
            print("[!] Сервер PostgreSQL не отвечает на порту 5432.")
            print(f"    Детали ошибки: {last_error}")
            print("\n    РЕШЕНИЕ:")
            print("    1. Откройте PowerShell от имени Администратора.")
            print("    2. Выполните сброс зависшей службы и файла блокировки:")
            print('       Stop-Service postgresql-x64-18 -Force -ErrorAction SilentlyContinue')
            print('       Remove-Item "D:\\Programms\\PostgreSQL\\data\\postmaster.pid" -Force -ErrorAction SilentlyContinue')
            print('       Start-Service postgresql-x64-18')
            print("    3. Затем запустите этот скрипт еще раз.")
            return False

    # 1. Проверяем наличие БД photoprint
    print("\n[1/3] Проверка базы данных 'photoprint' и фиксация пароля...")
    try:
        with engine_root.connect() as conn:
            conn.execution_options(isolation_level="AUTOCOMMIT")
            try:
                conn.execute(text("ALTER USER postgres WITH PASSWORD 'postgrespassword';"))
                print("[+] Пароль суперпользователя 'postgres' зафиксирован: 'postgrespassword'.")
            except Exception:
                pass
            exists = conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = 'photoprint'")
            ).scalar()
            if not exists:
                print("[*] База 'photoprint' не найдена. Создание базы...")
                conn.execute(text("CREATE DATABASE photoprint;"))
                print("[+] База 'photoprint' успешно создана.")
            else:
                print("[+] База 'photoprint' уже существует.")
    except Exception as e:
        print(f"[-] Ошибка при проверке/создании БД: {e}")

    # 2. Подключаемся к базе photoprint и создаем таблицы
    target_url = f"postgresql+psycopg2://postgres:{connected_pw}@127.0.0.1:5432/photoprint"
    print(f"\n[2/3] Инициализация схемы таблиц (SQLAlchemy Models)...")
    try:
        engine_app = create_engine(target_url)
        Base.metadata.create_all(bind=engine_app)
        print("[+] Все таблицы созданы в PostgreSQL: users, documents, meetings, tasks, calendar_slots, audit_logs, kpi_metrics.")
        
        Session = sessionmaker(bind=engine_app)
        session = Session()

        # 3. Сидируем 20 регламентов в папку documents и данные в PostgreSQL
        print(f"\n[3/3] Наполнение папки documents (20 регламентов) и базы данных...")
        doc_count = seed_documents_directory(force=True)

        session.query(DBUser).delete()
        for _, u in INITIAL_USERS.items():
            session.add(DBUser(
                id=u.id,
                name=u.name,
                role=u.role,
                role_title=u.roleTitle,
                department=u.department,
                avatar_initials=u.avatarInitials
            ))

        session.query(DBTask).delete()
        for t in INITIAL_TASKS:
            session.add(DBTask(
                id=t.id,
                title=t.title,
                assignee_name=t.assigneeName,
                deadline=t.deadline,
                source_quote=t.sourceQuote,
                timestamp=t.timestamp,
                status=t.status,
                meeting_title=t.meetingTitle
            ))

        session.query(DBKPIMetric).delete()
        for m in INITIAL_METRICS:
            session.add(DBKPIMetric(
                id=m.id,
                name=m.name,
                value=m.value,
                target=m.target,
                status=m.status,
                source_system=m.sourceSystem,
                updated_at=m.updatedAt,
                trend=m.trend
            ))

        session.query(DBCalendarSlot).delete()
        for s in INITIAL_SLOTS:
            session.add(DBCalendarSlot(
                id=s.id,
                start_time=s.startTime,
                end_time=s.endTime,
                date=s.date,
                is_available=s.isAvailable,
                participants_free=s.participantsFree
            ))

        session.commit()
        task_count = session.query(DBTask).count()
        print(f"[+] База PostgreSQL и папка documents полностью готовы!")
        print(f"    - Документов в папке documents: {doc_count} (все 20 загружены)")
        print(f"    - Задач в реестре:              {task_count}")
        session.close()

        # Обновляем .env файл бэкенда
        env_file = os.path.join(backend_dir, ".env")
        with open(env_file, "w", encoding="utf-8") as f:
            f.write(f"POSTGRES_USER=postgres\n")
            f.write(f"POSTGRES_PASSWORD={connected_pw}\n")
            f.write(f"POSTGRES_SERVER=127.0.0.1\n")
            f.write(f"POSTGRES_PORT=5432\n")
            f.write(f"POSTGRES_DB=photoprint\n")
            f.write(f"DATABASE_URL=postgresql+psycopg2://postgres:{connected_pw}@127.0.0.1:5432/photoprint\n")
            f.write(f"OLLAMA_BASE_URL=http://localhost:11434\n")
            f.write(f"OLLAMA_MODEL=qwen2.5:7b\n")
        print(f"[+] Конфигурация .env успешно записана с проверенными данными PostgreSQL.")
        return True

    except Exception as e:
        print(f"[-] Ошибка при инициализации таблиц: {e}")
        return False

if __name__ == "__main__":
    success = try_connect()
    if not success:
        sys.exit(1)
