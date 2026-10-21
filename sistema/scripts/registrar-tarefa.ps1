$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$batPath = Join-Path $scriptDir "sync-diario.bat"

$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$batPath`""
$trigger = New-ScheduledTaskTrigger -Daily -At 8:00AM
$trigger.EndBoundary = "2026-12-31T23:59:59"
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName "NNOS_Sync_Planilha_Diaria" `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Sincronizacao diaria da planilha com banco de dados Supabase todos os dias as 08:00 ate 31/12/2026" `
  -Force

Get-ScheduledTask -TaskName "NNOS_Sync_Planilha_Diaria" | Select-Object TaskName, State
