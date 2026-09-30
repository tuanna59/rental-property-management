param(
    [ValidateSet("Manual", "Scheduled")]
    [string]$BackupType = "Manual",

    [switch]$PassThru
)

$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "prod-common.ps1")

$defaultBackupPath = "C:/RentalHouseData/prod/backups"
$containerDumpPath = "/tmp/rental-house-production.dump"
$incompleteDirectory = $null
$finalDirectory = $null
$stagingDirectory = $null
$postgresContainerId = $null
$tempDumpMayExist = $false

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

function Assert-CommandAvailable {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' is not available."
    }
}

function Assert-DirectoryWritable {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        try {
            New-Item -ItemType Directory -Path $Path -Force | Out-Null
        }
        catch {
            throw "Unable to create backup destination '$Path'."
        }
    }

    if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
        throw "Backup destination '$Path' is not a directory."
    }

    $probe = Join-Path $Path (".rental-house-write-test-{0}.tmp" -f [Guid]::NewGuid().ToString("N"))
    try {
        [IO.File]::WriteAllText($probe, "write-test")
    }
    catch {
        throw "Backup destination '$Path' is not writable."
    }
    finally {
        if (Test-Path -LiteralPath $probe) {
            Remove-Item -LiteralPath $probe -Force -ErrorAction SilentlyContinue
        }
    }
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

function Invoke-ProductionCompose {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    Push-Location $script:ProdRepoRoot
    $previousErrorActionPreference = $ErrorActionPreference
    try {
        # Docker Compose emits ordinary progress on stderr. Treat the native
        # process exit code as authoritative instead of PowerShell's stderr
        # stream classification.
        $ErrorActionPreference = "Continue"
        $output = & docker compose `
            --env-file $script:ProdEnvFile `
            -p $script:ProdProjectName `
            -f $script:ProdComposeFile `
            @Arguments 2>&1
        $exitCode = $LASTEXITCODE
        $output | Out-Host
        return $exitCode
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
        Pop-Location
    }
}

function Get-ProductionPostgresContainerId {
    Push-Location $script:ProdRepoRoot
    try {
        $containerOutput = & docker compose `
            --env-file $script:ProdEnvFile `
            -p $script:ProdProjectName `
            -f $script:ProdComposeFile `
            ps --status running -q $script:ProdPostgresServiceName 2>$null
        $composeExitCode = $LASTEXITCODE

        if ($composeExitCode -ne 0) {
            throw "Unable to read production PostgreSQL container status."
        }

        $containerId = [string]($containerOutput | Select-Object -First 1)
        $containerId = $containerId.Trim()
        if ([string]::IsNullOrWhiteSpace($containerId)) {
            throw "Production PostgreSQL container is not running."
        }

        return $containerId
    }
    finally {
        Pop-Location
    }
}

function New-BackupDirectories {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RootPath
    )

    $baseName = Get-Date -Format "yyyy-MM-dd_HHmmss"
    $suffix = 0

    while ($true) {
        $name = if ($suffix -eq 0) { $baseName } else { "{0}-{1:D2}" -f $baseName, $suffix }
        $finalPath = Join-Path $RootPath $name
        $incompletePath = Join-Path $RootPath "$name.incomplete"

        if (-not (Test-Path -LiteralPath $finalPath) -and -not (Test-Path -LiteralPath $incompletePath)) {
            New-Item -ItemType Directory -Path $incompletePath | Out-Null
            return @{
                Final = $finalPath
                Incomplete = $incompletePath
            }
        }

        $suffix++
    }
}

function Backup-ProductionDatabase {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ContainerId,

        [Parameter(Mandatory = $true)]
        [string]$DestinationPath
    )

    $pgDumpCommand = 'rm -f /tmp/rental-house-production.dump && PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/rental-house-production.dump'

    Write-Host "Database: backing up..."
    $script:tempDumpMayExist = $true

    $exitCode = Invoke-ProductionCompose -Arguments @(
        "exec", "-T", $script:ProdPostgresServiceName,
        "sh", "-lc", $pgDumpCommand
    )

    if ($exitCode -ne 0) {
        throw "Database backup failed."
    }

    $sourceSpec = "${ContainerId}:$script:containerDumpPath"
    & docker cp $sourceSpec $DestinationPath
    if ($LASTEXITCODE -ne 0) {
        throw "Database backup failed while copying database.dump to Windows."
    }

    if (-not (Test-Path -LiteralPath $DestinationPath -PathType Leaf)) {
        throw "Database backup failed: database.dump was not created."
    }

    if ((Get-Item -LiteralPath $DestinationPath).Length -le 0) {
        throw "Database backup failed: database.dump is empty."
    }

    & docker exec $ContainerId rm -f $script:containerDumpPath
    if ($LASTEXITCODE -ne 0) {
        throw "Database backup succeeded, but the temporary dump could not be removed from the PostgreSQL container."
    }

    $script:tempDumpMayExist = $false
    Write-Host "Database: done"
}

function Backup-ProductionUploads {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SourcePath,

        [Parameter(Mandatory = $true)]
        [string]$StagingPath,

        [Parameter(Mandatory = $true)]
        [string]$DestinationZip
    )

    Write-Host "Uploads: backing up..."

    if (-not (Test-Path -LiteralPath $SourcePath -PathType Container)) {
        throw "Unable to read production uploads directory '$SourcePath'."
    }

    New-Item -ItemType Directory -Path $StagingPath | Out-Null

    $robocopyOutput = & robocopy `
        $SourcePath `
        $StagingPath `
        /E /COPY:DAT /DCOPY:DAT /R:2 /W:1 /NFL /NDL /NJH /NJS /NP 2>&1
    $robocopyExitCode = $LASTEXITCODE

    if ($robocopyExitCode -ge 8) {
        $details = ($robocopyOutput | Out-String).Trim()
        if ([string]::IsNullOrWhiteSpace($details)) {
            throw "Upload staging copy failed (robocopy exit code $robocopyExitCode)."
        }
        throw "Upload staging copy failed (robocopy exit code $robocopyExitCode).`n$details"
    }

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    if (Test-Path -LiteralPath $DestinationZip) {
        Remove-Item -LiteralPath $DestinationZip -Force
    }

    [IO.Compression.ZipFile]::CreateFromDirectory(
        $StagingPath,
        $DestinationZip,
        [IO.Compression.CompressionLevel]::Optimal,
        $false
    )

    if (-not (Test-Path -LiteralPath $DestinationZip -PathType Leaf)) {
        throw "Uploads backup failed: uploads.zip was not created."
    }

    Remove-Item -LiteralPath $StagingPath -Recurse -Force
    $script:stagingDirectory = $null
    Write-Host "Uploads: done"
}

function Write-BackupManifest {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Directory,

        [Parameter(Mandatory = $true)]
        [string]$AppVersion,

        [Parameter(Mandatory = $true)]
        [ValidateSet("manual", "scheduled")]
        [string]$ManifestBackupType
    )

    $databasePath = Join-Path $Directory "database.dump"
    $uploadsPath = Join-Path $Directory "uploads.zip"

    $databaseFile = Get-Item -LiteralPath $databasePath
    $uploadsFile = Get-Item -LiteralPath $uploadsPath
    $databaseHash = (Get-FileHash -LiteralPath $databasePath -Algorithm SHA256).Hash.ToLowerInvariant()
    $uploadsHash = (Get-FileHash -LiteralPath $uploadsPath -Algorithm SHA256).Hash.ToLowerInvariant()

    $manifest = [ordered]@{
        formatVersion = 1
        createdAtUtc = [DateTimeOffset]::UtcNow.ToString("o")
        createdAtLocal = [DateTimeOffset]::Now.ToString("o")
        appVersion = $AppVersion
        composeProject = $script:ProdProjectName
        backupType = $ManifestBackupType
        database = [ordered]@{
            format = "pg_dump-custom"
            file = "database.dump"
            sha256 = $databaseHash
            sizeBytes = $databaseFile.Length
        }
        uploads = [ordered]@{
            file = "uploads.zip"
            sha256 = $uploadsHash
            sizeBytes = $uploadsFile.Length
        }
    }

    $manifestPath = Join-Path $Directory "manifest.json"
    $manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
    Write-Host "Checksums: done"
}

try {
    Write-Host "Production backup"
    Write-Host ""

    if (-not (Test-Path -LiteralPath $script:ProdEnvFile -PathType Leaf)) {
        throw "Missing .env.production. Copy .env.production.example and configure it first."
    }

    if (-not (Test-Path -LiteralPath $script:ProdComposeFile -PathType Leaf)) {
        throw "Missing compose.prod.yml."
    }

    Assert-CommandAvailable -Name "docker"
    Assert-CommandAvailable -Name "robocopy"
    Assert-ProductionConfiguration

    $null = & docker version --format '{{.Server.Version}}' 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker is unavailable or the Docker daemon is not running."
    }

    $appVersion = Get-ProductionEnvValue -Name "APP_VERSION"
    $uploadsPath = Resolve-ProductionPath -Path (Get-ProductionEnvValue -Name "PROD_UPLOADS_PATH")
    $backupRoot = Resolve-ProductionPath -Path (Get-OptionalProductionEnvValue -Name "PROD_BACKUP_PATH" -DefaultValue $defaultBackupPath)
    $backupCategoryName = if ($BackupType -eq "Scheduled") { "scheduled" } else { "manual" }
    $backupCategoryRoot = Join-Path $backupRoot $backupCategoryName
    $manifestBackupType = $backupCategoryName

    if (-not (Test-Path -LiteralPath $uploadsPath -PathType Container)) {
        throw "Unable to read production uploads directory '$uploadsPath'."
    }

    if (Test-PathIsInside -ChildPath $backupRoot -ParentPath $uploadsPath) {
        throw "PROD_BACKUP_PATH must not be the production uploads directory or a child of it."
    }

    Assert-DirectoryWritable -Path $backupRoot
    Assert-DirectoryWritable -Path $backupCategoryRoot
    $postgresContainerId = Get-ProductionPostgresContainerId

    $directories = New-BackupDirectories -RootPath $backupCategoryRoot
    $incompleteDirectory = $directories.Incomplete
    $finalDirectory = $directories.Final
    $stagingDirectory = Join-Path $incompleteDirectory ".uploads-staging"

    Write-Host "App version: $appVersion"
    Write-Host "Backup type: $manifestBackupType"

    $databaseDumpPath = Join-Path $incompleteDirectory "database.dump"
    $uploadsZipPath = Join-Path $incompleteDirectory "uploads.zip"

    Backup-ProductionDatabase -ContainerId $postgresContainerId -DestinationPath $databaseDumpPath
    Backup-ProductionUploads -SourcePath $uploadsPath -StagingPath $stagingDirectory -DestinationZip $uploadsZipPath
    Write-BackupManifest `
        -Directory $incompleteDirectory `
        -AppVersion $appVersion `
        -ManifestBackupType $manifestBackupType

    $finalName = Split-Path -Leaf $finalDirectory
    Rename-Item -LiteralPath $incompleteDirectory -NewName $finalName
    $incompleteDirectory = $null

    Write-Host ""
    Write-Host "Backup complete:"
    Write-Host $finalDirectory

    if ($PassThru) {
        Write-Output $finalDirectory
    }
}
finally {
    if ($stagingDirectory -and (Test-Path -LiteralPath $stagingDirectory)) {
        Remove-Item -LiteralPath $stagingDirectory -Recurse -Force -ErrorAction SilentlyContinue
    }

    if ($tempDumpMayExist -and $postgresContainerId) {
        & docker exec $postgresContainerId rm -f $containerDumpPath 2>$null | Out-Null
    }

    if ($incompleteDirectory -and (Test-Path -LiteralPath $incompleteDirectory)) {
        Write-Host "Incomplete backup retained at:"
        Write-Host $incompleteDirectory
    }
}
