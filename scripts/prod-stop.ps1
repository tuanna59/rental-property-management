$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "prod-common.ps1")

Assert-ProductionConfiguration

Push-Location $script:ProdRepoRoot
try {
    & docker compose `
        --env-file $script:ProdEnvFile `
        -p $script:ProdProjectName `
        -f $script:ProdComposeFile `
        down

    if ($LASTEXITCODE -ne 0) {
        throw "Production Compose failed to stop cleanly."
    }
}
finally {
    Pop-Location
}
