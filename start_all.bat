@echo off
chcp 65001 > nul
echo ===================================================================
echo  ООО «Фотопринт» — On-Premise AI-Ассистент Руководителя
echo  Единый запуск локального контура: Backend + Frontend
echo ===================================================================

echo [1/2] Запуск Backend API (FastAPI + PostgreSQL/SQLite) на http://127.0.0.1:8000 ...
start "Photoprint Backend API" cmd /k "cd /d %~dp0backend && run_backend.bat"

timeout /t 3 /nobreak > nul

echo [2/2] Запуск Frontend UI (Vite / React 19) на http://127.0.0.1:1420 ...
start "Photoprint Desktop UI" cmd /k "cd /d %~dp0desktop && run_frontend.bat"

timeout /t 3 /nobreak > nul
start http://127.0.0.1:1420

echo ===================================================================
echo  Сервисы запущены!
echo  - Интерфейс руководителя: http://127.0.0.1:1420
echo  - Документация API:       http://127.0.0.1:8000/docs
echo  - Проверка AI / LLM:      http://127.0.0.1:8000/api/v1/system/ai-status
echo  - Регламенты Word (.docx): %~dp0documents
echo ===================================================================
pause
