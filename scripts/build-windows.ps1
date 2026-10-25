# Build Windows release package for Keybaht Live Chat
# Keep exe/setup asset names as YouTubeLiveChat-* for update compatibility.
# Usage: .\scripts\build-windows.ps1 [-Version "1.0.0"] [-SkipLauncher]

param(
    [string]$Version = "",
    [switch]$SkipLauncher
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

# Read version
$versionJson = Get-Content "version.json" | ConvertFrom-Json
if ($Version) {
    $AppVersion = $Version
} else {
    $AppVersion = $versionJson.version
}

Write-Host "Building version $AppVersion..." -ForegroundColor Cyan

# Update version.json
$versionJson.version = $AppVersion
$versionJson | ConvertTo-Json | Set-Content "version.json"

# Install all deps and build
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm ci

Write-Host "Building TypeScript..." -ForegroundColor Yellow
npm run build

if (-not (Test-Path "dist")) {
    throw "Build failed: dist/ folder not found"
}

# Prepare release/app staging
$AppDir = Join-Path $Root "release\app"
if (Test-Path $AppDir) { Remove-Item $AppDir -Recurse -Force }
New-Item -ItemType Directory -Path $AppDir -Force | Out-Null

# Copy app files (without node_modules)
Copy-Item "dist" -Destination $AppDir -Recurse
Copy-Item "public" -Destination $AppDir -Recurse
Copy-Item "package.json" -Destination $AppDir
Copy-Item "package-lock.json" -Destination $AppDir
Copy-Item "version.json" -Destination $AppDir
Copy-Item ".env.example" -Destination $AppDir
New-Item -ItemType Directory -Path (Join-Path $AppDir "data") -Force | Out-Null

# Install production-only dependencies inside app dir
Write-Host "Installing production dependencies in app bundle..." -ForegroundColor Yellow
Push-Location $AppDir
npm ci --omit=dev
Pop-Location

# Create app zip for GitHub Release
$ReleaseDir = Join-Path $Root "release"
$ZipName = "app-v$AppVersion.zip"
$ZipPath = Join-Path $ReleaseDir $ZipName
if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }

Write-Host "Creating $ZipName..." -ForegroundColor Yellow
Compress-Archive -Path $AppDir -DestinationPath $ZipPath -Force

# Download Node.js portable if not present
$NodeDir = Join-Path $ReleaseDir "node"
$NodeExe = Join-Path $NodeDir "node.exe"
if (-not (Test-Path $NodeExe)) {
    Write-Host "Downloading Node.js portable..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $NodeDir -Force | Out-Null
    # Node 22+: Edge TTS WebSocket works; Node 20 often fails handshake
    $nodeUrl = "https://nodejs.org/dist/v22.20.0/node-v22.20.0-win-x64.zip"
    $nodeZip = Join-Path $ReleaseDir "node-temp.zip"
    Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeZip
    Expand-Archive -Path $nodeZip -DestinationPath $ReleaseDir -Force
    $extracted = Join-Path $ReleaseDir "node-v22.20.0-win-x64"
    Copy-Item "$extracted\*" -Destination $NodeDir -Recurse
    Remove-Item $nodeZip -Force
    Remove-Item $extracted -Recurse -Force
}

# Build launcher exe
if (-not $SkipLauncher) {
    Write-Host "Building launcher..." -ForegroundColor Yellow
    Set-Location (Join-Path $Root "launcher")
    if (-not (Test-Path "node_modules")) {
        npm install
    }
    npx pkg . --targets node18-win-x64 --output (Join-Path $ReleaseDir "YouTubeLiveChat.exe")
    Set-Location $Root
    # Do NOT run rcedit on pkg binaries — it corrupts them (exe exits immediately).
    # Desktop/Start Menu icons use app.ico via Inno Setup IconFilename instead.
    Copy-Item (Join-Path $Root "branding\app.ico") (Join-Path $ReleaseDir "app.ico") -Force
}

# Build Inno Setup installer if available
$Iscc = @(
    "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
    "${env:ProgramFiles}\Inno Setup 6\ISCC.exe",
    "iscc"
) | Where-Object { (Test-Path $_) -or (Get-Command $_ -ErrorAction SilentlyContinue) } | Select-Object -First 1

if ($Iscc) {
    Write-Host "Building installer with Inno Setup..." -ForegroundColor Yellow
    & $Iscc "installer\setup.iss" "/DMyAppVersion=$AppVersion"
    Write-Host "Installer: release\YouTubeLiveChat-Setup-$AppVersion.exe" -ForegroundColor Green
} else {
    Write-Host "Inno Setup not found — skip installer build" -ForegroundColor Yellow
    Write-Host "Install from: https://jrsoftware.org/isinfo.php" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Build complete!" -ForegroundColor Green
Write-Host "  App zip:     release\$ZipName"
Write-Host "  Launcher:    release\YouTubeLiveChat.exe"
Write-Host ""
Write-Host "GitHub Release: upload these files:" -ForegroundColor Cyan
Write-Host "  - release\$ZipName"
Write-Host "  - release\YouTubeLiveChat-Setup-$AppVersion.exe (if built)"
