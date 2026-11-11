import os
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    PROJECT_NAME: str = "Photoprint Executive AI Assistant"
    API_V1_PREFIX: str = "/api/v1"
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000
    
    # Database (PostgreSQL 16 / 18)
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "postgrespassword")
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "localhost")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "photoprint")

    @property
    def DATABASE_URL(self) -> str:
        env_url = os.getenv("DATABASE_URL")
        if env_url:
            return env_url
            
        # If unix socket exists in /tmp, prefer connecting via socket
        if os.path.exists("/tmp/.s.PGSQL.5432") and self.POSTGRES_SERVER in ("localhost", "127.0.0.1", ""):
            return f"postgresql+psycopg2://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@/{self.POSTGRES_DB}?host=/tmp"

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
    
    # AI Server (Developer 2 remote GPU: Whisper + Qwen 2.5)
    AI_SERVER_URL: str = os.getenv("AI_SERVER_URL", "https://mighty-bikes-hammer.loca.lt")
    AI_SERVER_BYPASS_HEADER: str = "true"

    # AI / Ollama configuration (local fallback)
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")
    OLLAMA_EMBED_MODEL: str = os.getenv("OLLAMA_EMBED_MODEL", "bge-m3")
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "tauri://localhost",
        "http://tauri.localhost",
        "*"
    ]

    class Config:
        case_sensitive = True

settings = Settings()
