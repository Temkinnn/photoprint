@echo off
chcp 65001 > nul
echo ===================================================================
echo  Перезапуск и инициализация PostgreSQL (ООО «Фотопринт»)
echo ===================================================================

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Требуются права Администратора!
    echo Запустите этот файл правой кнопкой мыши -> "Запуск от имени администратора"
    echo или выполните в PowerShell Администратора:
    echo     Restart-Service postgresql-x64-18
    echo.
) else (
    echo [*] Перезапуск службы postgresql-x64-18 с обновленным конфигом trust...
    powershell -NoProfile -Command "Restart-Service postgresql-x64-18 -Force"
)

echo.
echo [*] Инициализация БД 'photoprint' и наполнение 20 регламентами...
cd /d "%~dp0backend"
if exist "..\.venv\Scripts\activate.bat" call "..\.venv\Scripts\activate.bat"
python init_postgres.py

pause
