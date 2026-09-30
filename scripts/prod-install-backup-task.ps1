$ErrorActionPreference = "Stop"

$taskName = "RentalHouse Production Backup"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runnerPath = (Resolve-Path (Join-Path $PSScriptRoot "prod-scheduled-backup.ps1")).Path
$powerShellPath = (Get-Process -Id $PID).Path
$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent().Name

if ([string]::IsNullOrWhiteSpace($currentUser)) {
    throw "Unable to determine the current Windows user."
}

$actionArguments = '-NoProfile -ExecutionPolicy Bypass -File "{0}"' -f $runnerPath
$action = New-ScheduledTaskAction `
    -Execute $powerShellPath `
    -Argument $actionArguments `
    -WorkingDirectory $repoRoot

$trigger = New-ScheduledTaskTrigger -Daily -At ([DateTime]::Today.AddHours(2))
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Hours 6) `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries

# Interactive logon keeps the task in the same user context that normally owns
# the Docker Desktop engine. The task therefore runs when that user is logged on.
$principal = New-ScheduledTaskPrincipal `
    -UserId $currentUser `
    -LogonType Interactive `
    -RunLevel Limited

$task = New-ScheduledTask `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal

Register-ScheduledTask -TaskName $taskName -InputObject $task -Force | Out-Null

Write-Host "Production backup scheduled task installed."
Write-Host "Task: $taskName"
Write-Host "Schedule: daily at 02:00 local time"
Write-Host "Run missed task as soon as possible: enabled"
Write-Host "Overlapping runs: ignored"
Write-Host "User: $currentUser"
