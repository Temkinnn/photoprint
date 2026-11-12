import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.db.seed import seed_database
from app.routers import auth, documents, meetings, tasks, rag, overview, system

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Автоматическая инициализация и сидирование БД при старте
    seed_database()
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API для On-Premise AI-ассистента руководителя ООО «Фотопринт» (Трек 3)",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Middleware для связи с фронтендом Tauri и Web UI
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключение маршрутизаторов
app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(meetings.router, prefix=settings.API_V1_PREFIX)
app.include_router(tasks.router, prefix=settings.API_V1_PREFIX)
app.include_router(rag.router, prefix=settings.API_V1_PREFIX)
app.include_router(documents.router, prefix=settings.API_V1_PREFIX)
app.include_router(overview.router, prefix=settings.API_V1_PREFIX)
app.include_router(system.router, prefix=settings.API_V1_PREFIX)

@app.get("/")
async def root():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "docs_url": "/docs",
        "database": settings.DATABASE_URL.split("@")[-1] if "@" in settings.DATABASE_URL else "local",
        "version": "1.0.0"
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.BACKEND_HOST,
        port=settings.BACKEND_PORT,
        reload=True
    )
