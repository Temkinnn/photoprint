@echo off
cd /d "%~dp0"

echo ===================================================================
echo  PhotoPrint - AI Server + Localtunnel Launcher
echo ===================================================================

:: 1. Проверка наличия Node.js (нужен для работы Localtunnel)
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is NOT installed on this PC!
    echo         Localtunnel requires Node.js to create a public URL.
    echo.
    echo         To install Node.js, run this command in PowerShell/CMD:
    echo           winget install OpenJS.NodeJS.LTS
    echo.
    echo         After installation, restart this script.
    pause
    exit /b 1
)

where npx >nul 2>nul
if errorlevel 1 (
    echo [ERROR] npx not found! Check your Node.js installation and PATH.
    pause
    exit /b 1
)

:: 2. Перезапуск Ollama с поддержкой 2 параллельных запросов Qwen 2.5
set "OLLAMA_NUM_PARALLEL=2"
set "OLLAMA_MAX_LOADED_MODELS=1"

where ollama >nul 2>nul
if %errorlevel% equ 0 (
    echo [1/3] Restarting Ollama server with OLLAMA_NUM_PARALLEL=2...
    taskkill /F /IM ollama.exe >nul 2>&1
    timeout /t 2 /nobreak >nul
    start "Ollama Server" /min cmd /c "ollama serve"
    timeout /t 3 /nobreak >nul
) else (
    echo [!] Ollama not found in PATH. Make sure Ollama app is running!
)

:: 3. Очистка порта 8001 от зависших процессов и запуск AI-сервера
for /f "tokens=5" %%a in ('netstat -aon ^| find ":8001" ^| find "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

set "PY_EXE=python"
if exist "..\.venv\Scripts\python.exe" set "PY_EXE=%~dp0..\.venv\Scripts\python.exe"
if exist ".venv\Scripts\python.exe" set "PY_EXE=%~dp0.venv\Scripts\python.exe"

echo [2/3] Starting AI & STT Server on port 8001...
start "PhotoPrint AI Server (8001)" cmd /k "cd /d %~dp0 && "%PY_EXE%" server.py"

timeout /t 3 /nobreak >nul

:: 4. Запуск Localtunnel с привязкой к IPv4 127.0.0.1
echo [3/3] Opening Localtunnel window for http://127.0.0.1:8001 ...
start "PhotoPrint Localtunnel" cmd /k "npx --yes localtunnel --port 8001 --local-host 127.0.0.1"