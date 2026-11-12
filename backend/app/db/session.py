import logging
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from app.config import settings
from app.db.models import Base

logger = logging.getLogger(__name__)

# Попытка подключиться к PostgreSQL
try:
    engine = create_engine(
        settings.DATABASE_URL,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20
    )
    with engine.connect() as conn:
        logger.info(f"Успешное подключение к PostgreSQL: {settings.POSTGRES_DB}")
        print(f"Успешное подключение к PostgreSQL: {settings.POSTGRES_DB}")
except Exception as e:
    print(f"PostgreSQL ошибка подключения: {e}")
    backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    db_file = os.path.join(backend_dir, "photoprint.db")
    print(f"PostgreSQL недоступен. Использование резервной локальной базы SQLite: {db_file}")
    sqlite_url = f"sqlite:///{db_file.replace(os.sep, '/')}"
    engine = create_engine(
        sqlite_url,
        connect_args={"check_same_thread": False}
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_tables():
    """Создание всех таблиц в БД и автомиграция недостающих колонок"""
    Base.metadata.create_all(bind=engine)
    try:
        with engine.begin() as conn:
            if conn.dialect.name == "postgresql":
                conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS clearance VARCHAR(128);"))
                conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS description TEXT;"))
                conn.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS min_clearance INTEGER DEFAULT 3;"))
                conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS meeting_title VARCHAR(512);"))
                conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS protocol_id VARCHAR(64);"))
    except Exception as e:
        logger.warning(f"Миграция колонок: {e}")
