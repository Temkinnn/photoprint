@echo off
chcp 65001 > nul
echo ========================================================
echo  Запуск Backend API: ООО «Фотопринт» AI-Ассистент
echo ========================================================

cd /d "%~dp0"

if exist "..\.venv\Scripts\activate.bat" (
    call "..\.venv\Scripts\activate.bat"
) else if exist ".venv\Scripts\activate.bat" (
    call ".venv\Scripts\activate.bat"
) else (
    echo [!] Виртуальное окружение не найдено в корне! Запуск системным python...
)

set PYTHONPATH=.
echo [i] База данных и Ollama URL читаются из backend\.env (по умолчанию PostgreSQL / http://localhost:11434)
echo [i] Сервер FastAPI запускается на http://127.0.0.1:8000
echo [i] Swagger Docs: http://127.0.0.1:8000/docs
echo --------------------------------------------------------

python main.py
pause
