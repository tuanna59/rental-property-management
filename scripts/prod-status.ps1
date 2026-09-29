$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "prod-common.ps1")

Assert-ProductionConfiguration

Push-Location $script:ProdRepoRoot
try {
    & docker compose `
        --env-file $script:ProdEnvFile `
        -p $script:ProdProjectName `
        -f $script:ProdComposeFile `
        ps

    if ($LASTEXITCODE -ne 0) {
        throw "Unable to read production Compose status."
    }
}
finally {
    Pop-Location
}
