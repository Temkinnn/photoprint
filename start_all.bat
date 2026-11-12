@echo off
chcp 65001 > nul
echo ===================================================================
echo  ООО «Фотопринт» — On-Premise AI-Ассистент Руководителя
echo  Единый запуск локального контура: Backend + Frontend
echo ===================================================================

echo [1/3] Проверка локальной LLM Ollama...
tasklist /FI "IMAGENAME eq ollama.exe" 2>NUL | find /I /N "ollama.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo   [+] Ollama уже запущена в фоновом режиме.
) else (
    echo   [!] Запуск Ollama с моделями на диске D:...
    start "Ollama Engine" cmd /k "set OLLAMA_MODELS=D:\ollama\models && ollama serve"
)

echo [2/3] Запуск Backend API (FastAPI + SQLite/Postgres) на http://127.0.0.1:8000 ...
start "Photoprint Backend API" cmd /k "cd /d %~dp0backend && run_backend.bat"

timeout /t 3 /nobreak > nul

echo [3/3] Запуск Frontend UI (Vite / React 19) на http://127.0.0.1:5173 ...
start "Photoprint Desktop UI" cmd /k "cd /d %~dp0desktop && run_frontend.bat"

timeout /t 3 /nobreak > nul
start http://127.0.0.1:5173

echo ===================================================================
echo  Сервисы запущены!
echo  - Интерфейс руководителя: http://127.0.0.1:5173
echo  - Документация API:       http://127.0.0.1:8000/docs
echo  - Регламенты Word (.docx): %~dp0documents
echo ===================================================================
pause
