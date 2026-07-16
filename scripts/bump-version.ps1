<#
.SYNOPSIS
  Bumps the app and service worker cache versions.

.PARAMETER Version
  Semantic version string, e.g. "1.2.0"
#>
param(
    [Parameter(Mandatory)]
    [ValidatePattern('^\d+\.\d+\.\d+$')]
    [string]$Version
)

$root = Split-Path $PSScriptRoot -Parent
$ErrorActionPreference = 'Stop'

$versionFile = Join-Path $root 'src/version.js'
$content = Get-Content $versionFile -Raw
$content = $content -replace "APP_VERSION = '[^']+'", "APP_VERSION = '$Version'"
Set-Content $versionFile $content -NoNewline
Write-Host "  src/version.js -> $Version"

$swFile = Join-Path $root 'sw.js'
$content = Get-Content $swFile -Raw
$content = $content -replace "CACHE_NAME = '[^']+'", "CACHE_NAME = 'encodeomatic2-v$Version'"
Set-Content $swFile $content -NoNewline
Write-Host "  sw.js -> encodeomatic2-v$Version"

Write-Host "`nVersion bumped to $Version" -ForegroundColor Green
