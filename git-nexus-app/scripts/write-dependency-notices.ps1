[CmdletBinding()]
param([Parameter(Mandatory)][string]$OutputPath)
$ErrorActionPreference = 'Stop'
$metadataJson = & cargo metadata --locked --format-version 1 --filter-platform x86_64-pc-windows-msvc
if ($LASTEXITCODE -ne 0) { throw 'Could not resolve dependency notices.' }
$metadata = $metadataJson | ConvertFrom-Json
$packages = @{}
$nodes = @{}
foreach ($package in $metadata.packages) { $packages[$package.id] = $package }
foreach ($node in $metadata.resolve.nodes) { $nodes[$node.id] = $node }
$root = $metadata.packages | Where-Object { $_.name -eq 'git-nexus-desktop' }
$pending = [Collections.Generic.Queue[string]]::new()
$seen = [Collections.Generic.HashSet[string]]::new()
$pending.Enqueue($root.id)
while ($pending.Count -gt 0) {
    $id = $pending.Dequeue()
    if (-not $seen.Add($id)) { continue }
    foreach ($dependency in $nodes[$id].dependencies) { $pending.Enqueue($dependency) }
}
$output = [Text.StringBuilder]::new()
[void]$output.AppendLine('GitNexus: Rust dependency copyrights and license notices')
[void]$output.AppendLine('Generated from the locked Windows dependency graph. Build dependencies are included.')
foreach ($package in ($metadata.packages | Where-Object { $_.source -and $seen.Contains($_.id) } | Sort-Object name, version)) {
    [void]$output.AppendLine("`n========================================================================")
    [void]$output.AppendLine("$($package.name) $($package.version)")
    [void]$output.AppendLine("License: $($package.license)")
    [void]$output.AppendLine("Source: $($package.repository)")
    $directory = Split-Path -Parent $package.manifest_path
    $licenseFiles = @(Get-ChildItem -LiteralPath $directory -File | Where-Object { $_.Name -match '^(LICENSE|LICENCE|COPYING|NOTICE|COPYRIGHT)([.\-_]|$)' })
    if ($package.license_file) {
        $specified = Join-Path $directory $package.license_file
        if (Test-Path -LiteralPath $specified -PathType Leaf) { $licenseFiles += Get-Item -LiteralPath $specified }
    }
    foreach ($file in ($licenseFiles | Sort-Object FullName -Unique)) {
        [void]$output.AppendLine("`n--- $($file.Name) ---")
        [void]$output.AppendLine([IO.File]::ReadAllText($file.FullName))
    }
}
foreach ($relativePath in @('vendor/gpui-component/LICENSE-APACHE', 'vendor/xattr/LICENSE-APACHE', 'vendor/xattr/LICENSE-MIT', 'crates/desktop/assets/LUCIDE-LICENSE')) {
    [void]$output.AppendLine("`n========================================================================`n$relativePath")
    [void]$output.AppendLine([IO.File]::ReadAllText((Join-Path (Split-Path -Parent $PSScriptRoot) $relativePath)))
}
[IO.File]::WriteAllText([IO.Path]::GetFullPath($OutputPath), $output.ToString(), [Text.UTF8Encoding]::new($false))
