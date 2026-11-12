@echo off
chcp 65001 > nul
echo ========================================================
echo  Запуск Frontend Web / Tauri UI: ООО «Фотопринт»
echo ========================================================

cd /d "%~dp0"
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
