param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$BackupDirectory
)

$ErrorActionPreference = "Stop"

$postgresImage = "postgres:17"
$verificationId = [Guid]::NewGuid().ToString("N").Substring(0, 12)
$utilityContainerName = "rental-backup-verify-list-$verificationId"
$databaseContainerName = "rental-backup-verify-$verificationId"
$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ("RentalHouseBackupVerify\$verificationId")
$tempUploadsDirectory = Join-Path $tempRoot "uploads"
$stage = "Input validation"
$failed = $false
$failureReason = $null
$cleanupIssues = @()

function Assert-CommandAvailable {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' is not available."
    }
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
        [string]$ManifestPath
    )

    try {
        $manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json -ErrorAction Stop
    }
    catch {
        throw "manifest.json is not valid JSON."
    }

    if ($null -eq $manifest.formatVersion) {
        throw "manifest.json is missing formatVersion."
    }

    if ([int]$manifest.formatVersion -ne 1) {
        throw "Unsupported backup formatVersion '$($manifest.formatVersion)'."
    }

    if ([string]::IsNullOrWhiteSpace([string]$manifest.appVersion)) {
        throw "manifest.json is missing appVersion."
    }

    # Phase 11.3D adds backupType without changing formatVersion so existing
    # Phase 11.3A-C manifests remain readable. Validate it only when present.
    if ($null -ne $manifest.backupType) {
        $backupType = ([string]$manifest.backupType).ToLowerInvariant()
        if ($backupType -notin @("manual", "scheduled")) {
            throw "manifest.json contains an unsupported backupType '$($manifest.backupType)'."
        }
    }

    foreach ($sectionName in @("database", "uploads")) {
        $section = $manifest.$sectionName
        if ($null -eq $section) {
            throw "manifest.json is missing $sectionName metadata."
        }

        if ([string]::IsNullOrWhiteSpace([string]$section.file)) {
            throw "manifest.json is missing $sectionName.file."
        }

        if ([string]::IsNullOrWhiteSpace([string]$section.sha256) -or
            ([string]$section.sha256) -notmatch '^[A-Fa-f0-9]{64}$') {
            throw "manifest.json contains an invalid $sectionName.sha256 value."
        }

        $sizeValue = 0L
        if (-not [long]::TryParse([string]$section.sizeBytes, [ref]$sizeValue) -or $sizeValue -lt 0) {
            throw "manifest.json contains an invalid $sectionName.sizeBytes value."
        }
    }

    return $manifest
}

function Assert-FileSize {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [long]$ExpectedSize,

        [Parameter(Mandatory = $true)]
        [string]$Label
    )

    $actualSize = (Get-Item -LiteralPath $Path).Length
    if ($actualSize -ne $ExpectedSize) {
        throw "$Label size does not match manifest. Expected $ExpectedSize bytes, found $actualSize bytes."
    }
}

function Assert-FileHash {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [string]$ExpectedHash,

        [Parameter(Mandatory = $true)]
        [string]$Label
    )

    $actualHash = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
    if (-not $actualHash.Equals($ExpectedHash, [StringComparison]::OrdinalIgnoreCase)) {
        throw "$Label SHA-256 checksum does not match manifest."
    }
}

function Assert-DockerSucceeded {
    param(
        [Parameter(Mandatory = $true)]
        [int]$ExitCode,

        [Parameter(Mandatory = $true)]
        [string]$Message
    )

    if ($ExitCode -ne 0) {
        throw $Message
    }
}

function Test-UploadsArchive {
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
                throw "uploads.zip contains an entry that escapes the temporary verification directory."
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
    catch {
        throw "uploads.zip is not a valid readable ZIP archive. $($_.Exception.Message)"
    }
    finally {
        if ($null -ne $archive) {
            $archive.Dispose()
        }
    }
}

function Test-PostgresDumpFormat {
    param(
        [Parameter(Mandatory = $true)]
        [string]$DumpPath,

        [Parameter(Mandatory = $true)]
        [string]$ContainerName
    )

    & docker create `
        --name $ContainerName `
        --network none `
        --entrypoint pg_restore `
        $script:postgresImage `
        --list /tmp/database.dump *> $null
    Assert-DockerSucceeded -ExitCode $LASTEXITCODE -Message "Unable to create PostgreSQL utility container."

    & docker cp $DumpPath "${ContainerName}:/tmp/database.dump" *> $null
    Assert-DockerSucceeded -ExitCode $LASTEXITCODE -Message "Unable to copy database.dump into PostgreSQL utility container."

    & docker start -a $ContainerName *> $null
    Assert-DockerSucceeded -ExitCode $LASTEXITCODE -Message "pg_restore --list could not read database.dump."
}

function Start-VerificationPostgres {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ContainerName,

        [Parameter(Mandatory = $true)]
        [string]$Password
    )

    $containerOutput = & docker run -d `
        --name $ContainerName `
        --network none `
        -e POSTGRES_USER=verify_user `
        -e POSTGRES_PASSWORD=$Password `
        -e POSTGRES_DB=verify_db `
        $script:postgresImage 2>&1
    $exitCode = $LASTEXITCODE

    if ($exitCode -ne 0) {
        throw "Unable to start isolated temporary PostgreSQL 17 container."
    }

    if ([string]::IsNullOrWhiteSpace([string]($containerOutput | Select-Object -Last 1))) {
        throw "Docker did not return a temporary PostgreSQL container identifier."
    }
}

function Wait-PostgresReady {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ContainerName
    )

    # The official postgres image can briefly accept connections while its
    # entrypoint is still initializing POSTGRES_DB. pg_isready only proves
    # that a server is listening; it does not prove that verify_db already
    # exists. Wait until the exact target database accepts a real query.
    $maximumAttempts = 30
    for ($attempt = 1; $attempt -le $maximumAttempts; $attempt++) {
        # A failed probe is expected while the official postgres entrypoint is
        # still initializing. With the script-wide ErrorActionPreference=Stop,
        # native stderr from psql would otherwise terminate the retry loop on
        # the very first connection failure. Probe under Continue and decide
        # readiness only from the native process exit code.
        $previousErrorActionPreference = $ErrorActionPreference
        try {
            $ErrorActionPreference = "Continue"
            & docker exec $ContainerName psql `
                -U verify_user `
                -d verify_db `
                -At `
                -v ON_ERROR_STOP=1 `
                -c "SELECT 1;" *> $null
            $probeExitCode = $LASTEXITCODE
        }
        finally {
            $ErrorActionPreference = $previousErrorActionPreference
        }

        if ($probeExitCode -eq 0) {
            return
        }

        Start-Sleep -Seconds 2
    }

    throw "Temporary PostgreSQL did not become ready with verify_db available within 60 seconds."
}

function Restore-BackupDatabase {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ContainerName,

        [Parameter(Mandatory = $true)]
        [string]$DumpPath
    )

    & docker cp $DumpPath "${ContainerName}:/tmp/database.dump" *> $null
    Assert-DockerSucceeded -ExitCode $LASTEXITCODE -Message "Unable to copy database.dump into temporary PostgreSQL container."

    & docker exec $ContainerName pg_restore `
        --exit-on-error `
        --no-owner `
        --no-privileges `
        -U verify_user `
        -d verify_db `
        /tmp/database.dump *> $null
    Assert-DockerSucceeded -ExitCode $LASTEXITCODE -Message "pg_restore exited with code $LASTEXITCODE."
}

function Test-RestoredSchema {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ContainerName
    )

    $tableCountOutput = & docker exec $ContainerName psql `
        -U verify_user `
        -d verify_db `
        -At `
        -c "SELECT count(*) FROM pg_tables WHERE schemaname = 'public';" 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to query restored application schema."
    }

    $tableCount = 0
    if (-not [int]::TryParse(([string]($tableCountOutput | Select-Object -Last 1)).Trim(), [ref]$tableCount)) {
        throw "Unable to read restored application table count."
    }

    if ($tableCount -le 0) {
        throw "Restored database contains no public application tables."
    }

    $migrationExistsOutput = & docker exec $ContainerName psql `
        -U verify_user `
        -d verify_db `
        -At `
        -c "SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = '_prisma_migrations');" 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to inspect restored Prisma migration metadata."
    }

    $migrationExists = ([string]($migrationExistsOutput | Select-Object -Last 1)).Trim()
    if ($migrationExists -eq "t") {
        & docker exec $ContainerName psql `
            -U verify_user `
            -d verify_db `
            -At `
            -c 'SELECT COUNT(*) FROM "_prisma_migrations";' *> $null
        if ($LASTEXITCODE -ne 0) {
            throw "Restored _prisma_migrations table exists but cannot be queried."
        }
    }

    return $tableCount
}

function Remove-VerificationContainer {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ContainerName
    )

    $existing = & docker ps -a -q --filter "name=^/${ContainerName}$" 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace([string]($existing | Select-Object -First 1))) {
        return
    }

    & docker rm -f $ContainerName *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to remove temporary container '$ContainerName'."
    }
}

try {
    Write-Host "Production backup verification"
    Write-Host ""

    $stage = "Input validation"
    if ($BackupDirectory.TrimEnd('\', '/').EndsWith(".incomplete", [StringComparison]::OrdinalIgnoreCase)) {
        throw "Incomplete backup directories cannot be verified."
    }

    $backupRoot = Resolve-BackupRoot -Path $BackupDirectory
    if (-not (Test-Path -LiteralPath $backupRoot -PathType Container)) {
        throw "Backup directory does not exist: $backupRoot"
    }

    if ((Split-Path -Leaf $backupRoot).EndsWith(".incomplete", [StringComparison]::OrdinalIgnoreCase)) {
        throw "Incomplete backup directories cannot be verified."
    }

    Write-Host "Backup:"
    Write-Host $backupRoot
    Write-Host ""

    foreach ($requiredFile in @("manifest.json", "database.dump", "uploads.zip")) {
        $requiredPath = Join-Path $backupRoot $requiredFile
        if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
            throw "Required backup file is missing: $requiredFile"
        }
    }

    Assert-CommandAvailable -Name "docker"
    $null = & docker version --format '{{.Server.Version}}' 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker is unavailable or the Docker daemon is not running."
    }

    $stage = "Manifest validation"
    $manifestPath = Join-Path $backupRoot "manifest.json"
    $manifest = Read-BackupManifest -ManifestPath $manifestPath
    $databasePath = Resolve-BackupArtifactPath -BackupRoot $backupRoot -RelativePath ([string]$manifest.database.file)
    $uploadsPath = Resolve-BackupArtifactPath -BackupRoot $backupRoot -RelativePath ([string]$manifest.uploads.file)

    if (-not (Test-Path -LiteralPath $databasePath -PathType Leaf)) {
        throw "Database artifact referenced by manifest does not exist."
    }
    if (-not (Test-Path -LiteralPath $uploadsPath -PathType Leaf)) {
        throw "Uploads artifact referenced by manifest does not exist."
    }

    Write-Host "Manifest: OK"
    Write-Host "App version: $($manifest.appVersion)"
    if ($null -ne $manifest.backupType) {
        Write-Host "Backup type: $($manifest.backupType)"
    }
    Write-Host ""

    $stage = "Database size"
    Assert-FileSize -Path $databasePath -ExpectedSize ([long]$manifest.database.sizeBytes) -Label "Database"
    Write-Host "Database size: OK"

    $stage = "Database checksum"
    Assert-FileHash -Path $databasePath -ExpectedHash ([string]$manifest.database.sha256) -Label "Database"
    Write-Host "Database checksum: OK"

    $stage = "Uploads size"
    Assert-FileSize -Path $uploadsPath -ExpectedSize ([long]$manifest.uploads.sizeBytes) -Label "Uploads"
    Write-Host "Uploads size: OK"

    $stage = "Uploads checksum"
    Assert-FileHash -Path $uploadsPath -ExpectedHash ([string]$manifest.uploads.sha256) -Label "Uploads"
    Write-Host "Uploads checksum: OK"

    $stage = "Uploads archive"
    New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null
    Test-UploadsArchive -ZipPath $uploadsPath -DestinationDirectory $tempUploadsDirectory
    Write-Host "Uploads archive: OK"

    $stage = "Database dump format"
    Test-PostgresDumpFormat -DumpPath $databasePath -ContainerName $utilityContainerName
    Remove-VerificationContainer -ContainerName $utilityContainerName
    Write-Host "Database dump format: OK"
    Write-Host ""

    $stage = "Temporary PostgreSQL startup"
    Write-Host "Starting temporary PostgreSQL..."
    $temporaryPassword = [Guid]::NewGuid().ToString("N") + [Guid]::NewGuid().ToString("N")
    Start-VerificationPostgres -ContainerName $databaseContainerName -Password $temporaryPassword
    Wait-PostgresReady -ContainerName $databaseContainerName
    Write-Host "Temporary PostgreSQL: ready"

    $stage = "Database restore"
    Write-Host "Restoring database..."
    Restore-BackupDatabase -ContainerName $databaseContainerName -DumpPath $databasePath
    Write-Host "Database restore: OK"

    $stage = "Schema sanity"
    $applicationTableCount = Test-RestoredSchema -ContainerName $databaseContainerName
    Write-Host "Schema sanity: OK"
    Write-Host "Application tables: $applicationTableCount"
}
catch {
    $failed = $true
    $failureReason = $_.Exception.Message
}
finally {
    Write-Host ""
    Write-Host "Cleaning temporary resources..."

    foreach ($containerName in @($utilityContainerName, $databaseContainerName)) {
        try {
            Remove-VerificationContainer -ContainerName $containerName
        }
        catch {
            $cleanupIssues += $_.Exception.Message
        }
    }

    if (Test-Path -LiteralPath $tempRoot) {
        try {
            Remove-Item -LiteralPath $tempRoot -Recurse -Force
        }
        catch {
            $cleanupIssues += "Unable to remove temporary verification directory."
        }
    }

    if ($cleanupIssues.Count -eq 0) {
        Write-Host "Cleanup: done"
    }
    else {
        Write-Host "Cleanup: completed with warnings"
        foreach ($issue in $cleanupIssues) {
            Write-Warning $issue
        }
    }
}

if ($failed -or $cleanupIssues.Count -gt 0) {
    Write-Host ""
    Write-Host "Backup verification FAILED"
    Write-Host ""
    Write-Host "Stage:"
    Write-Host $stage
    Write-Host ""
    Write-Host "Reason:"
    if ($failed) {
        Write-Host $failureReason
    }
    else {
        Write-Host "Temporary verification resources could not be fully cleaned up."
    }
    Write-Host ""
    Write-Host "Temporary resources cleanup was attempted."
    exit 1
}

Write-Host ""
Write-Host "Backup verification PASSED"
