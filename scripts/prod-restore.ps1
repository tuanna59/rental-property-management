param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$BackupDirectory
)

$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "prod-common.ps1")

$restoreId = [Guid]::NewGuid().ToString("N").Substring(0, 12)
$containerDumpPath = "/tmp/rental-house-production-restore-$restoreId.dump"
$stage = "Input validation"
$productionModified = $false
$appStopped = $false
$rollbackAttempted = $false
$rollbackSucceeded = $false
$preRestoreBackupPath = $null
$selectedUploadsSwapPath = $null
$rollbackUploadsSwapPath = $null
$stagingRoots = @()
$tempDumpMayExist = $false
$postgresContainerId = $null

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

function Resolve-BackupRoot {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $expanded = [Environment]::ExpandEnvironmentVariables($Path)
    return [IO.Path]::GetFullPath($expanded)
}

function Resolve-BackupArtifactPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BackupRoot,

        [Parameter(Mandatory = $true)]
        [string]$RelativePath
    )

    if ([string]::IsNullOrWhiteSpace($RelativePath)) {
        throw "Backup manifest contains an empty artifact filename."
    }

    if ([IO.Path]::IsPathRooted($RelativePath)) {
        throw "Backup manifest artifact paths must be relative to the selected backup directory."
    }

    $root = [IO.Path]::GetFullPath($BackupRoot).TrimEnd(
        [IO.Path]::DirectorySeparatorChar,
        [IO.Path]::AltDirectorySeparatorChar
    )
    $candidate = [IO.Path]::GetFullPath((Join-Path $root $RelativePath))
    $prefix = $root + [IO.Path]::DirectorySeparatorChar

    if (-not $candidate.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Backup manifest artifact path escapes the selected backup directory."
    }

    return $candidate
}

function Read-BackupManifest {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BackupRoot
    )

    $manifestPath = Join-Path $BackupRoot "manifest.json"
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
        throw "Required backup file is missing: manifest.json"
    }

    try {
        $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json -ErrorAction Stop
    }
    catch {
        throw "manifest.json is not valid JSON."
    }

    if ($null -eq $manifest.formatVersion -or [int]$manifest.formatVersion -ne 1) {
        throw "Unsupported backup formatVersion '$($manifest.formatVersion)'."
    }

    if ([string]::IsNullOrWhiteSpace([string]$manifest.appVersion)) {
        throw "manifest.json is missing appVersion."
    }

    if ($null -eq $manifest.database -or [string]::IsNullOrWhiteSpace([string]$manifest.database.file)) {
        throw "manifest.json is missing database.file."
    }

    if ($null -eq $manifest.uploads -or [string]::IsNullOrWhiteSpace([string]$manifest.uploads.file)) {
        throw "manifest.json is missing uploads.file."
    }

    return $manifest
}

function Assert-CommandAvailable {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' is not available."
    }
}

function Invoke-ProductionCompose {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,

        [switch]$CaptureOutput
    )

    Push-Location $script:ProdRepoRoot
    $previousErrorActionPreference = $ErrorActionPreference
    try {
        # Docker Compose writes normal progress messages (for example,
        # "Container ... Stopping") to stderr. With ErrorActionPreference=Stop,
        # merging stderr into PowerShell's error stream can turn successful
        # Compose commands into terminating errors. Capture the native command
        # output under Continue and decide success strictly from its exit code.
        $ErrorActionPreference = "Continue"

        $output = & docker compose `
            --env-file $script:ProdEnvFile `
            -p $script:ProdProjectName `
            -f $script:ProdComposeFile `
            @Arguments 2>&1
        $exitCode = $LASTEXITCODE

        if ($CaptureOutput) {
            return [pscustomobject]@{
                ExitCode = $exitCode
                Output = @($output)
            }
        }

        foreach ($line in @($output)) {
            # Convert native stderr ErrorRecord objects to plain text so normal
            # Docker progress does not render as a NativeCommandError block.
            Write-Host ([string]$line)
        }
        return $exitCode
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
        Pop-Location
    }
}

function Get-ProductionPostgresContainerId {
    $result = Invoke-ProductionCompose -Arguments @(
        "ps", "--status", "running", "-q", $script:ProdPostgresServiceName
    ) -CaptureOutput

    if ($result.ExitCode -ne 0) {
        throw "Unable to read production PostgreSQL container status."
    }

    $containerId = [string]($result.Output | Select-Object -First 1)
    $containerId = $containerId.Trim()
    if ([string]::IsNullOrWhiteSpace($containerId)) {
        throw "Production PostgreSQL container is not running."
    }

    return $containerId
}

function Test-ProductionAppRunning {
    $result = Invoke-ProductionCompose -Arguments @(
        "ps", "--status", "running", "-q", $script:ProdAppServiceName
    ) -CaptureOutput

    if ($result.ExitCode -ne 0) {
        return $false
    }

    $containerId = [string]($result.Output | Select-Object -First 1)
    return -not [string]::IsNullOrWhiteSpace($containerId.Trim())
}

function Get-ProductionAppRunningStatusForReport {
    try {
        if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
            return "Unknown"
        }

        if (-not (Test-Path -LiteralPath $script:ProdEnvFile -PathType Leaf) -or
            -not (Test-Path -LiteralPath $script:ProdComposeFile -PathType Leaf) -or
            [string]::IsNullOrWhiteSpace($script:ProdAppServiceName)) {
            return "Unknown"
        }

        return [string](Test-ProductionAppRunning)
    }
    catch {
        return "Unknown"
    }
}

function Stop-ProductionApp {
    Write-Host "Stopping production app..."
    $exitCode = Invoke-ProductionCompose -Arguments @("stop", $script:ProdAppServiceName)
    if ($exitCode -ne 0) {
        throw "Unable to stop the production app service."
    }

    $script:appStopped = $true
    Write-Host "App stopped"
}

function Start-ProductionApp {
    Write-Host "Starting production app..."
    $exitCode = Invoke-ProductionCompose -Arguments @("start", $script:ProdAppServiceName)
    if ($exitCode -ne 0) {
        throw "Production app failed to start."
    }

    Start-Sleep -Seconds 1
    if (-not (Test-ProductionAppRunning)) {
        throw "Production app command completed, but the app container is not running."
    }

    $script:appStopped = $false
    Write-Host "App started"
}

function Invoke-BackupVerification {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BackupRoot
    )

    $verifyScript = Join-Path $PSScriptRoot "prod-verify-backup.ps1"
    if (-not (Test-Path -LiteralPath $verifyScript -PathType Leaf)) {
        throw "Missing scripts/prod-verify-backup.ps1."
    }

    $powerShellPath = (Get-Process -Id $PID).Path
    & $powerShellPath -NoProfile -File $verifyScript $BackupRoot
    if ($LASTEXITCODE -ne 0) {
        throw "Selected backup did not pass production backup verification."
    }
}

function New-PreRestoreBackup {
    $backupScript = Join-Path $PSScriptRoot "prod-backup.ps1"
    if (-not (Test-Path -LiteralPath $backupScript -PathType Leaf)) {
        throw "Missing scripts/prod-backup.ps1."
    }

    Write-Host "Creating pre-restore backup..."
    $path = & $backupScript -PassThru
    $path = [string]($path | Select-Object -Last 1)
    $path = $path.Trim()

    if ([string]::IsNullOrWhiteSpace($path) -or -not (Test-Path -LiteralPath $path -PathType Container)) {
        throw "Pre-restore backup did not return a completed backup directory."
    }

    Write-Host "Pre-restore backup: OK"
    Write-Host $path
    return $path
}

function Copy-DumpToProductionPostgres {
    param(
        [Parameter(Mandatory = $true)]
        [string]$DumpPath,

        [Parameter(Mandatory = $true)]
        [string]$ContainerId
    )

    & docker exec $ContainerId rm -f $script:containerDumpPath *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to clear the temporary restore path inside production PostgreSQL."
    }

    & docker cp $DumpPath "${ContainerId}:$script:containerDumpPath" *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to copy database.dump into the production PostgreSQL container."
    }

    $script:tempDumpMayExist = $true
}

function Restore-ProductionDatabase {
    param(
        [Parameter(Mandatory = $true)]
        [string]$DumpPath,

        [Parameter(Mandatory = $true)]
        [string]$ContainerId
    )

    Copy-DumpToProductionPostgres -DumpPath $DumpPath -ContainerId $ContainerId

    $replaceDatabaseCommand = @'
set -eu
export PGPASSWORD="$POSTGRES_PASSWORD"
dropdb --force --if-exists -h 127.0.0.1 -U "$POSTGRES_USER" "$POSTGRES_DB"
createdb -h 127.0.0.1 -U "$POSTGRES_USER" -O "$POSTGRES_USER" "$POSTGRES_DB"
pg_restore --exit-on-error --no-owner --no-privileges -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" /tmp/RESTORE_DUMP_PLACEHOLDER
'@
    $replaceDatabaseCommand = $replaceDatabaseCommand.Replace(
        "/tmp/RESTORE_DUMP_PLACEHOLDER",
        $script:containerDumpPath
    )

    $script:productionModified = $true
    & docker exec $ContainerId sh -lc $replaceDatabaseCommand 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw "pg_restore failed while replacing the production database."
    }

    & docker exec $ContainerId rm -f $script:containerDumpPath *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "Database restore succeeded, but the temporary restore dump could not be removed from the PostgreSQL container."
    }

    $script:tempDumpMayExist = $false
}

function Invoke-ProductionPostgresCheck {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ContainerId,

        [Parameter(Mandatory = $true)]
        [string]$Command,

        [Parameter(Mandatory = $true)]
        [string]$FailureMessage
    )

    # Docker Desktop / Windows PowerShell can occasionally yield no captured
    # stdout for a successful `docker exec` native command. Sanity checks must
    # therefore be encoded so PostgreSQL itself returns a non-zero exit code on
    # failure, and PowerShell decides success strictly from LASTEXITCODE.
    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        $output = & docker exec $ContainerId sh -lc $Command 2>&1
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }

    if ($exitCode -ne 0) {
        $details = @(
            $output |
                ForEach-Object { [string]$_ } |
                Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
        )

        if ($details.Count -gt 0) {
            throw "$FailureMessage PostgreSQL exited with code $exitCode. $($details[-1])"
        }

        throw "$FailureMessage PostgreSQL exited with code $exitCode."
    }
}

function Test-RestoredProductionDatabase {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ContainerId
    )

    # Do not depend on query stdout here. The SQL block raises an exception if
    # the restored DB does not contain public application tables. If Prisma's
    # migration table exists, querying it is part of the same guarded check.
    $sanityCommand = @'
set -eu
export PGPASSWORD="$POSTGRES_PASSWORD"
psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
DO $rental_house_sanity$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_tables
        WHERE schemaname = 'public'
    ) THEN
        RAISE EXCEPTION 'No public application tables found';
    END IF;

    IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
        PERFORM COUNT(*) FROM public."_prisma_migrations";
    END IF;
END
$rental_house_sanity$;
SQL
'@

    Invoke-ProductionPostgresCheck `
        -ContainerId $ContainerId `
        -Command $sanityCommand `
        -FailureMessage "Restored production database failed the schema sanity check."
}

function Expand-UploadsArchiveSafely {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ZipPath,

        [Parameter(Mandatory = $true)]
        [string]$DestinationDirectory
    )

    Add-Type -AssemblyName System.IO.Compression -ErrorAction SilentlyContinue
    Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction SilentlyContinue

    New-Item -ItemType Directory -Path $DestinationDirectory -Force | Out-Null
    $destinationRoot = [IO.Path]::GetFullPath($DestinationDirectory).TrimEnd(
        [IO.Path]::DirectorySeparatorChar,
        [IO.Path]::AltDirectorySeparatorChar
    )
    $destinationPrefix = $destinationRoot + [IO.Path]::DirectorySeparatorChar

    $archive = $null
    try {
        $archive = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
        foreach ($entry in $archive.Entries) {
            $targetPath = [IO.Path]::GetFullPath((Join-Path $destinationRoot $entry.FullName))
            if (-not $targetPath.StartsWith($destinationPrefix, [StringComparison]::OrdinalIgnoreCase)) {
                throw "uploads.zip contains an entry that escapes the restore staging directory."
            }

            if ([string]::IsNullOrEmpty($entry.Name)) {
                New-Item -ItemType Directory -Path $targetPath -Force | Out-Null
                continue
            }

            $parent = Split-Path -Parent $targetPath
            if (-not (Test-Path -LiteralPath $parent)) {
                New-Item -ItemType Directory -Path $parent -Force | Out-Null
            }

            $sourceStream = $entry.Open()
            $destinationStream = $null
            try {
                $destinationStream = [IO.File]::Open(
                    $targetPath,
                    [IO.FileMode]::CreateNew,
                    [IO.FileAccess]::Write,
                    [IO.FileShare]::None
                )
                $sourceStream.CopyTo($destinationStream)
            }
            finally {
                if ($null -ne $destinationStream) {
                    $destinationStream.Dispose()
                }
                $sourceStream.Dispose()
            }
        }
    }
    finally {
        if ($null -ne $archive) {
            $archive.Dispose()
        }
    }
}

function New-UploadsRestoreStaging {
    param(
        [Parameter(Mandatory = $true)]
        [string]$UploadsPath,

        [Parameter(Mandatory = $true)]
        [string]$ZipPath,

        [Parameter(Mandatory = $true)]
        [string]$Suffix
    )

    $parentPath = Split-Path -Parent $UploadsPath
    if ([string]::IsNullOrWhiteSpace($parentPath)) {
        throw "Unable to determine the parent directory for production uploads."
    }

    $stagingRoot = Join-Path $parentPath ".rental-house-restore-$restoreId-$Suffix"
    $stagingUploads = Join-Path $stagingRoot "uploads"

    if (Test-Path -LiteralPath $stagingRoot) {
        throw "Restore staging path already exists: $stagingRoot"
    }

    New-Item -ItemType Directory -Path $stagingRoot | Out-Null
    $script:stagingRoots += $stagingRoot
    Expand-UploadsArchiveSafely -ZipPath $ZipPath -DestinationDirectory $stagingUploads

    if (-not (Test-Path -LiteralPath $stagingUploads -PathType Container)) {
        throw "Uploads restore staging directory was not created."
    }

    return $stagingUploads
}

function Replace-ProductionUploads {
    param(
        [Parameter(Mandatory = $true)]
        [string]$UploadsPath,

        [Parameter(Mandatory = $true)]
        [string]$StagingUploadsPath,

        [Parameter(Mandatory = $true)]
        [string]$Suffix
    )

    if (-not (Test-Path -LiteralPath $UploadsPath -PathType Container)) {
        throw "Production uploads directory does not exist: $UploadsPath"
    }

    $parentPath = Split-Path -Parent $UploadsPath
    $swapPath = Join-Path $parentPath ".rental-house-uploads-before-$restoreId-$Suffix"
    if (Test-Path -LiteralPath $swapPath) {
        throw "Upload swap path already exists: $swapPath"
    }

    Move-Item -LiteralPath $UploadsPath -Destination $swapPath
    try {
        Move-Item -LiteralPath $StagingUploadsPath -Destination $UploadsPath
    }
    catch {
        if (-not (Test-Path -LiteralPath $UploadsPath) -and (Test-Path -LiteralPath $swapPath)) {
            Move-Item -LiteralPath $swapPath -Destination $UploadsPath -ErrorAction SilentlyContinue
        }
        throw
    }

    $script:productionModified = $true
    return $swapPath
}

function Test-ProductionUploadsDirectory {
    param(
        [Parameter(Mandatory = $true)]
        [string]$UploadsPath
    )

    if (-not (Test-Path -LiteralPath $UploadsPath -PathType Container)) {
        throw "Restored production uploads directory does not exist."
    }

    try {
        [void](Get-ChildItem -LiteralPath $UploadsPath -Force -ErrorAction Stop | Select-Object -First 1)
    }
    catch {
        throw "Restored production uploads directory is not readable."
    }

    $probe = Join-Path $UploadsPath (".restore-write-test-{0}.tmp" -f [Guid]::NewGuid().ToString("N"))
    try {
        [IO.File]::WriteAllText($probe, "write-test")
    }
    catch {
        throw "Restored production uploads directory is not writable."
    }
    finally {
        if (Test-Path -LiteralPath $probe) {
            Remove-Item -LiteralPath $probe -Force -ErrorAction SilentlyContinue
        }
    }
}

function Remove-SwapDirectory {
    param(
        [string]$Path
    )

    if ($Path -and (Test-Path -LiteralPath $Path)) {
        Remove-Item -LiteralPath $Path -Recurse -Force
    }
}

function Restore-BackupData {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BackupRoot,

        [Parameter(Mandatory = $true)]
        [string]$UploadsPath,

        [Parameter(Mandatory = $true)]
        [string]$ContainerId,

        [Parameter(Mandatory = $true)]
        [string]$Suffix
    )

    $manifest = Read-BackupManifest -BackupRoot $BackupRoot
    $databasePath = Resolve-BackupArtifactPath -BackupRoot $BackupRoot -RelativePath ([string]$manifest.database.file)
    $uploadsZipPath = Resolve-BackupArtifactPath -BackupRoot $BackupRoot -RelativePath ([string]$manifest.uploads.file)

    if (-not (Test-Path -LiteralPath $databasePath -PathType Leaf)) {
        throw "Database artifact referenced by manifest does not exist."
    }
    if (-not (Test-Path -LiteralPath $uploadsZipPath -PathType Leaf)) {
        throw "Uploads artifact referenced by manifest does not exist."
    }

    $script:stage = if ($Suffix -eq "rollback") { "Automatic rollback - database" } else { "Database restore" }
    Write-Host "Restoring database..."
    Restore-ProductionDatabase -DumpPath $databasePath -ContainerId $ContainerId
    Write-Host "Database restore: OK"

    $script:stage = if ($Suffix -eq "rollback") { "Automatic rollback - uploads" } else { "Uploads restore" }
    Write-Host "Restoring uploads..."
    $stagingUploads = New-UploadsRestoreStaging -UploadsPath $UploadsPath -ZipPath $uploadsZipPath -Suffix $Suffix
    $swapPath = Replace-ProductionUploads -UploadsPath $UploadsPath -StagingUploadsPath $stagingUploads -Suffix $Suffix
    Test-ProductionUploadsDirectory -UploadsPath $UploadsPath
    Write-Host "Uploads restore: OK"

    $script:stage = if ($Suffix -eq "rollback") { "Automatic rollback - sanity" } else { "Post-restore sanity" }
    Test-RestoredProductionDatabase -ContainerId $ContainerId
    Write-Host "Database sanity: OK"
    Write-Host "Application tables: present"
    Write-Host "Uploads sanity: OK"

    return $swapPath
}

function Cleanup-RestoreTemporaryResources {
    if ($script:tempDumpMayExist -and $script:postgresContainerId) {
        & docker exec $script:postgresContainerId rm -f $script:containerDumpPath 2>$null | Out-Null
        $script:tempDumpMayExist = $false
    }

    foreach ($root in @($script:stagingRoots)) {
        if ($root -and (Test-Path -LiteralPath $root)) {
            Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

$selectedBackupRoot = $null
$selectedManifest = $null
$currentAppVersion = $null
$uploadsPath = $null
$originalAppWasRunning = $false
$restoreSucceeded = $false
$startupFailed = $false
$failureReason = $null
$failureStage = $null

try {
    Write-Host "Production restore"
    Write-Host ""

    $backupDirectoryForValidation = $BackupDirectory.TrimEnd(
        [char[]]@(
            [IO.Path]::DirectorySeparatorChar,
            [IO.Path]::AltDirectorySeparatorChar
        )
    )
    if ($backupDirectoryForValidation.EndsWith(".incomplete", [StringComparison]::OrdinalIgnoreCase)) {
        throw "Incomplete backup directories cannot be restored."
    }

    $selectedBackupRoot = Resolve-BackupRoot -Path $BackupDirectory
    if (-not (Test-Path -LiteralPath $selectedBackupRoot -PathType Container)) {
        throw "Backup directory does not exist: $selectedBackupRoot"
    }

    if ((Split-Path -Leaf $selectedBackupRoot).EndsWith(".incomplete", [StringComparison]::OrdinalIgnoreCase)) {
        throw "Incomplete backup directories cannot be restored."
    }

    if (-not (Test-Path -LiteralPath $script:ProdEnvFile -PathType Leaf)) {
        throw "Missing .env.production. Copy .env.production.example and configure it first."
    }
    if (-not (Test-Path -LiteralPath $script:ProdComposeFile -PathType Leaf)) {
        throw "Missing compose.prod.yml."
    }

    Assert-CommandAvailable -Name "docker"
    Assert-ProductionConfiguration

    $null = & docker version --format '{{.Server.Version}}' 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker is unavailable or the Docker daemon is not running."
    }

    $postgresDb = Get-ProductionEnvValue -Name "POSTGRES_DB"
    if ($postgresDb -in @("postgres", "template0", "template1")) {
        throw "POSTGRES_DB '$postgresDb' is unsafe for controlled application database replacement."
    }

    $currentAppVersion = Get-ProductionEnvValue -Name "APP_VERSION"
    $uploadsPath = Resolve-ProductionPath -Path (Get-ProductionEnvValue -Name "PROD_UPLOADS_PATH")
    if (-not (Test-Path -LiteralPath $uploadsPath -PathType Container)) {
        throw "Production uploads directory does not exist: $uploadsPath"
    }

    $postgresContainerId = Get-ProductionPostgresContainerId
    $originalAppWasRunning = Test-ProductionAppRunning

    $stage = "Backup verification"
    Write-Host "Verifying selected backup..."
    Invoke-BackupVerification -BackupRoot $selectedBackupRoot
    Write-Host "Backup verification: PASSED"
    Write-Host ""

    $selectedManifest = Read-BackupManifest -BackupRoot $selectedBackupRoot
    $backupCreated = if (-not [string]::IsNullOrWhiteSpace([string]$selectedManifest.createdAtLocal)) {
        [string]$selectedManifest.createdAtLocal
    }
    else {
        [string]$selectedManifest.createdAtUtc
    }

    Write-Host "Backup:"
    Write-Host $selectedBackupRoot
    Write-Host ""
    Write-Host "Backup created:"
    Write-Host $backupCreated
    Write-Host ""
    Write-Host "App version:"
    Write-Host $selectedManifest.appVersion
    Write-Host ""
    Write-Host "Database:"
    Write-Host $selectedManifest.database.file
    Write-Host ""
    Write-Host "Uploads:"
    Write-Host $selectedManifest.uploads.file
    Write-Host ""
    Write-Host "Target:"
    Write-Host "PRODUCTION"
    Write-Host ""

    if (-not ([string]$selectedManifest.appVersion).Equals($currentAppVersion, [StringComparison]::OrdinalIgnoreCase)) {
        Write-Warning "Backup was created under app version $($selectedManifest.appVersion), while current production APP_VERSION is $currentAppVersion. Restore changes data only; the deployed image will remain $currentAppVersion."
        Write-Host ""
    }

    Write-Warning "THIS WILL REPLACE CURRENT PRODUCTION DATABASE AND UPLOADS."
    $confirmation = Read-Host "Type RESTORE PRODUCTION to continue"
    if (-not $confirmation.Equals("RESTORE PRODUCTION", [StringComparison]::Ordinal)) {
        Write-Host "Restore aborted. Production was not modified."
        exit 0
    }

    $stage = "Pre-restore backup"
    $preRestoreBackupPath = New-PreRestoreBackup
    Write-Host ""

    $stage = "Pre-restore backup verification"
    Write-Host "Verifying pre-restore backup..."
    Invoke-BackupVerification -BackupRoot $preRestoreBackupPath
    Write-Host "Pre-restore backup verification: PASSED"
    Write-Host ""

    $stage = "Stopping production app"
    Stop-ProductionApp
    Write-Host ""

    $stage = "Production data restore"
    try {
        $selectedUploadsSwapPath = Restore-BackupData `
            -BackupRoot $selectedBackupRoot `
            -UploadsPath $uploadsPath `
            -ContainerId $postgresContainerId `
            -Suffix "selected"

        $restoreSucceeded = $true
        try {
            Remove-SwapDirectory -Path $selectedUploadsSwapPath
            $selectedUploadsSwapPath = $null
        }
        catch {
            Write-Warning "Restore succeeded, but the old upload swap directory could not be removed: $selectedUploadsSwapPath"
        }
    }
    catch {
        $failureReason = $_.Exception.Message
        $failureStage = $stage

        if ($productionModified) {
            $rollbackAttempted = $true
            Write-Host ""
            Write-Warning "Restore failed after production data was modified. Attempting automatic rollback from the pre-restore backup..."

            try {
                $stage = "Automatic rollback"
                $rollbackUploadsSwapPath = Restore-BackupData `
                    -BackupRoot $preRestoreBackupPath `
                    -UploadsPath $uploadsPath `
                    -ContainerId $postgresContainerId `
                    -Suffix "rollback"

                $rollbackSucceeded = $true
                foreach ($swapToRemove in @($rollbackUploadsSwapPath, $selectedUploadsSwapPath)) {
                    try {
                        Remove-SwapDirectory -Path $swapToRemove
                    }
                    catch {
                        Write-Warning "Rollback succeeded, but an upload swap directory could not be removed: $swapToRemove"
                    }
                }
                $rollbackUploadsSwapPath = $null
                $selectedUploadsSwapPath = $null
                Write-Host "Automatic rollback: OK"
            }
            catch {
                $rollbackSucceeded = $false
                $failureReason = "$failureReason`nAutomatic rollback also failed: $($_.Exception.Message)"
            }
        }

        throw $failureReason
    }

    $stage = "Starting production app"
    try {
        Start-ProductionApp
    }
    catch {
        $startupFailed = $true
        $failureReason = $_.Exception.Message
        throw
    }
}
catch {
    if (-not $failureReason) {
        $failureReason = $_.Exception.Message
    }
    if (-not $failureStage) {
        $failureStage = $stage
    }
}
finally {
    Cleanup-RestoreTemporaryResources
}

if ($restoreSucceeded -and -not $startupFailed -and -not $failureReason) {
    Write-Host ""
    Write-Host "Production restore COMPLETED"
    Write-Host ""
    Write-Host "Pre-restore backup retained at:"
    Write-Host $preRestoreBackupPath
    exit 0
}

if ($rollbackAttempted -and $rollbackSucceeded) {
    if ($originalAppWasRunning -and $appStopped) {
        try {
            Write-Host ""
            Start-ProductionApp
        }
        catch {
            $failureReason = "$failureReason`nRollback restored the previous data, but the production app could not be restarted: $($_.Exception.Message)"
        }
    }
}
elseif (-not $productionModified -and $originalAppWasRunning -and $appStopped) {
    try {
        Write-Host ""
        Start-ProductionApp
    }
    catch {
        $failureReason = "$failureReason`nProduction data was not modified, but the app could not be restarted: $($_.Exception.Message)"
    }
}

Write-Host ""
Write-Host "Production restore FAILED"
Write-Host ""
Write-Host "Stage:"
Write-Host $failureStage
Write-Host ""
Write-Host "Reason:"
Write-Host $failureReason
Write-Host ""
Write-Host "Production modified: $productionModified"
Write-Host "Rollback attempted: $rollbackAttempted"
Write-Host "Rollback succeeded: $rollbackSucceeded"
Write-Host "App running: $(Get-ProductionAppRunningStatusForReport)"

if ($preRestoreBackupPath) {
    Write-Host ""
    Write-Host "Pre-restore backup:"
    Write-Host $preRestoreBackupPath
}

if ($selectedUploadsSwapPath -and (Test-Path -LiteralPath $selectedUploadsSwapPath)) {
    Write-Host ""
    Write-Warning "A recoverable uploads swap directory remains at: $selectedUploadsSwapPath"
}

if ($rollbackUploadsSwapPath -and (Test-Path -LiteralPath $rollbackUploadsSwapPath)) {
    Write-Host ""
    Write-Warning "A rollback uploads swap directory remains at: $rollbackUploadsSwapPath"
}

if ($startupFailed -and $restoreSucceeded) {
    Write-Host ""
    Write-Warning "Restore completed, but production app failed to start. Restored data was not deleted or rolled back."
}
elseif ($productionModified -and $rollbackAttempted -and -not $rollbackSucceeded) {
    Write-Host ""
    Write-Warning "CRITICAL: automatic rollback failed. Keep the production app stopped and recover using the pre-restore backup shown above."
}

exit 1
