@echo off
cd /d "%~dp0"

set "API_URL="
if exist ".env" (
    for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
        if /i "%%A"=="VITE_API_BASE_URL" set "API_URL=%%B"
    )
)

if "%API_URL%"=="" goto :ask_url

set "API_URL=%API_URL:"=%"
set "API_URL=%API_URL: =%"
if "%API_URL:~-1%"=="/" set "API_URL=%API_URL:~0,-1%"

echo [i] Checking saved URL: %API_URL%
set "HTTP_CODE=000"
for /f %%C in ('curl -s -o nul -w "%%{http_code}" --max-time 4 "%API_URL%/api/v1/system/revision" 2^>nul') do set "HTTP_CODE=%%C"

if "%HTTP_CODE%"=="200" (
    echo [OK] Server is online!
    goto :run_vite
)

echo [!] Saved URL did not respond (HTTP %HTTP_CODE%).

:ask_url
echo.
set "NEW_URL="
set /p NEW_URL="Paste server URL (or press Enter for http://127.0.0.1:8000): "
if "%NEW_URL%"=="" set "NEW_URL=http://127.0.0.1:8000"

set "NEW_URL=%NEW_URL:"=%"
set "NEW_URL=%NEW_URL: =%"
if "%NEW_URL:~-1%"=="/" set "NEW_URL=%NEW_URL:~0,-1%"
set "API_URL=%NEW_URL%"

> ".env" echo VITE_API_BASE_URL=%API_URL%
echo [i] Saved to desktop\.env: %API_URL%

echo %API_URL% | findstr /I "loca.lt" >nul
if not errorlevel 1 (
    echo.
    echo [!] Opening localtunnel in browser...
    echo [!] Click "Click to Continue" in browser, then press any key here.
    start "" "%API_URL%"
    pause >nul
)

:run_vite
set "VITE_API_BASE_URL=%API_URL%"
echo.
echo [i] Starting Frontend with API: %VITE_API_BASE_URL%
echo --------------------------------------------------------

if exist "bun.lock" (
    where bun >nul 2>nul && (
        bun run dev
        goto :eof
    )
)
npm run dev
pause