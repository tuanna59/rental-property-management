$script:ProdRepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$script:ProdEnvFile = Join-Path $script:ProdRepoRoot ".env.production"
$script:ProdComposeFile = Join-Path $script:ProdRepoRoot "compose.prod.yml"
$script:ProdProjectName = "rental-prod"

function Get-ProductionEnvValue {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    if (-not (Test-Path -LiteralPath $script:ProdEnvFile)) {
        throw "Missing .env.production. Copy .env.production.example and configure it first."
    }

    $escapedName = [Regex]::Escape($Name)
    $match = Get-Content -LiteralPath $script:ProdEnvFile |
        Where-Object { $_ -match "^\s*$escapedName\s*=" } |
        Select-Object -Last 1

    if (-not $match) {
        throw "$Name is missing from .env.production."
    }

    $value = ($match -replace "^\s*$escapedName\s*=\s*", "").Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or
        ($value.StartsWith("'") -and $value.EndsWith("'"))) {
        $value = $value.Substring(1, $value.Length - 2)
    }

    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "$Name must not be empty in .env.production."
    }

    return $value
}

function Assert-ProductionConfiguration {
    $appEnv = Get-ProductionEnvValue -Name "APP_ENV"
    if ($appEnv -ne "production") {
        throw "APP_ENV must be exactly 'production' in .env.production."
    }

    $appVersion = Get-ProductionEnvValue -Name "APP_VERSION"
    if ($appVersion -notmatch '^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$') {
        throw "APP_VERSION is not a valid Docker image tag."
    }

    $databaseUrl = Get-ProductionEnvValue -Name "DATABASE_URL"
    try {
        $databaseUri = [Uri]$databaseUrl
    }
    catch {
        throw "DATABASE_URL must be a valid PostgreSQL URL."
    }

    if ($databaseUri.Scheme -notin @("postgres", "postgresql")) {
        throw "DATABASE_URL must use the postgres or postgresql scheme."
    }

    if ($databaseUri.Host -ne "postgres") {
        throw "Production DATABASE_URL must use the production Compose hostname 'postgres', not localhost or a DEV host."
    }

    $postgresDb = Get-ProductionEnvValue -Name "POSTGRES_DB"
    if ($databaseUri.AbsolutePath.TrimStart('/') -ne $postgresDb) {
        throw "DATABASE_URL database name must match POSTGRES_DB."
    }

    $postgresUser = Get-ProductionEnvValue -Name "POSTGRES_USER"
    $postgresPassword = Get-ProductionEnvValue -Name "POSTGRES_PASSWORD"
    $userInfoParts = $databaseUri.UserInfo -split ':', 2
    $databaseUser = [Uri]::UnescapeDataString($userInfoParts[0])
    $databasePassword = if ($userInfoParts.Length -eq 2) {
        [Uri]::UnescapeDataString($userInfoParts[1])
    }
    else {
        ""
    }

    if ($databaseUser -ne $postgresUser -or $databasePassword -ne $postgresPassword) {
        throw "DATABASE_URL credentials must match POSTGRES_USER and POSTGRES_PASSWORD. URL-encode special password characters."
    }

    [void](Get-ProductionEnvValue -Name "PERSON_CITIZEN_ID_ENCRYPTION_KEY")
    [void](Get-ProductionEnvValue -Name "PERSON_CITIZEN_ID_LOOKUP_HMAC_KEY")
    [void](Get-ProductionEnvValue -Name "PROD_UPLOADS_PATH")
}

function Ensure-ProductionUploadsDirectory {
    $uploadsPath = Get-ProductionEnvValue -Name "PROD_UPLOADS_PATH"
    if (-not (Test-Path -LiteralPath $uploadsPath)) {
        New-Item -ItemType Directory -Path $uploadsPath -Force | Out-Null
    }
}
