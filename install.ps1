# Antigravity SDLC Plugin Installer
[CmdletBinding()]
param(
    [switch]$SkipHooks,
    [switch]$Codex
)

$ErrorActionPreference = "Stop"

function Write-Step ($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Success ($msg) { Write-Host " [OK] $msg" -ForegroundColor Green }
function Write-Err ($msg) { Write-Host " [ERROR] $msg" -ForegroundColor Red }

if ($Codex) {
    Write-Step "Checking for Codex CLI..."
    $codexCmd = Get-Command "codex" -ErrorAction SilentlyContinue
    if (-not $codexCmd) {
        $codexBin = Join-Path $env:LOCALAPPDATA "OpenAI\Codex\bin"
        $codexPath = Get-ChildItem $codexBin -Filter "codex.exe" -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
        if (-not $codexPath) {
            Write-Err "Codex CLI was not found on PATH or under $codexBin."
            Write-Host "Please install Codex before running this installer."
            exit 1
        }
    } else {
        $codexPath = $codexCmd.Source
    }
    Write-Success "Found Codex CLI: $codexPath"

    Write-Step "Updating the rkr-claude-plugins marketplace in Codex..."
    & $codexPath plugin marketplace upgrade "rkr-claude-plugins"
    if ($LASTEXITCODE -ne 0) {
        & $codexPath plugin marketplace add "rahul-k-r/rkr-claude-plugins" --ref main
        if ($LASTEXITCODE -ne 0) {
            Write-Err "Could not add the rkr-claude-plugins marketplace."
            exit $LASTEXITCODE
        }
    }

    Write-Step "Installing sdlc@rkr-claude-plugins into Codex..."
    & $codexPath plugin add "sdlc@rkr-claude-plugins"
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Codex plugin installation failed."
        exit $LASTEXITCODE
    }
    Write-Success "Codex sdlc plugin installed. Start a new Codex task before testing /sdlc:story-run."
    exit 0
}

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
        $sdlcSource = Join-Path $tempDir "clone\sdlc"
        try {
            git clone --depth 1 "https://github.com/rahul-k-r/rkr-claude-plugins.git" (Join-Path $tempDir "clone") 2>$null
        } catch {
            # git missing or clone failed — fall through to the shared error path below
        }
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

    $installedPluginDir = (Join-Path $configDir "plugins\sdlc").Replace('\', '/')
    $sourceHooksPath = Join-Path $configDir "plugins\sdlc\hooks.json"

    if (Test-Path $sourceHooksPath) {
        $sourceJson = Get-Content $sourceHooksPath -Raw -Encoding UTF8 | ConvertFrom-Json -AsHashtable
        $sdlcBlock = if ($sourceJson.ContainsKey("sdlc")) { $sourceJson["sdlc"] } else { $sourceJson }

        function Resolve-HookCommands ($item, $pluginDir) {
            if ($item -is [System.Collections.IDictionary]) {
                $copy = @{}
                foreach ($key in $item.Keys) {
                    if ($key -eq "command" -and $item[$key] -is [string]) {
                        $cmd = $item[$key]
                        if ($cmd -match '^node\s+(.+)$') {
                            $scriptRel = $matches[1].Trim('"')
                            $copy[$key] = "node `"$pluginDir/$scriptRel`""
                        } else {
                            $copy[$key] = $cmd
                        }
                    } else {
                        $copy[$key] = Resolve-HookCommands $item[$key] $pluginDir
                    }
                }
                return $copy
            } elseif ($item -is [System.Collections.IList]) {
                $list = @()
                foreach ($elem in $item) {
                    $list += ,(Resolve-HookCommands $elem $pluginDir)
                }
                return $list
            } else {
                return $item
            }
        }

        $hooksObj["sdlc"] = Resolve-HookCommands $sdlcBlock $installedPluginDir
        $jsonOut = $hooksObj | ConvertTo-Json -Depth 10
        Set-Content -Path $hooksFile -Value $jsonOut -Encoding UTF8
        Write-Success "Hooks active: Git branch protection and tool guardrails configured."
    } else {
        Write-Err "Could not find $sourceHooksPath to configure hooks."
    }
}

Write-Host "`nInstallation finished successfully!" -ForegroundColor Green
Write-Host "In any Antigravity chat, type /sdlc:help to view available commands.`n" -ForegroundColor Cyan
