param(
    [string]$ToolsRoot = (Join-Path $PSScriptRoot '..\_wip\tools\sdk26\command-line-tools'),
    [string]$JavaHome = (Join-Path $PSScriptRoot '..\_wip\tools\sdk26\command-line-tools\java'),
    [switch]$DeviceDebug
)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
& (Join-Path $projectRoot 'branding\Build-Brand.ps1')
$workRoot = Join-Path $projectRoot '_wip'
$buildRoot = Join-Path $workRoot 'build\harmony'
$expectedBuildRoot = [IO.Path]::GetFullPath((Join-Path $projectRoot '_wip\build\harmony'))
if ([IO.Path]::GetFullPath($buildRoot) -ne $expectedBuildRoot -or !$expectedBuildRoot.StartsWith($projectRoot + [IO.Path]::DirectorySeparatorChar)) { throw 'Unexpected build workspace.' }
# A fresh source copy also removes resources deleted or renamed since the previous build.
if (Test-Path -LiteralPath $buildRoot) { Remove-Item -LiteralPath $buildRoot -Recurse -Force }
$cacheRoot = Join-Path $workRoot 'cache'
$ToolsRoot = [IO.Path]::GetFullPath($ToolsRoot)
$appVersion = (Get-Content -LiteralPath (Join-Path $PSScriptRoot 'AppScope\app.json5') -Raw | ConvertFrom-Json).app.versionName
$buildMode = if ($DeviceDebug) { 'debug' } else { 'release' }
if ($appVersion -notmatch '^\d+\.\d+\.\d+$') { throw 'App version must use major.minor.patch format.' }
$nodeExe = Join-Path $ToolsRoot 'tool\node\node.exe'
$wrapper = Join-Path $ToolsRoot 'hvigor\bin\hvigorw.js'
if (-not (Test-Path -LiteralPath $nodeExe) -or -not (Test-Path -LiteralPath $wrapper)) {
    throw 'Extract the official Command Line Tools into _wip/tools/sdk26 first.'
}
if (-not (Test-Path -LiteralPath (Join-Path $JavaHome 'bin\java.exe'))) { throw 'Java runtime not found.' }
foreach ($directory in @($buildRoot, $cacheRoot, (Join-Path $cacheRoot 'temp'), (Join-Path $cacheRoot 'hvigor'), (Join-Path $cacheRoot 'ohpm'), (Join-Path $cacheRoot 'npm'), (Join-Path $cacheRoot 'java'))) {
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
}
# Build from a working copy so compiler output never mixes with maintained sources.
foreach ($item in @('AppScope', 'entry', 'hvigor', 'build-profile.json5', 'hvigorfile.ts', 'oh-package.json5')) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $item) -Destination $buildRoot -Recurse -Force
}
if ($DeviceDebug) {
    Set-Content -LiteralPath (Join-Path $buildRoot 'entry\src\main\ets\model\RuntimeMode.ets') -Value 'export const DEVICE_DEBUG: boolean = true;' -Encoding utf8
}
$buildEnvironment = @{
    HVIGOR_USER_HOME = (Join-Path $cacheRoot 'hvigor')
    OHPM_USER_HOME = (Join-Path $cacheRoot 'ohpm')
    npm_config_cache = (Join-Path $cacheRoot 'npm')
    DEVECO_SDK_HOME = (Join-Path $ToolsRoot 'sdk')
    DEVECO_NODE_HOME = (Join-Path $ToolsRoot 'tool\node')
    JAVA_HOME = $JavaHome
    JAVA_TOOL_OPTIONS = ('-Djava.io.tmpdir=' + (Join-Path $cacheRoot 'temp') + ' -Duser.home=' + (Join-Path $cacheRoot 'java'))
    TEMP = (Join-Path $cacheRoot 'temp')
    TMP = (Join-Path $cacheRoot 'temp')
    PATH = (Join-Path $ToolsRoot 'tool\node') + ';' + (Join-Path $JavaHome 'bin') + ';' + $env:PATH
}
$oldEnvironment = @{}
foreach ($key in $buildEnvironment.Keys) {
    $oldEnvironment[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
    [Environment]::SetEnvironmentVariable($key, $buildEnvironment[$key], 'Process')
}
Push-Location $buildRoot
try {
    & $nodeExe $wrapper --mode module -p product=default -p module=entry@default -p "buildMode=$buildMode" assembleHap --no-daemon --stacktrace 2>&1 | Tee-Object -FilePath (Join-Path $workRoot 'build-hap.log')
    if ($LASTEXITCODE -ne 0) { throw "HAP build failed (exit $LASTEXITCODE); inspect _wip/build-hap.log." }
    $package = Get-ChildItem -LiteralPath (Join-Path $buildRoot 'entry\build\default\outputs\default') -Filter '*unsigned.hap' -File | Select-Object -First 1
    if ($null -eq $package) { throw 'Build returned without an unsigned HAP.' }
    $output = Join-Path $projectRoot 'artifacts'
    New-Item -ItemType Directory -Path $output -Force | Out-Null
    $artifactName = if ($DeviceDebug) { "DSH-Connect-$appVersion-device-debug-unsigned.hap" } else { "DSH-Connect-$appVersion-unsigned.hap" }
    $destination = Join-Path $output $artifactName
    Copy-Item -LiteralPath $package.FullName -Destination $destination -Force
    Get-FileHash -LiteralPath $destination -Algorithm SHA256 | Select-Object Path,Hash
} finally {
    Pop-Location
    foreach ($key in $oldEnvironment.Keys) { [Environment]::SetEnvironmentVariable($key, $oldEnvironment[$key], 'Process') }
}
