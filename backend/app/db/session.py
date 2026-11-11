import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.config import settings
from app.db.models import Base

logger = logging.getLogger(__name__)

# Строгое подключение к PostgreSQL (SQLite полностью исключена)
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
    err_msg = f"КРИТИЧЕСКАЯ ОШИБКА: PostgreSQL недоступен ({e}). Работа без PostgreSQL запрещена!"
    logger.error(err_msg)
    print(err_msg)
    raise RuntimeError(err_msg) from e

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_tables():
    """Создание всех таблиц в PostgreSQL"""
    Base.metadata.create_all(bind=engine)
