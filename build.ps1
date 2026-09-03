<#
.SYNOPSIS
    Windows/PowerShell equivalent of the Makefile.

    The actual logic lives in hack/*.js so this and the Makefile install
    the same deps and run the same code instead of drifting apart.

.EXAMPLE
    ./build.ps1 package
.EXAMPLE
    ./build.ps1 screenshot
#>
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('package', 'screenshot')]
    [string]$Task
)

$ErrorActionPreference = 'Stop'
$hackDir = Join-Path $PSScriptRoot 'hack'

Push-Location $hackDir
try {
    npm install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw "npm install failed with exit code $LASTEXITCODE" }

    npm run --silent $Task
    if ($LASTEXITCODE -ne 0) { throw "npm run $Task failed with exit code $LASTEXITCODE" }
}
finally {
    Pop-Location
}
