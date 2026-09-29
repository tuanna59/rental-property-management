param(
    [Parameter(Position = 0)]
    [string]$Version
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Version)) {
    throw "A production image version is required. Example: .\scripts\prod-build.ps1 v1.0.0"
}

if ($Version -notmatch '^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$') {
    throw "Invalid Docker image tag: '$Version'."
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$image = "rental-house:$Version"

Push-Location $repoRoot
try {
    Write-Host "Building $image using Dockerfile.prod..."
    & docker build --file Dockerfile.prod --tag $image .
    if ($LASTEXITCODE -ne 0) {
        throw "Production image build failed."
    }

    Write-Host "Built $image"
}
finally {
    Pop-Location
}
