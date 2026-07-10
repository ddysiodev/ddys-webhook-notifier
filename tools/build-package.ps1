param(
  [string]$Version = "0.1.0",
  [string]$OutputDir = "..\..\..\releases"
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$Out = Join-Path $Root $OutputDir
New-Item -ItemType Directory -Force -Path $Out | Out-Null

$Zip = Join-Path $Out ("ddys-webhook-notifier-v{0}.zip" -f $Version)
if (Test-Path -LiteralPath $Zip) {
  Remove-Item -LiteralPath $Zip -Force
}

$SkipDirs = @("node_modules", "dist", "coverage", "package", ".wrangler", ".git")
$SkipFiles = @("pnpm-lock.yaml", "package-lock.json", "yarn.lock")

$Files = Get-ChildItem -LiteralPath $Root -Recurse -Force -File | Where-Object {
  $relative = $_.FullName.Substring($Root.Path.Length + 1).Replace("\", "/")
  $segments = $relative -split "/"
  foreach ($segment in $segments) {
    if ($SkipDirs -contains $segment) { return $false }
  }
  if ($SkipFiles -contains $_.Name) { return $false }
  if ($_.Name -match "^\.env" -and $_.Name -ne ".env.example") { return $false }
  if ($_.Name -match "\.(log|tmp|cache|tgz|zip)$") { return $false }
  return $true
}

Compress-Archive -LiteralPath $Files.FullName -DestinationPath $Zip -Force
Write-Host $Zip
