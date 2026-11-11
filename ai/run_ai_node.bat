@echo off
chcp 65001 > nul
title Photoprint AI Node (Whisper + Ollama + Tunnel)

echo ===================================================================
echo  ООО «Фотопринт» — AI-Узел для команды (Whisper + Qwen 2.5)
echo ===================================================================

echo [1/3] Проверка локальной нейросети Ollama...
tasklist /FI "IMAGENAME eq ollama.exe" 2>NUL | find /I /N "ollama.exe" >NUL
if "%ERRORLEVEL%"=="0" (
    echo   [+] Ollama уже активна в фоновом режиме.
) else (
    echo   [!] Запуск Ollama в отдельном окне...
    start "Ollama AI Engine" cmd /k "set OLLAMA_MODELS=D:\ollama\models&& set OLLAMA_HOST=0.0.0.0:11434&& ollama serve"
    timeout /t 3 /nobreak > nul
)

echo [2/3] Запуск AI-сервера распознавания и аналитики (порт 8001)...
cd /d "%~dp0"
start "PhotoPrint AI Server (Port 8001)" cmd /k "cd /d %~dp0 && call ..\.venv\Scripts\activate.bat && set PYTHONPATH=. && python server.py"

timeout /t 3 /nobreak > nul

echo [3/3] Поднятие публичного туннеля для команды (localtunnel)...
echo -------------------------------------------------------------------
echo  Сейчас ниже появится публичная ссылка вида:
echo    your url is: https://xxxx.loca.lt
echo  Эту ссылку скопируй и отправь двум остальным разработчикам!
echo -------------------------------------------------------------------
npx localtunnel --port 8001
pause
