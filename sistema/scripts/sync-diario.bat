@echo off
setlocal EnableDelayedExpansion

rem Obter data atual no formato YYYY-MM-DD
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set CURR_DATE=%datetime:~0,8%

rem Verificar se ultrapassou 31/12/2026 (20261231)
if %CURR_DATE% GTR 20261231 (
    echo [!date! !time!] Rotina expirada em 31/12/2026. >> "%~dp0sync-diario.log"
    exit /b 0
)

echo [!date! !time!] Iniciando sincronizacao diaria da planilha com o banco Supabase... >> "%~dp0sync-diario.log"

cd /d "%~dp0.."
"C:\Program Files\nodejs\node.exe" --env-file=.env.local scripts\importar-planilha.mjs >> "%~dp0sync-diario.log" 2>&1

echo [!date! !time!] Sincronizacao concluida. >> "%~dp0sync-diario.log"
exit /b 0
