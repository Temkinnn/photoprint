import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings
from typing import List

# Автозагрузка .env файла бэкенда
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(backend_dir, ".env")
load_dotenv(ENV_PATH)

class Settings(BaseSettings):
    PROJECT_NAME: str = "Photoprint Executive AI Assistant"
    API_V1_PREFIX: str = "/api/v1"
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000
    
    # Database (PostgreSQL 16/18)
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "postgrespassword")
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "127.0.0.1")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "photoprint")

    @property
    def DATABASE_URL(self) -> str:
        env_url = os.getenv("DATABASE_URL")
        if env_url:
            return env_url
        from sqlalchemy.engine import URL
        url_obj = URL.create(
            drivername="postgresql+psycopg2",
            username=self.POSTGRES_USER,
            password=self.POSTGRES_PASSWORD,
            host=self.POSTGRES_SERVER,
            port=int(self.POSTGRES_PORT),
            database=self.POSTGRES_DB
        )
        return url_obj.render_as_string(hide_password=False)
    
    # AI / Ollama & Remote AI Server configuration
    AI_SERVER_URL: str = os.getenv("AI_SERVER_URL", "")
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")
    OLLAMA_EMBED_MODEL: str = os.getenv("OLLAMA_EMBED_MODEL", "bge-m3")
    OLLAMA_TIMEOUT_SECONDS: float = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "60.0"))
    ALLOW_FALLBACK: bool = os.getenv("ALLOW_FALLBACK", "false").lower() == "true"
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:1420",
        "http://127.0.0.1:1420",
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "tauri://localhost",
        "http://tauri.localhost",
        "*"
    ]

    class Config:
        case_sensitive = True
        env_file = ENV_PATH
        extra = "allow"

settings = Settings()
