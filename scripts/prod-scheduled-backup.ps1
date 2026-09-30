$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "prod-common.ps1")

$defaultBackupPath = "C:/RentalHouseData/prod/backups"
$defaultRetentionDays = 30
$backupScript = Join-Path $PSScriptRoot "prod-backup.ps1"
$verifyScript = Join-Path $PSScriptRoot "prod-verify-backup.ps1"
$logFile = $null
$lockFile = $null
$lockStream = $null

function Resolve-ProductionPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $expanded = [Environment]::ExpandEnvironmentVariables($Path)
    if ([IO.Path]::IsPathRooted($expanded)) {
        return [IO.Path]::GetFullPath($expanded)
    }

    return [IO.Path]::GetFullPath((Join-Path $script:ProdRepoRoot $expanded))
}


function Test-PathIsInside {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ChildPath,

        [Parameter(Mandatory = $true)]
        [string]$ParentPath
    )

    $trimChars = @([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
    $child = [IO.Path]::GetFullPath($ChildPath).TrimEnd($trimChars)
    $parent = [IO.Path]::GetFullPath($ParentPath).TrimEnd($trimChars)

    if ($child.Equals($parent, [StringComparison]::OrdinalIgnoreCase)) {
        return $true
    }

    $prefix = $parent + [IO.Path]::DirectorySeparatorChar
    return $child.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)
}

function Write-RunLog {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Message
    )

    $timestamp = [DateTimeOffset]::Now.ToString("o")
    if ($script:logFile) {
        Add-Content -LiteralPath $script:logFile -Value "$timestamp $Message" -Encoding UTF8
    }
}

function Get-ScheduledRetentionDays {
    $rawValue = Get-OptionalProductionEnvValue `
        -Name "PROD_SCHEDULED_BACKUP_RETENTION_DAYS" `
        -DefaultValue ([string]$script:defaultRetentionDays)

    $retentionDays = 0
    if (-not [int]::TryParse($rawValue, [ref]$retentionDays) -or $retentionDays -lt 1) {
        throw "PROD_SCHEDULED_BACKUP_RETENTION_DAYS must be a positive integer."
    }

    return $retentionDays
}

function Acquire-ScheduledBackupLock {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    try {
        return [IO.File]::Open(
            $Path,
            [IO.FileMode]::OpenOrCreate,
            [IO.FileAccess]::ReadWrite,
            [IO.FileShare]::None
        )
    }
    catch {
        throw "Another scheduled production backup is already running."
    }
}

function Invoke-BackupVerification {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BackupPath
    )

    # Run verification in a child PowerShell process because the verifier uses
    # explicit exit codes. Do not invoke it directly into the pipeline: child
    # stdout would become part of this function's return value and make
    # $verificationExitCode an array of output lines plus the exit code.
    # Start-Process keeps verifier output attached to this console while giving
    # us one unambiguous process ExitCode.
    $powerShellPath = (Get-Process -Id $PID).Path
    if ([string]::IsNullOrWhiteSpace($powerShellPath)) {
        throw "Unable to determine the current PowerShell executable."
    }

    $arguments = '-NoProfile -ExecutionPolicy Bypass -File "{0}" "{1}"' -f `
        $script:verifyScript.Replace('"', '\"'), `
        $BackupPath.Replace('"', '\"')

    $process = Start-Process `
        -FilePath $powerShellPath `
        -ArgumentList $arguments `
        -NoNewWindow `
        -Wait `
        -PassThru

    return [int]$process.ExitCode
}

function Remove-ExpiredScheduledBackups {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ScheduledRoot,

        [Parameter(Mandatory = $true)]
        [int]$RetentionDays
    )

    if (-not (Test-Path -LiteralPath $ScheduledRoot -PathType Container)) {
        return 0
    }

    $root = [IO.Path]::GetFullPath($ScheduledRoot).TrimEnd(
        [IO.Path]::DirectorySeparatorChar,
        [IO.Path]::AltDirectorySeparatorChar
    )
    $rootPrefix = $root + [IO.Path]::DirectorySeparatorChar
    $cutoff = (Get-Date).AddDays(-$RetentionDays)
    $removed = 0

    foreach ($directory in (Get-ChildItem -LiteralPath $root -Directory -Force)) {
        if ($directory.Name -notmatch '^\d{4}-\d{2}-\d{2}_\d{6}(?:-\d{2})?$') {
            continue
        }

        if (($directory.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            continue
        }

        $fullPath = [IO.Path]::GetFullPath($directory.FullName)
        if (-not $fullPath.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
            continue
        }

        try {
            $createdAt = [DateTime]::ParseExact(
                $directory.Name.Substring(0, 17),
                "yyyy-MM-dd_HHmmss",
                [Globalization.CultureInfo]::InvariantCulture,
                [Globalization.DateTimeStyles]::None
            )
        }
        catch {
            continue
        }

        if ($createdAt -lt $cutoff) {
            Remove-Item -LiteralPath $fullPath -Recurse -Force
            $removed++
        }
    }

    return $removed
}

$exitCode = 1

try {
    if (-not (Test-Path -LiteralPath $script:ProdEnvFile -PathType Leaf)) {
        throw "Missing .env.production. Copy .env.production.example and configure it first."
    }
    if (-not (Test-Path -LiteralPath $backupScript -PathType Leaf)) {
        throw "Missing scripts/prod-backup.ps1."
    }
    if (-not (Test-Path -LiteralPath $verifyScript -PathType Leaf)) {
        throw "Missing scripts/prod-verify-backup.ps1."
    }

    Assert-ProductionConfiguration

    $uploadsPath = Resolve-ProductionPath -Path (Get-ProductionEnvValue -Name "PROD_UPLOADS_PATH")
    $backupRoot = Resolve-ProductionPath -Path (Get-OptionalProductionEnvValue `
        -Name "PROD_BACKUP_PATH" `
        -DefaultValue $defaultBackupPath)

    if (Test-PathIsInside -ChildPath $backupRoot -ParentPath $uploadsPath) {
        throw "PROD_BACKUP_PATH must not be the production uploads directory or a child of it."
    }

    $scheduledRoot = Join-Path $backupRoot "scheduled"
    $logsRoot = Join-Path $backupRoot "logs"

    New-Item -ItemType Directory -Path $logsRoot -Force | Out-Null
    $logFile = Join-Path $logsRoot "scheduled-backup.log"
    $lockFile = Join-Path $logsRoot "scheduled-backup.lock"
    $lockStream = Acquire-ScheduledBackupLock -Path $lockFile

    $retentionDays = Get-ScheduledRetentionDays

    Write-Host "Scheduled production backup"
    Write-Host ""
    Write-RunLog -Message "Scheduled backup started."

    Write-Host "Creating backup..."
    $backupOutput = @(& $backupScript -BackupType Scheduled -PassThru)
    $backupPath = [string]($backupOutput | Select-Object -Last 1)
    $backupPath = $backupPath.Trim()

    if ([string]::IsNullOrWhiteSpace($backupPath) -or
        -not (Test-Path -LiteralPath $backupPath -PathType Container)) {
        throw "Scheduled backup did not return a completed backup directory."
    }

    Write-Host "Backup: OK"
    Write-Host ""
    Write-Host "Path:"
    Write-Host $backupPath
    Write-RunLog -Message "Backup created: $backupPath"

    Write-Host ""
    Write-Host "Verifying backup..."
    $verificationExitCode = Invoke-BackupVerification -BackupPath $backupPath
    if ($verificationExitCode -ne 0) {
        Write-RunLog -Message "Verification FAILED for backup: $backupPath"
        throw "Scheduled backup verification failed. Retention was not applied."
    }

    Write-Host "Verification: PASSED"
    Write-RunLog -Message "Verification PASSED for backup: $backupPath"

    Write-Host ""
    Write-Host "Applying $retentionDays-day retention..."
    $removedCount = Remove-ExpiredScheduledBackups `
        -ScheduledRoot $scheduledRoot `
        -RetentionDays $retentionDays
    Write-Host "Removed: $removedCount old scheduled backup(s)"
    Write-RunLog -Message "Retention completed. Days=$retentionDays Removed=$removedCount."

    Write-Host ""
    Write-Host "Scheduled production backup COMPLETED"
    Write-RunLog -Message "Scheduled backup completed successfully."
    $exitCode = 0
}
catch {
    $reason = $_.Exception.Message
    Write-Host ""
    Write-Host "Scheduled production backup FAILED"
    Write-Host $reason
    try {
        Write-RunLog -Message "Scheduled backup FAILED. Reason: $reason"
    }
    catch {
        # Do not hide the original operational failure because logging also failed.
    }
    $exitCode = 1
}
finally {
    if ($null -ne $lockStream) {
        $lockStream.Dispose()
    }

    if ($lockFile -and (Test-Path -LiteralPath $lockFile)) {
        Remove-Item -LiteralPath $lockFile -Force -ErrorAction SilentlyContinue
    }
}

exit $exitCode
