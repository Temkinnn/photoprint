@echo off
chcp 65001 > nul
echo ========================================================
echo  Запуск Frontend Web / Tauri UI: ООО «Фотопринт»
echo ========================================================

cd /d "%~dp0"

set "API_URL="
echo.
echo Вставьте ссылку на сервер (например, https://xxxx.loca.lt)
echo или нажмите Enter для локального запуска (http://127.0.0.1:8000):
set /p API_URL="> "

:: Если нажали просто Enter — используем локальный бэкенд
if "%API_URL%"=="" set "API_URL=http://127.0.0.1:8000"

:: Убираем случайные кавычки, пробелы и слэш в конце ссылки
set "API_URL=%API_URL:"=%"
set "API_URL=%API_URL: =%"
if "%API_URL:~-1%"=="/" set "API_URL=%API_URL:~0,-1%"

:: Автоматический обход заглушки localtunnel
echo %API_URL% | findstr /I "loca.lt" >nul
if not errorlevel 1 (
    echo.
    echo [!] Обнаружен localtunnel. Открываю ссылку в браузере...
    echo [!] Нажмите синюю кнопку "Click to Continue" на открывшейся странице,
    echo     затем вернитесь в это окно и нажмите любую клавишу.
    start "" "%API_URL%"
    pause >nul
)

set "VITE_API_BASE_URL=%API_URL%"

echo.
echo [i] Подключение к Backend API: %VITE_API_BASE_URL%
echo [i] Запуск Vite dev-сервера на http://127.0.0.1:1420 ...
echo --------------------------------------------------------

if exist "bun.lock" (
    where bun >nul 2>nul && (
        bun run dev
        goto :eof
    )
)
npm run dev
pause