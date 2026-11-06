[CmdletBinding()]
param(
  [string]$ToolsRoot = (Join-Path $PSScriptRoot '_wip\tools\sdk26\command-line-tools'),
  [string]$JavaHome = (Join-Path $ToolsRoot 'java'),
  [switch]$SkipHap
)
$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$cacheRoot = Join-Path $projectRoot '_wip\cache'
$logRoot = Join-Path $projectRoot '_wip\release'
foreach ($directory in @($logRoot, (Join-Path $cacheRoot 'npm'), (Join-Path $cacheRoot 'temp'), (Join-Path $projectRoot 'artifacts'))) { New-Item -ItemType Directory -Path $directory -Force | Out-Null }
$previous = @{}
$values = @{ npm_config_cache = (Join-Path $cacheRoot 'npm'); TEMP = (Join-Path $cacheRoot 'temp'); TMP = (Join-Path $cacheRoot 'temp') }
foreach ($key in $values.Keys) { $previous[$key] = [Environment]::GetEnvironmentVariable($key, 'Process'); [Environment]::SetEnvironmentVariable($key, $values[$key], 'Process') }
Push-Location $projectRoot
try {
  & (Join-Path $projectRoot 'branding\Build-Brand.ps1')
  node tools/sync-package.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Package metadata generation failed.' }
  node desktop-plugin/tools/sync-settings-icon.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Plugin icon generation failed.' }
  npm ci --ignore-scripts --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
  npm run check
  if ($LASTEXITCODE -ne 0) { throw 'Source checks failed.' }
  npm test
  if ($LASTEXITCODE -ne 0) { throw 'Connector regression failed.' }
  if (!$SkipHap) { & (Join-Path $projectRoot 'harmony\Build-Hap.ps1') -ToolsRoot $ToolsRoot -JavaHome $JavaHome }
  npm pack --pack-destination (Join-Path $projectRoot 'artifacts') --json | Set-Content -LiteralPath (Join-Path $logRoot 'npm-pack.json') -Encoding utf8
  if ($LASTEXITCODE -ne 0) { throw 'Plugin packaging failed.' }
  python tools/package_release.py
  if ($LASTEXITCODE -ne 0) { throw 'Release readback failed.' }
  & (Join-Path $projectRoot 'branding\Build-Brand.ps1') -Check
} finally {
  Pop-Location
  foreach ($key in $previous.Keys) { [Environment]::SetEnvironmentVariable($key, $previous[$key], 'Process') }
}
