param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$BackupDirectory
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$devComposeFile = Join-Path $repoRoot "docker-compose.yml"
$devDebugComposeFile = Join-Path $repoRoot "docker-compose.debug.yml"
$verifyScript = Join-Path $PSScriptRoot "prod-verify-backup.ps1"
$devAppServiceName = "app"
$devPostgresServiceName = "postgres"
$devPrivateDataDestination = "/app/private-data"
$restoreId = [Guid]::NewGuid().ToString("N").Substring(0, 12)
$containerDumpPath = "/tmp/rental-house-dev-restore-$restoreId.dump"
$uploadsHelperContainerName = "rental-house-dev-uploads-restore-$restoreId"
$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ("RentalHouseDevRestore\$restoreId")
$tempUploadsDirectory = Join-Path $tempRoot "uploads"

$stage = "Input validation"
$devDatabaseModified = $false
$devUploadsModified = $false
$appStopped = $false
$tempDumpMayExist = $false
$appContainerId = $null
$postgresContainerId = $null
$devProjectName = $null
$devUploadsVolumeName = $null
$appImageId = $null
$devPostgresDb = $null
$devPostgresUser = $null

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

function Invoke-Docker {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,

        [switch]$CaptureOutput,
        [switch]$Quiet
    )

    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        $output = & docker @Arguments 2>&1
        $exitCode = $LASTEXITCODE

        if ($CaptureOutput) {
            return [pscustomobject]@{
                ExitCode = $exitCode
                Output = @($output)
            }
        }

        if (-not $Quiet) {
            foreach ($line in @($output)) {
                Write-Host ([string]$line)
            }
        }

        return $exitCode
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
}

function Invoke-DevCompose {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,

        [switch]$CaptureOutput,
        [switch]$UseDebugOverlay
    )

    $dockerArguments = @(
        "compose",
        "--project-directory", $script:repoRoot,
        "-f", $script:devComposeFile
    )

    if ($UseDebugOverlay) {
        if (-not (Test-Path -LiteralPath $script:devDebugComposeFile -PathType Leaf)) {
            throw "Missing docker-compose.debug.yml required to run current-source DEV migrations."
        }
        $dockerArguments += @("-f", $script:devDebugComposeFile)
    }

    $dockerArguments += $Arguments
    return Invoke-Docker -Arguments $dockerArguments -CaptureOutput:$CaptureOutput
}

function Get-FirstOutputLine {
    param(
        [AllowNull()]
        [AllowEmptyCollection()]
        [object[]]$Output = @()
    )

    foreach ($line in @($Output)) {
        $text = ([string]$line).Trim()
        if (-not [string]::IsNullOrWhiteSpace($text)) {
            return $text
        }
    }

    return ""
}

function ConvertTo-LinuxShellCommand {
    param(
        [AllowNull()]
        [string]$Command
    )

    if ($null -eq $Command) {
        return ""
    }

    # PowerShell scripts on Windows are commonly checked out with CRLF line endings.
    # When a multiline here-string is passed directly to Linux `sh -lc`, the CR
    # characters become part of shell tokens (for example `set -eu\r`) and BusyBox/
    # dash can fail with `set: illegal option -`. Normalize only the shell payload;
    # keep the PowerShell file itself compatible with normal Windows checkouts.
    return $Command.Replace("`r`n", "`n").Replace("`r", "`n")
}

function Get-ContainerIdForDevService {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ServiceName,

        [switch]$RequireRunning
    )

    $arguments = if ($RequireRunning) {
        @("ps", "--status", "running", "-q", $ServiceName)
    }
    else {
        @("ps", "--all", "-q", $ServiceName)
    }

    $result = Invoke-DevCompose -Arguments $arguments -CaptureOutput
    if ($result.ExitCode -ne 0) {
        throw "Unable to resolve DEV Compose service '$ServiceName'."
    }

    $containerId = Get-FirstOutputLine -Output $result.Output
    if ([string]::IsNullOrWhiteSpace($containerId)) {
        if ($RequireRunning) {
            throw "DEV Compose service '$ServiceName' is not running."
        }
        throw "DEV Compose service '$ServiceName' does not have an existing container."
    }

    return $containerId
}

function Format-DockerFailureOutput {
    param(
        [AllowNull()]
        [AllowEmptyCollection()]
        [object[]]$Output = @()
    )

    $lines = @()
    foreach ($line in @($Output)) {
        $text = ([string]$line).Trim()
        if (-not [string]::IsNullOrWhiteSpace($text)) {
            $lines += $text
        }
        if ($lines.Count -ge 6) {
            break
        }
    }

    if ($lines.Count -eq 0) {
        return "(no Docker error output)"
    }

    return ($lines -join " | ")
}

function Get-DockerInspectObject {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ObjectId
    )

    # Use normal JSON inspection instead of `docker inspect --format`.
    # This avoids PowerShell/Windows quoting edge cases with Go templates and
    # gives us one authoritative snapshot for labels, env, mounts and image.
    $result = Invoke-Docker -Arguments @("inspect", $ObjectId) -CaptureOutput
    if ($result.ExitCode -ne 0) {
        $details = Format-DockerFailureOutput -Output $result.Output
        throw "Unable to inspect Docker object '$ObjectId'. Docker output: $details"
    }

    $json = (@($result.Output) | ForEach-Object { [string]$_ }) -join "`n"
    if ([string]::IsNullOrWhiteSpace($json)) {
        throw "Docker inspect returned no data for object '$ObjectId'."
    }

    try {
        $parsed = $json | ConvertFrom-Json -ErrorAction Stop
    }
    catch {
        throw "Docker inspect returned invalid JSON for object '$ObjectId': $($_.Exception.Message)"
    }

    $items = @($parsed)
    if ($items.Count -ne 1 -or $null -eq $items[0]) {
        throw "Docker inspect returned an unexpected result for object '$ObjectId'."
    }

    return $items[0]
}

function Get-DockerVolumeInspectObject {
    param(
        [Parameter(Mandatory = $true)]
        [string]$VolumeName
    )

    $result = Invoke-Docker -Arguments @("volume", "inspect", $VolumeName) -CaptureOutput
    if ($result.ExitCode -ne 0) {
        $details = Format-DockerFailureOutput -Output $result.Output
        throw "Unable to inspect Docker volume '$VolumeName'. Docker output: $details"
    }

    $json = (@($result.Output) | ForEach-Object { [string]$_ }) -join "`n"
    if ([string]::IsNullOrWhiteSpace($json)) {
        throw "Docker volume inspect returned no data for '$VolumeName'."
    }

    try {
        $parsed = $json | ConvertFrom-Json -ErrorAction Stop
    }
    catch {
        throw "Docker volume inspect returned invalid JSON for '$VolumeName': $($_.Exception.Message)"
    }

    $items = @($parsed)
    if ($items.Count -ne 1 -or $null -eq $items[0]) {
        throw "Docker volume inspect returned an unexpected result for '$VolumeName'."
    }

    return $items[0]
}

function Convert-EnvironmentArrayToMap {
    param(
        [AllowNull()]
        [AllowEmptyCollection()]
        [object[]]$Environment = @()
    )

    $values = @{}
    foreach ($line in @($Environment)) {
        $text = [string]$line
        $separatorIndex = $text.IndexOf('=')
        if ($separatorIndex -le 0) {
            continue
        }

        $name = $text.Substring(0, $separatorIndex)
        $value = $text.Substring($separatorIndex + 1)
        $values[$name] = $value
    }

    return $values
}

function Assert-DevTarget {
    if (-not (Test-Path -LiteralPath $script:devComposeFile -PathType Leaf)) {
        throw "Missing docker-compose.yml."
    }

    if ((Split-Path -Leaf $script:devComposeFile).Equals("compose.prod.yml", [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to use compose.prod.yml as the DEV restore target."
    }

    $script:appContainerId = Get-ContainerIdForDevService -ServiceName $script:devAppServiceName
    $script:postgresContainerId = Get-ContainerIdForDevService -ServiceName $script:devPostgresServiceName -RequireRunning

    $appInspect = Get-DockerInspectObject -ObjectId $script:appContainerId
    $postgresInspect = Get-DockerInspectObject -ObjectId $script:postgresContainerId

    $appProject = [string]$appInspect.Config.Labels.'com.docker.compose.project'
    $postgresProject = [string]$postgresInspect.Config.Labels.'com.docker.compose.project'
    $appService = [string]$appInspect.Config.Labels.'com.docker.compose.service'
    $postgresService = [string]$postgresInspect.Config.Labels.'com.docker.compose.service'

    if ([string]::IsNullOrWhiteSpace($appProject) -or $appProject -eq "<no value>") {
        throw "DEV app container is missing its Docker Compose project label."
    }
    if ($appProject.Equals("rental-prod", [StringComparison]::OrdinalIgnoreCase)) {
        throw "Safety check failed: the target Compose project is rental-prod."
    }
    if (-not $appProject.Equals($postgresProject, [StringComparison]::OrdinalIgnoreCase)) {
        throw "DEV app and PostgreSQL containers do not belong to the same Compose project."
    }
    if ($appService -ne $script:devAppServiceName -or $postgresService -ne $script:devPostgresServiceName) {
        throw "DEV Compose service labels do not match the expected app/postgres services."
    }

    $appEnvironment = Convert-EnvironmentArrayToMap -Environment @($appInspect.Config.Env)
    if (-not $appEnvironment.ContainsKey("APP_ENV") -or $appEnvironment["APP_ENV"] -ne "development") {
        throw "Safety check failed: target app container APP_ENV is not development."
    }
    if (-not $appEnvironment.ContainsKey("DATABASE_URL")) {
        throw "DEV app container does not expose DATABASE_URL."
    }

    try {
        $databaseUri = [Uri]$appEnvironment["DATABASE_URL"]
    }
    catch {
        throw "DEV DATABASE_URL is not a valid PostgreSQL URL."
    }

    if ($databaseUri.Scheme -notin @("postgres", "postgresql")) {
        throw "DEV DATABASE_URL is not PostgreSQL."
    }
    if (-not $databaseUri.Host.Equals($script:devPostgresServiceName, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Safety check failed: DEV DATABASE_URL does not target the DEV postgres service."
    }

    $postgresEnvironment = Convert-EnvironmentArrayToMap -Environment @($postgresInspect.Config.Env)
    if (-not $postgresEnvironment.ContainsKey("POSTGRES_DB") -or
        -not $postgresEnvironment.ContainsKey("POSTGRES_USER")) {
        throw "Unable to determine DEV PostgreSQL database/user from the DEV container."
    }

    $postgresDb = [string]$postgresEnvironment["POSTGRES_DB"]
    if ($postgresDb -in @("postgres", "template0", "template1")) {
        throw "DEV POSTGRES_DB '$postgresDb' is unsafe for application database replacement."
    }

    if ($databaseUri.AbsolutePath.TrimStart('/') -ne $postgresDb) {
        throw "DEV DATABASE_URL database name does not match the DEV PostgreSQL container."
    }

    $privateDataMounts = @($appInspect.Mounts | Where-Object {
        [string]$_.Destination -eq $script:devPrivateDataDestination
    })

    if ($privateDataMounts.Count -ne 1) {
        throw "DEV app must have exactly one private-data mount at $($script:devPrivateDataDestination); found $($privateDataMounts.Count)."
    }

    $privateDataMount = $privateDataMounts[0]
    if ([string]$privateDataMount.Type -ne "volume") {
        throw "Safety check failed: current DEV uploads are expected to use the existing named Docker volume, not a production-style bind path."
    }

    $volumeName = ([string]$privateDataMount.Name).Trim()
    if ([string]::IsNullOrWhiteSpace($volumeName)) {
        throw "Unable to determine the DEV private-data volume name."
    }
    if ($volumeName.IndexOf("rental-prod", [StringComparison]::OrdinalIgnoreCase) -ge 0) {
        throw "Safety check failed: DEV private-data volume appears to belong to production."
    }

    $volumeInspect = Get-DockerVolumeInspectObject -VolumeName $volumeName
    $volumeProject = [string]$volumeInspect.Labels.'com.docker.compose.project'
    $volumeLogicalName = [string]$volumeInspect.Labels.'com.docker.compose.volume'

    if (-not $volumeProject.Equals($appProject, [StringComparison]::OrdinalIgnoreCase)) {
        throw "DEV private-data volume does not belong to the target DEV Compose project."
    }
    if ($volumeLogicalName -ne "private-data") {
        throw "DEV private-data volume does not have the expected Compose volume identity."
    }

    $script:devProjectName = $appProject
    $script:devUploadsVolumeName = $volumeName
    $script:appImageId = [string]$appInspect.Image
    $script:devPostgresDb = $postgresDb
    $script:devPostgresUser = [string]$postgresEnvironment["POSTGRES_USER"]

    if ([string]::IsNullOrWhiteSpace($script:appImageId)) {
        throw "Unable to determine the DEV app image used for upload restoration."
    }
}

function Invoke-BackupVerification {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BackupRoot
    )

    if (-not (Test-Path -LiteralPath $script:verifyScript -PathType Leaf)) {
        throw "Missing scripts/prod-verify-backup.ps1."
    }

    $powerShellPath = (Get-Process -Id $PID).Path
    if ([string]::IsNullOrWhiteSpace($powerShellPath)) {
        throw "Unable to determine the current PowerShell executable."
    }

    $arguments = '-NoProfile -ExecutionPolicy Bypass -File "{0}" "{1}"' -f `
        $script:verifyScript.Replace('"', '\"'), `
        $BackupRoot.Replace('"', '\"')

    $process = Start-Process `
        -FilePath $powerShellPath `
        -ArgumentList $arguments `
        -NoNewWindow `
        -Wait `
        -PassThru

    if ($process.ExitCode -ne 0) {
        throw "Selected backup did not pass production backup verification."
    }
}

function Stop-DevApp {
    Write-Host "Stopping DEV app..."
    $exitCode = Invoke-DevCompose -Arguments @("stop", $script:devAppServiceName)
    if ($exitCode -ne 0) {
        throw "Unable to stop the DEV app service."
    }

    $script:appStopped = $true
    Write-Host "DEV app stopped"
}

function Restore-DevDatabase {
    param(
        [Parameter(Mandatory = $true)]
        [string]$DumpPath
    )

    $removeResult = Invoke-Docker -Arguments @(
        "exec", $script:postgresContainerId,
        "rm", "-f", $script:containerDumpPath
    ) -Quiet
    if ($removeResult -ne 0) {
        throw "Unable to clear the temporary DEV restore path inside PostgreSQL."
    }

    $copyResult = Invoke-Docker -Arguments @(
        "cp", $DumpPath, "${script:postgresContainerId}:$($script:containerDumpPath)"
    ) -Quiet
    if ($copyResult -ne 0) {
        throw "Unable to copy database.dump into the DEV PostgreSQL container."
    }
    $script:tempDumpMayExist = $true

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
    $replaceDatabaseCommand = ConvertTo-LinuxShellCommand -Command $replaceDatabaseCommand

    $script:devDatabaseModified = $true
    $restoreResult = Invoke-Docker -Arguments @(
        "exec", $script:postgresContainerId,
        "sh", "-lc", $replaceDatabaseCommand
    )
    if ($restoreResult -ne 0) {
        throw "DEV PostgreSQL restore failed."
    }
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
                throw "uploads.zip contains an entry that escapes the DEV restore staging directory."
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

function Restore-DevUploads {
    param(
        [Parameter(Mandatory = $true)]
        [string]$UploadsZipPath
    )

    if (Test-Path -LiteralPath $script:tempRoot) {
        throw "DEV restore staging directory already exists: $($script:tempRoot)"
    }

    New-Item -ItemType Directory -Path $script:tempRoot -Force | Out-Null
    Expand-UploadsArchiveSafely -ZipPath $UploadsZipPath -DestinationDirectory $script:tempUploadsDirectory

    $copyCommand = @'
set -eu
rm -rf /app/private-data/* /app/private-data/.[!.]* /app/private-data/..?*
mkdir -p /app/private-data
cp -Rp /tmp/restored-uploads/. /app/private-data/
'@
    $copyCommand = ConvertTo-LinuxShellCommand -Command $copyCommand

    $createResult = Invoke-Docker -Arguments @(
        "create",
        "--name", $script:uploadsHelperContainerName,
        "--mount", "type=volume,source=$($script:devUploadsVolumeName),target=$($script:devPrivateDataDestination)",
        "--entrypoint", "sh",
        $script:appImageId,
        "-lc", $copyCommand
    ) -CaptureOutput

    if ($createResult.ExitCode -ne 0) {
        throw "Unable to create the temporary DEV uploads restore container."
    }

    $copyResult = Invoke-Docker -Arguments @(
        "cp", $script:tempUploadsDirectory, "${script:uploadsHelperContainerName}:/tmp/restored-uploads"
    ) -Quiet
    if ($copyResult -ne 0) {
        throw "Unable to copy staged uploads into the temporary DEV restore container."
    }

    $script:devUploadsModified = $true
    $startResult = Invoke-Docker -Arguments @(
        "start", "-a", $script:uploadsHelperContainerName
    )
    if ($startResult -ne 0) {
        throw "Unable to replace the DEV private uploads volume."
    }
}

function Clear-DevAuthSessions {
    $clearSessionsCommand = @'
set -eu
export PGPASSWORD="$POSTGRES_PASSWORD"
psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
    session_table record;
BEGIN
    FOR session_table IN
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND lower(tablename) = 'session'
    LOOP
        EXECUTE format('DELETE FROM %I.%I', session_table.schemaname, session_table.tablename);
    END LOOP;
END
$$;
SQL
'@
    $clearSessionsCommand = ConvertTo-LinuxShellCommand -Command $clearSessionsCommand

    $result = Invoke-Docker -Arguments @(
        "exec", $script:postgresContainerId,
        "sh", "-lc", $clearSessionsCommand
    ) -Quiet

    if ($result -ne 0) {
        throw "Unable to clear restored DEV authentication sessions."
    }
}

function Ensure-DevPostgresReady {
    # A one-off Compose `run` container still needs the DEV postgres service on
    # the project network. Do not use --no-deps for migrations: that can create
    # the migration container while skipping dependency startup/readiness, which
    # results in Prisma P1001 (`postgres:5432` unreachable).
    $startResult = Invoke-DevCompose -Arguments @(
        "up", "-d", $script:devPostgresServiceName
    )
    if ($startResult -ne 0) {
        throw "Unable to ensure the DEV PostgreSQL service is running before migrations."
    }

    $script:postgresContainerId = Get-ContainerIdForDevService `
        -ServiceName $script:devPostgresServiceName `
        -RequireRunning

    $attempts = 60
    for ($attempt = 1; $attempt -le $attempts; $attempt++) {
        $readyResult = Invoke-Docker -Arguments @(
            "exec", $script:postgresContainerId,
            "pg_isready",
            "-h", "127.0.0.1",
            "-U", $script:devPostgresUser,
            "-d", $script:devPostgresDb
        ) -CaptureOutput

        if ($readyResult.ExitCode -eq 0) {
            return
        }

        Start-Sleep -Seconds 1
    }

    throw "DEV PostgreSQL did not become ready for migrations within $attempts seconds."
}

function Apply-DevMigrations {
    Ensure-DevPostgresReady

    $result = Invoke-DevCompose `
        -UseDebugOverlay `
        -Arguments @(
            "run", "--rm", "-T",
            $script:devAppServiceName,
            "pnpm", "exec", "prisma", "migrate", "deploy"
        )

    if ($result -ne 0) {
        throw "Current DEV Prisma migrations failed."
    }
}

function Start-DevApp {
    Write-Host "Starting DEV..."
    $exitCode = Invoke-DevCompose -Arguments @("start", $script:devAppServiceName)
    if ($exitCode -ne 0) {
        throw "DEV application failed to start."
    }

    Start-Sleep -Seconds 1
    $runningResult = Invoke-DevCompose -Arguments @(
        "ps", "--status", "running", "-q", $script:devAppServiceName
    ) -CaptureOutput
    $runningContainerId = Get-FirstOutputLine -Output $runningResult.Output

    if ($runningResult.ExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($runningContainerId)) {
        throw "DEV data restore completed, but DEV application failed to start."
    }

    $script:appStopped = $false
    Write-Host "DEV started"
}

function Remove-TemporaryResources {
    if ($script:tempDumpMayExist -and $script:postgresContainerId) {
        [void](Invoke-Docker -Arguments @(
            "exec", $script:postgresContainerId,
            "rm", "-f", $script:containerDumpPath
        ) -Quiet)
        $script:tempDumpMayExist = $false
    }

    $helperExists = Invoke-Docker -Arguments @(
        "ps", "-a", "-q", "--filter", "name=^/$($script:uploadsHelperContainerName)$"
    ) -CaptureOutput
    if ($helperExists.ExitCode -eq 0 -and
        -not [string]::IsNullOrWhiteSpace((Get-FirstOutputLine -Output $helperExists.Output))) {
        [void](Invoke-Docker -Arguments @("rm", "-f", $script:uploadsHelperContainerName) -Quiet)
    }

    if (Test-Path -LiteralPath $script:tempRoot) {
        Remove-Item -LiteralPath $script:tempRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}

$backupRoot = $null
$manifest = $null
$databaseDumpPath = $null
$uploadsZipPath = $null
$restoreSucceeded = $false
$failureReason = $null
$failureStage = $null

try {
    Write-Host "DEV restore from production backup"
    Write-Host ""

    $stage = "Input validation"
    $backupDirectoryForValidation = $BackupDirectory.TrimEnd(
        [char[]]@(
            [IO.Path]::DirectorySeparatorChar,
            [IO.Path]::AltDirectorySeparatorChar
        )
    )
    if ($backupDirectoryForValidation.EndsWith(".incomplete", [StringComparison]::OrdinalIgnoreCase)) {
        throw "Incomplete backup directories cannot be restored."
    }

    $backupRoot = Resolve-BackupRoot -Path $BackupDirectory
    if (-not (Test-Path -LiteralPath $backupRoot -PathType Container)) {
        throw "Backup directory does not exist: $backupRoot"
    }
    if ((Split-Path -Leaf $backupRoot).EndsWith(".incomplete", [StringComparison]::OrdinalIgnoreCase)) {
        throw "Incomplete backup directories cannot be restored."
    }

    foreach ($requiredFile in @("manifest.json", "database.dump", "uploads.zip")) {
        if (-not (Test-Path -LiteralPath (Join-Path $backupRoot $requiredFile) -PathType Leaf)) {
            throw "Required backup file is missing: $requiredFile"
        }
    }

    Assert-CommandAvailable -Name "docker"
    if (-not (Test-Path -LiteralPath $devComposeFile -PathType Leaf)) {
        throw "Missing docker-compose.yml."
    }

    $dockerVersion = Invoke-Docker -Arguments @("version", "--format", "{{.Server.Version}}") -CaptureOutput
    if ($dockerVersion.ExitCode -ne 0) {
        throw "Docker is unavailable or the Docker daemon is not running."
    }

    $stage = "DEV safety validation"
    Assert-DevTarget

    Write-Host "Backup:"
    Write-Host $backupRoot
    Write-Host ""
    Write-Host "Target DEV Compose project: $devProjectName"
    Write-Host "Target DEV uploads volume: $devUploadsVolumeName"
    Write-Host ""

    $stage = "Backup verification"
    Write-Host "Verifying backup..."
    Invoke-BackupVerification -BackupRoot $backupRoot
    Write-Host "Verification: PASSED"
    Write-Host ""

    $manifest = Read-BackupManifest -BackupRoot $backupRoot
    $databaseDumpPath = Resolve-BackupArtifactPath `
        -BackupRoot $backupRoot `
        -RelativePath ([string]$manifest.database.file)
    $uploadsZipPath = Resolve-BackupArtifactPath `
        -BackupRoot $backupRoot `
        -RelativePath ([string]$manifest.uploads.file)

    if (-not (Test-Path -LiteralPath $databaseDumpPath -PathType Leaf)) {
        throw "Database artifact referenced by manifest does not exist."
    }
    if (-not (Test-Path -LiteralPath $uploadsZipPath -PathType Leaf)) {
        throw "Uploads artifact referenced by manifest does not exist."
    }

    Write-Host "DEV restore from production backup"
    Write-Host ""
    Write-Host "Backup:"
    Write-Host $backupRoot
    Write-Host ""
    Write-Host "Backup app version:"
    Write-Host $manifest.appVersion
    Write-Host ""
    Write-Warning "THIS WILL REPLACE THE CURRENT DEVELOPMENT DATABASE AND DEVELOPMENT UPLOADS."
    Write-Host "PRODUCTION WILL NOT BE MODIFIED."
    Write-Host ""

    $confirmation = Read-Host "Type RESTORE DEV to continue"
    if ($confirmation -cne "RESTORE DEV") {
        Write-Host ""
        Write-Host "DEV restore cancelled."
        return
    }

    # Re-run the safety assertions immediately before the first destructive step
    # so a changed/recreated Docker target cannot silently redirect the restore.
    $stage = "DEV safety revalidation"
    Assert-DevTarget

    $stage = "Stopping DEV app"
    Stop-DevApp

    $stage = "DEV database restore"
    Write-Host "Restoring DEV database..."
    Restore-DevDatabase -DumpPath $databaseDumpPath
    Write-Host "Database restore: OK"

    $stage = "DEV uploads restore"
    Write-Host "Restoring DEV uploads..."
    Restore-DevUploads -UploadsZipPath $uploadsZipPath
    Write-Host "Uploads restore: OK"

    $stage = "DEV auth session cleanup"
    Write-Host "Clearing copied auth sessions..."
    Clear-DevAuthSessions
    Write-Host "Sessions cleared if present"

    $stage = "Prisma migration"
    Write-Host "Applying current DEV migrations..."
    Apply-DevMigrations
    Write-Host "Migrations: OK"

    $stage = "Starting DEV"
    Start-DevApp

    $restoreSucceeded = $true
}
catch {
    $failureReason = $_.Exception.Message
    $failureStage = $stage
}
finally {
    Remove-TemporaryResources
}

if (-not $restoreSucceeded) {
    Write-Host ""
    Write-Host "DEV restore FAILED"
    Write-Host ""
    Write-Host "Stage:"
    Write-Host $failureStage
    Write-Host ""
    Write-Host "Reason:"
    Write-Host $failureReason
    Write-Host ""
    Write-Host "DEV database modified: $devDatabaseModified"
    Write-Host "DEV uploads modified: $devUploadsModified"
    Write-Host "DEV app remains stopped: $appStopped"
    Write-Host "PRODUCTION WAS NOT MODIFIED."
    exit 1
}

Write-Host ""
Write-Host "DEV restore COMPLETED"
Write-Host ""
Write-Warning "DEV now contains production-derived sensitive data. Treat the restored database and private files as real production data."
Write-Host "PRODUCTION WAS NOT MODIFIED."
