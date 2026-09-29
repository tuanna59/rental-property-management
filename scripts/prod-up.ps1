$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "prod-common.ps1")

Assert-ProductionConfiguration
Ensure-ProductionUploadsDirectory

Push-Location $script:ProdRepoRoot
try {
    & docker compose `
        --env-file $script:ProdEnvFile `
        -p $script:ProdProjectName `
        -f $script:ProdComposeFile `
        up -d

    if ($LASTEXITCODE -ne 0) {
        throw "Production Compose failed to start."
    }
}
finally {
    Pop-Location
}
