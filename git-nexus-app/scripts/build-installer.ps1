[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$PayloadDirectory,
    [Parameter(Mandatory)][ValidatePattern('^\d+\.\d+\.\d+$')][string]$Version,
    [Parameter(Mandatory)][string]$OutputPath,
    [string]$Compiler = 'makensis'
)
$ErrorActionPreference = 'Stop'
$appRoot = Split-Path -Parent $PSScriptRoot
$repositoryRoot = Split-Path -Parent $appRoot
$payload = (Resolve-Path -LiteralPath $PayloadDirectory).Path
$required = @('git-nexus.exe', 'LICENSE.md', 'PRIVACY.md', 'THIRD_PARTY_NOTICES.md', 'THIRD-PARTY-LICENSES.txt', 'NSIS-LICENSES.txt', 'README.txt')
foreach ($name in $required) {
    if (-not (Test-Path -LiteralPath (Join-Path $payload $name) -PathType Leaf)) { throw "Missing installer payload: $name" }
}
$binary = [IO.File]::ReadAllBytes((Join-Path $payload 'git-nexus.exe'))
if ($binary.Length -lt 256 -or $binary[0] -ne 0x4D -or $binary[1] -ne 0x5A) { throw 'Invalid Windows executable.' }
$pe = [BitConverter]::ToInt32($binary, 0x3C)
if ($pe -lt 0 -or $pe + 94 -gt $binary.Length -or
    [BitConverter]::ToUInt32($binary, $pe) -ne 0x4550 -or
    [BitConverter]::ToUInt16($binary, $pe + 4) -ne 0x8664 -or
    [BitConverter]::ToUInt16($binary, $pe + 92) -ne 2) { throw 'Installer requires an x64 Windows GUI release build.' }
$fileVersion = (Get-Item -LiteralPath (Join-Path $payload 'git-nexus.exe')).VersionInfo.ProductVersion
if ($fileVersion -ne $Version) { throw "Executable version $fileVersion does not match package version $Version." }
$command = Get-Command $Compiler -ErrorAction SilentlyContinue
if (-not $command) { $command = Get-Command (Join-Path ${env:ProgramFiles(x86)} 'NSIS/makensis.exe') -ErrorAction SilentlyContinue }
if (-not $command) { throw 'Install NSIS 3.11 or newer, or supply its makensis.exe path with -Compiler.' }
$output = [IO.Path]::GetFullPath($OutputPath)
New-Item -ItemType Directory -Path (Split-Path -Parent $output) -Force | Out-Null
$size = [int][Math]::Ceiling((Get-ChildItem -LiteralPath $payload -File | Measure-Object -Property Length -Sum).Sum / 1024)
& $command.Source '/V2' "/DAPP_VERSION=$Version" "/DPAYLOAD_DIR=$payload" "/DREPOSITORY_ROOT=$repositoryRoot" "/DOUTPUT_FILE=$output" "/DINSTALLED_SIZE_KB=$size" (Join-Path $appRoot 'installer/windows.nsi')
if ($LASTEXITCODE -ne 0) { throw 'NSIS compilation failed.' }
$hash = (Get-FileHash -LiteralPath $output -Algorithm SHA256).Hash.ToLowerInvariant()
"$hash  $([IO.Path]::GetFileName($output))" | Set-Content -LiteralPath "$output.sha256" -Encoding ASCII
Write-Output "Created $output"
