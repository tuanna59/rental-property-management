$ErrorActionPreference = "Stop"

$taskName = "RentalHouse Production Backup"
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if ($null -eq $task) {
    Write-Host "Scheduled task is not installed: $taskName"
    exit 0
}

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
Write-Host "Scheduled task removed: $taskName"
Write-Host "Existing production backup files were not changed."
