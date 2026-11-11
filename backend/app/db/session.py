import logging
from sqlalchemy import create_engine
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
    print(f"PostgreSQL недоступен ({e}). Использование резервной локальной базы SQLite.")
    engine = create_engine(
        "sqlite:///./photoprint.db",
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
    """Создание всех таблиц в БД"""
    Base.metadata.create_all(bind=engine)
