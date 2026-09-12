# Antigravity SDLC Plugin Installer
[CmdletBinding()]
param(
    [switch]$SkipHooks
)

$ErrorActionPreference = "Stop"

function Write-Step ($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Success ($msg) { Write-Host " [OK] $msg" -ForegroundColor Green }
function Write-Err ($msg) { Write-Host " [ERROR] $msg" -ForegroundColor Red }

# 1. Locate Antigravity CLI
Write-Step "Checking for Antigravity (agy) CLI..."

$agyCmd = Get-Command "agy" -ErrorAction SilentlyContinue
if (-not $agyCmd) {
    $fallback = Join-Path $env:LOCALAPPDATA "agy\bin\agy.exe"
    if (Test-Path $fallback) {
        $agyPath = $fallback
    } else {
        Write-Err "Antigravity CLI ('agy') was not found on PATH or in $fallback."
        Write-Host "Please install Google Antigravity before running this installer."
        exit 1
    }
} else {
    $agyPath = $agyCmd.Source
}
Write-Success "Found Antigravity CLI: $agyPath"

# 2. Resolve plugin directory (local repo or download from GitHub)
$tempDir = $null
$sdlcSource = $null

if ($PSScriptRoot -and (Test-Path (Join-Path $PSScriptRoot "sdlc\plugin.json"))) {
    $sdlcSource = Join-Path $PSScriptRoot "sdlc"
    Write-Step "Using local source: $sdlcSource"
} else {
    Write-Step "Downloading plugin from GitHub..."
    $tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("sdlc-pkg-" + [System.Guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

    $zipUrl = "https://github.com/rahul-k-r/rkr-claude-plugins/archive/refs/heads/main.zip"
    $zipFile = Join-Path $tempDir "repo.zip"

    try {
        Invoke-WebRequest -Uri $zipUrl -OutFile $zipFile -UseBasicParsing
        Expand-Archive -Path $zipFile -DestinationPath $tempDir -Force
        $extractedRoot = Join-Path $tempDir "rkr-claude-plugins-main"
        if (-not (Test-Path (Join-Path $extractedRoot "sdlc\plugin.json"))) {
            throw "Downloaded archive does not contain sdlc/plugin.json"
        }
        $sdlcSource = Join-Path $extractedRoot "sdlc"
        Write-Success "Downloaded and extracted plugin."
    } catch {
        # Fallback to git clone if archive download fails
        Write-Host "Archive download failed ($($_.Exception.Message)), falling back to git..."
        git clone --depth 1 "https://github.com/rahul-k-r/rkr-claude-plugins.git" (Join-Path $tempDir "clone") 2>$null
        $sdlcSource = Join-Path $tempDir "clone\sdlc"
        if (-not (Test-Path (Join-Path $sdlcSource "plugin.json"))) {
            Write-Err "Failed to fetch repository."
            if (Test-Path $tempDir) { Remove-Item -Recurse -Force $tempDir }
            exit 1
        }
    }
}

# 3. Install via agy CLI
Write-Step "Installing sdlc plugin into Antigravity..."
try {
    & $agyPath plugin install $sdlcSource
    if ($LASTEXITCODE -ne 0) {
        throw "agy plugin install failed with exit code $LASTEXITCODE"
    }
    Write-Success "Plugin installed into ~/.gemini/config/plugins/sdlc"
} finally {
    if ($tempDir -and (Test-Path $tempDir)) {
        Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
    }
}

# 4. Configure safety hooks in ~/.gemini/config/hooks.json
if (-not $SkipHooks) {
    Write-Step "Configuring safety hooks..."
    $configDir = Join-Path $HOME ".gemini\config"
    if (-not (Test-Path $configDir)) {
        New-Item -ItemType Directory -Path $configDir -Force | Out-Null
    }

    $hooksFile = Join-Path $configDir "hooks.json"
    $hooksObj = @{}

    if (Test-Path $hooksFile) {
        try {
            $content = Get-Content $hooksFile -Raw -Encoding UTF8
            if ($content.Trim()) {
                $hooksObj = $content | ConvertFrom-Json -AsHashtable
            }
        } catch {
            Copy-Item $hooksFile "$hooksFile.bak" -Force
            $hooksObj = @{}
        }
    }

    $gateGit = (Join-Path $configDir "plugins\sdlc\hooks-antigravity\gate-git.js").Replace('\', '/')
    $guardTools = (Join-Path $configDir "plugins\sdlc\hooks-antigravity\guard-agent-tools.js").Replace('\', '/')

    $hooksObj["sdlc"] = @{
        "enabled" = $true
        "PreToolUse" = @(
            @{
                "matcher" = "run_command"
                "hooks" = @(
                    @{
                        "type" = "command"
                        "command" = "node `"$gateGit`""
                        "timeout" = 15
                    }
                )
            },
            @{
                "matcher" = ".*"
                "hooks" = @(
                    @{
                        "type" = "command"
                        "command" = "node `"$guardTools`""
                        "timeout" = 15
                    }
                )
            }
        )
    }

    $jsonOut = $hooksObj | ConvertTo-Json -Depth 10
    Set-Content -Path $hooksFile -Value $jsonOut -Encoding UTF8
    Write-Success "Hooks active: Git branch protection and tool guardrails configured."
}

Write-Host "`nInstallation finished successfully!" -ForegroundColor Green
Write-Host "In any Antigravity chat, type /sdlc:help to view available commands.`n" -ForegroundColor Cyan
