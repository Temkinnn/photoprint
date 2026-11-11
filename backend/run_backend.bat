@echo off
chcp 65001 > nul
echo ========================================================
echo  Запуск Backend API: ООО «Фотопринт» AI-Ассистент
echo ========================================================

where py >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    set PY_CMD=py -3.12
) else (
    set PY_CMD=python
)

if not exist .venv (
    echo [1/3] Создание виртуального окружения .venv...
    %PY_CMD% -m venv .venv
)

echo [2/3] Активация окружения и проверка зависимостей...
call .venv\Scripts\activate
pip install -r requirements.txt --quiet

echo [3/3] Старт сервера FastAPI на http://localhost:8000...
echo Интерактивная документация Swagger: http://localhost:8000/docs
python main.py
pause
