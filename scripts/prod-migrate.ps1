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
        run --rm app pnpm exec prisma migrate deploy

    if ($LASTEXITCODE -ne 0) {
        throw "Production migration failed."
    }
}
finally {
    Pop-Location
}
