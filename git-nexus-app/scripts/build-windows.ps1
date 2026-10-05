[CmdletBinding()]
param(
    [switch]$SkipTests,
    [string]$Compiler = 'makensis',
    [string]$ShaderCompiler = $env:GPUI_FXC_PATH,
    [ValidateRange(1, 8)][int]$Jobs = 2
)
$ErrorActionPreference = 'Stop'
$appRoot = Split-Path -Parent $PSScriptRoot
$repositoryRoot = Split-Path -Parent $appRoot
$originalShaderCompiler = $env:GPUI_FXC_PATH
Push-Location $appRoot
try {
    if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) { throw 'Install Rust and the Visual Studio C++ build tools first.' }
    if (-not $ShaderCompiler) {
        $fxcCommand = Get-Command fxc.exe -ErrorAction SilentlyContinue
        if ($fxcCommand) { $ShaderCompiler = $fxcCommand.Source }
        else {
            $sdkRoot = (Get-ItemProperty 'HKLM:/SOFTWARE/Microsoft/Windows Kits/Installed Roots' -ErrorAction SilentlyContinue).KitsRoot10
            if ($sdkRoot) {
                $versions = Get-ChildItem -LiteralPath (Join-Path $sdkRoot 'bin') -Directory | Where-Object { $_.Name -match '^\d+\.\d+\.\d+\.\d+$' } | Sort-Object { [version]$_.Name } -Descending
                foreach ($sdkVersion in $versions) {
                    $candidate = Join-Path $sdkVersion.FullName 'x64/fxc.exe'
                    if (Test-Path -LiteralPath $candidate -PathType Leaf) { $ShaderCompiler = $candidate; break }
                }
            }
        }
    }
    if (-not $ShaderCompiler -or -not (Test-Path -LiteralPath $ShaderCompiler -PathType Leaf)) { throw 'Install the Windows SDK shader compiler, or pass -ShaderCompiler with the full fxc.exe path.' }
    $env:GPUI_FXC_PATH = (Resolve-Path -LiteralPath $ShaderCompiler).Path
    if (-not $SkipTests) {
        & cargo test --workspace --locked -j $Jobs
        if ($LASTEXITCODE -ne 0) { throw 'Tests failed; packaging stopped.' }
    }
    & cargo build --release --locked -p git-nexus-desktop -j $Jobs
    if ($LASTEXITCODE -ne 0) { throw 'Release build failed; packaging stopped.' }
    $metadataJson = & cargo metadata --locked --no-deps --format-version 1
    if ($LASTEXITCODE -ne 0) { throw 'Could not read package metadata.' }
    $metadata = $metadataJson | ConvertFrom-Json
    $package = $metadata.packages | Where-Object { $_.name -eq 'git-nexus-desktop' }
    $version = $package.version
    $packageName = "GitNexus-$version-windows-x64-portable"
    $dist = Join-Path $appRoot 'dist'
    $staging = Join-Path $dist ('.package-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $staging -Force | Out-Null
    try {
        Copy-Item -LiteralPath (Join-Path $metadata.target_directory 'release/git-nexus.exe') -Destination $staging
        foreach ($document in @('LICENSE.md', 'PRIVACY.md', 'THIRD_PARTY_NOTICES.md')) { Copy-Item -LiteralPath (Join-Path $repositoryRoot $document) -Destination $staging }
        Copy-Item -LiteralPath (Join-Path $appRoot 'installer/licenses/NSIS.txt') -Destination (Join-Path $staging 'NSIS-LICENSES.txt')
        & (Join-Path $PSScriptRoot 'write-dependency-notices.ps1') -OutputPath (Join-Path $staging 'THIRD-PARTY-LICENSES.txt')
        @"
GitNexus $version for Windows x64

Run git-nexus.exe. Git must be installed and available on PATH for cloning and Replay.
Microsoft Visual C++ x64 runtime is required: https://aka.ms/vc14/vc_redist.x64.exe
Settings and caches are stored in your Windows user profile, independently of this folder.
Use --data-dir PATH to choose another data directory. Keep gitnexus.db and secret.key together in private backups.

This build is unsigned. See LICENSE.md, PRIVACY.md and THIRD_PARTY_NOTICES.md.
Project: https://github.com/qtremors/git-nexus
"@ | Set-Content -LiteralPath (Join-Path $staging 'README.txt') -Encoding UTF8
        $installer = Join-Path $dist "GitNexus-$version-windows-x64-setup.exe"
        & (Join-Path $PSScriptRoot 'build-installer.ps1') -PayloadDirectory $staging -Version $version -OutputPath $installer -Compiler $Compiler
        $archive = Join-Path $dist "$packageName.zip"
        $files = Get-ChildItem -LiteralPath $staging -File
        Compress-Archive -LiteralPath $files.FullName -DestinationPath $archive -Force
        $hash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
        "$hash  $packageName.zip" | Set-Content -LiteralPath "$archive.sha256" -Encoding ASCII
        Write-Output "Created $archive"
    }
    finally {
        $resolvedStaging = (Resolve-Path -LiteralPath $staging).Path
        $expectedDist = [IO.Path]::GetFullPath($dist)
        if (-not $resolvedStaging.StartsWith($expectedDist + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Staging directory escaped dist.' }
        Remove-Item -LiteralPath $resolvedStaging -Recurse -Force
    }
}
finally { $env:GPUI_FXC_PATH = $originalShaderCompiler; Pop-Location }
