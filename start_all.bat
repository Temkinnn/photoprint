@echo off
chcp 65001 > nul
echo ========================================================
echo  Запуск комплекса ООО «Фотопринт» (Backend + Tunnel + UI)
echo ========================================================

cd /d "%~dp0"

:: 1. Запуск Backend API (:8000)
if exist "backend\run_backend.bat" (
    start "Photoprint Backend API (:8000)" /D "%~dp0backend" cmd /k call run_backend.bat
) else if exist "run_backend.bat" (
    start "Photoprint Backend API (:8000)" /D "%~dp0" cmd /k call run_backend.bat
)

:: Пауза 2 секунды, чтобы FastAPI успел занять порт 8000
timeout /t 2 /nobreak > nul

:: 2. Запуск туннеля для второго ноутбука (:8000 -> internet)
if exist "start_tunnel.bat" (
    start "Photoprint Tunnel (:8000)" /D "%~dp0" cmd /k call start_tunnel.bat
) else (
    start "Photoprint Tunnel (:8000)" /D "%~dp0" cmd /k npx localtunnel --port 8000 --local-host 127.0.0.1
)

:: 3. Запуск Frontend UI (:1420) с локальным подключением к :8000
set "VITE_API_BASE_URL=http://127.0.0.1:8000"
if exist "desktop\run_frontend.bat" (
    start "Photoprint Frontend UI (:1420)" /D "%~dp0desktop" cmd /k call run_frontend.bat
) else if exist "run_frontend.bat" (
    start "Photoprint Frontend UI (:1420)" /D "%~dp0" cmd /k call run_frontend.bat
)

echo.
echo [OK] Запущены 3 окна:
echo      1. Backend API (:8000)
echo      2. Tunnel (скопируйте из него ссылку https://....loca.lt для второго ПК)
echo      3. Frontend UI (:1420)
echo.