param(
    [string]$DataRoot = "$PSScriptRoot\..\data",
    [string]$AdminToken = "change-me-admin-token",
    [ValidateSet('file', 'sqlite')]
    [string]$StorageDriver = 'file'
)

$ErrorActionPreference = 'Stop'

$serverRoot = Split-Path -Parent $PSScriptRoot
Set-Location $serverRoot

if (-not (Test-Path $DataRoot)) {
    New-Item -ItemType Directory -Path $DataRoot | Out-Null
}

$env:AQA_PULSE_DATA_ROOT = (Resolve-Path $DataRoot).Path
$env:AQA_PULSE_ADMIN_TOKEN = $AdminToken
$env:AQA_PULSE_STORAGE_DRIVER = $StorageDriver
$env:AQA_PULSE_SQLITE_PATH = Join-Path $env:AQA_PULSE_DATA_ROOT 'aqa-pulse.sqlite'
$env:AQA_PULSE_ENABLE_DEV_BOOTSTRAP = 'false'
$env:AQA_PULSE_REQUIRE_WORKSPACE_AUTH = 'true'

Write-Host '==> Installing dependencies'
npm install

Write-Host '==> Building self-hosted server package'
npm run build

Write-Host '==> Initializing storage'
npm run init

Write-Host ''
Write-Host 'Self-hosted AQA Pulse is prepared.'
Write-Host "Data root: $env:AQA_PULSE_DATA_ROOT"
Write-Host "Storage driver: $env:AQA_PULSE_STORAGE_DRIVER"
Write-Host "SQLite path: $env:AQA_PULSE_SQLITE_PATH"
Write-Host ''
Write-Host 'Run server in the same terminal:'
Write-Host 'npm run start'

