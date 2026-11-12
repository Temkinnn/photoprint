import logging
import os
from sqlalchemy import create_engine, inspect, text
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
        print(f"Успешное подключение к PostgreSQL: {settings.POSTGRES_SERVER}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}")
except Exception as e:
    backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    db_file = os.path.join(backend_dir, "photoprint.db")
    print(f"PostgreSQL недоступен. Использование резервной локальной базы SQLite: {db_file}")
    engine = create_engine(
        f"sqlite:///{db_file}",
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
    """Создание всех таблиц в БД и безопасное добавление недостающих колонок."""
    Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)
    if "protocols" in inspector.get_table_names():
        existing_cols = {col["name"] for col in inspector.get_columns("protocols")}
        is_pg = engine.dialect.name == "postgresql"
        extra_cols = {
            "meeting_id": "VARCHAR(64)",
            "transcript_text": "TEXT DEFAULT ''",
            "open_questions": "JSON DEFAULT '[]'::json" if is_pg else "TEXT DEFAULT '[]'",
            "processing_time_sec": "DOUBLE PRECISION" if is_pg else "REAL",
        }
        with engine.begin() as conn:
            for col_name, col_type in extra_cols.items():
                if col_name not in existing_cols:
                    conn.execute(text(f"ALTER TABLE protocols ADD COLUMN {col_name} {col_type}"))
