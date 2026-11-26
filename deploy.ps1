# ============================================================
# deploy.ps1
# Publishes MarinaControl WebApp under /webapp/
# ============================================================

$ErrorActionPreference = "Stop"

$source = $PSScriptRoot
$siteRoot = "C:\Users\lbess\Documents\MarinaControlWebsite\MarinaControlWebsite"
$dest = Join-Path $siteRoot "public\webapp"
$projectId = "firstapp-1bcf1005"

Write-Host ""
Write-Host "=== MarinaControl WebApp Deploy ===" -ForegroundColor Cyan
Write-Host "Source:      $source"
Write-Host "Destination: $dest"
Write-Host "Project:     $projectId"
Write-Host ""

# Validate required source items
$required = @(
    "$source\index.html",
    "$source\assets",
    "$source\css",
    "$source\js",
    "$siteRoot\firebase.json",
    "$siteRoot\public\index.html"
)

foreach ($item in $required) {
    if (!(Test-Path $item)) {
        Write-Host "ERROR: Required item not found: $item" -ForegroundColor Red
        exit 1
    }
}

New-Item -ItemType Directory -Force -Path $dest | Out-Null

Write-Host "Copying index.html..." -ForegroundColor Yellow
Copy-Item "$source\index.html" "$dest\index.html" -Force

# Exclude source-only copies from the website's Hosting directory.
$excludedDirs = @("backups", "screens - Copy")
$excludedFiles = @("components - Copy.css", "screen-backup.css", "theme-back.css", "*_backup.*")

foreach ($folder in @("assets", "css", "js")) {
    Write-Host "Synchronising $folder..." -ForegroundColor Yellow

    robocopy "$source\$folder" "$dest\$folder" /MIR /R:2 /W:1 /NFL /NDL /NJH /NJS /XD $excludedDirs /XF $excludedFiles

    if ($LASTEXITCODE -ge 8) {
        Write-Host "ERROR: Failed to synchronise $folder." -ForegroundColor Red
        exit $LASTEXITCODE
    }
}

# Robocopy exclusions can also protect old destination copies from /MIR.
foreach ($relativePath in @("js\backups", "js\screens - Copy")) {
    $path = Join-Path $dest $relativePath
    if (Test-Path -LiteralPath $path) {
        Remove-Item -LiteralPath $path -Recurse -Force
    }
}
foreach ($folder in @("assets", "css", "js")) {
    Get-ChildItem -LiteralPath (Join-Path $dest $folder) -File -Recurse -Force |
        Where-Object {
            $_.Name -in $excludedFiles -or $_.Name -like "*_backup.*"
        } |
        Remove-Item -Force
}

Write-Host "Copy complete." -ForegroundColor Green
Write-Host ""
Write-Host "Deploying website and WebApp..." -ForegroundColor Yellow

Push-Location $siteRoot

try {
    firebase deploy --only hosting --project $projectId

    if ($LASTEXITCODE -ne 0) {
        throw "Firebase deployment failed with exit code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "Deployment complete." -ForegroundColor Green
Write-Host "Website: https://marinacontrol.co.uk/" -ForegroundColor Cyan
Write-Host "WebApp:  https://marinacontrol.co.uk/webapp/" -ForegroundColor Cyan