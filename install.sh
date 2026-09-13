#!/usr/bin/env bash
set -e

# Installer for sdlc Antigravity Plugin and safety hooks

if [ "${1:-}" = "--codex" ]; then
    echo -e "\n==> Checking for Codex CLI..."
    if ! command -v codex &> /dev/null; then
        echo " [ERROR] Codex CLI was not found on your PATH."
        echo "Please install Codex first before installing this plugin."
        exit 1
    fi
    CODEX_PATH=$(command -v codex)
    echo " [OK] Found Codex CLI at: $CODEX_PATH"

    echo -e "\n==> Updating the rkr-plugins marketplace in Codex..."
    if ! "$CODEX_PATH" plugin marketplace upgrade "rkr-plugins"; then
        "$CODEX_PATH" plugin marketplace add "rahul-k-r/rkr-plugins" --ref main
    fi

    echo -e "\n==> Installing sdlc@rkr-plugins into Codex..."
    "$CODEX_PATH" plugin add "sdlc@rkr-plugins"
    echo " [OK] Codex sdlc plugin installed. Start a new Codex task before testing /sdlc:story-run."
    exit 0
fi

echo -e "\n==> Checking for Antigravity (agy) CLI..."

if ! command -v agy &> /dev/null; then
    echo " [ERROR] Antigravity CLI ('agy') was not found on your PATH."
    echo "Please install Antigravity first before installing this plugin."
    exit 1
fi

AGY_PATH=$(command -v agy)
echo " [OK] Found Antigravity CLI at: $AGY_PATH"

# Determine plugin directory (local repo or download from GitHub)
TEMP_DIR=""
cleanup() {
    if [ -n "$TEMP_DIR" ] && [ -d "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR"
    fi
}
trap cleanup EXIT

SCRIPT_DIR=""
if [ -n "${BASH_SOURCE[0]}" ] && [ "${BASH_SOURCE[0]}" != "bash" ] && [ -f "${BASH_SOURCE[0]}" ]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

if [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/sdlc/plugin.json" ]; then
    SDLC_SOURCE="$SCRIPT_DIR/sdlc"
    echo -e "\n==> Using local source: $SDLC_SOURCE"
else
    echo -e "\n==> Downloading plugin from GitHub..."
    TEMP_DIR=$(mktemp -d 2>/dev/null || mktemp -d -t 'sdlc-pkg')
    TAR_URL="https://github.com/rahul-k-r/rkr-plugins/archive/refs/heads/main.tar.gz"

    if curl -fsSL "$TAR_URL" | tar -xz -C "$TEMP_DIR" 2>/dev/null; then
        SDLC_SOURCE="$TEMP_DIR/rkr-plugins-main/sdlc"
    else
        echo "Tarball download failed, falling back to git clone..."
        git clone --depth 1 "https://github.com/rahul-k-r/rkr-plugins.git" "$TEMP_DIR/clone" || true
        SDLC_SOURCE="$TEMP_DIR/clone/sdlc"
    fi

    if [ ! -f "$SDLC_SOURCE/plugin.json" ]; then
        echo " [ERROR] Failed to obtain valid sdlc plugin files."
        exit 1
    fi
    echo " [OK] Downloaded and extracted plugin files."
fi

echo -e "\n==> Installing sdlc plugin into Antigravity..."
"$AGY_PATH" plugin install "$SDLC_SOURCE"
echo " [OK] sdlc plugin installed successfully."

# Configure safety hooks
echo -e "\n==> Configuring safety hooks from plugin manifest..."
GEMINI_CONFIG_DIR="$HOME/.gemini/config"
mkdir -p "$GEMINI_CONFIG_DIR"

HOOKS_FILE="$GEMINI_CONFIG_DIR/hooks.json"
INSTALLED_PLUGIN_DIR="$GEMINI_CONFIG_DIR/plugins/sdlc"
SOURCE_HOOKS_FILE="$INSTALLED_PLUGIN_DIR/hooks.json"

node - <<EOF
const fs = require('fs');
const path = require('path');

const hooksFile = '$HOOKS_FILE';
const sourceHooksFile = '$SOURCE_HOOKS_FILE';
const pluginDir = '$INSTALLED_PLUGIN_DIR';

if (!fs.existsSync(sourceHooksFile)) {
  console.warn(' [WARN] hooks.json not found in plugin directory; skipping hook registration.');
  process.exit(0);
}

let config = {};
if (fs.existsSync(hooksFile)) {
  try {
    const raw = fs.readFileSync(hooksFile, 'utf8').trim();
    if (raw) config = JSON.parse(raw);
  } catch (e) {
    fs.copyFileSync(hooksFile, hooksFile + '.bak');
    config = {};
  }
}

const sourceRaw = fs.readFileSync(sourceHooksFile, 'utf8');
const sourceConfig = JSON.parse(sourceRaw);
const sdlcDef = sourceConfig.sdlc || sourceConfig;

function resolveCommands(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(resolveCommands);
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'command' && typeof value === 'string') {
      result[key] = value.replace(/node\s+([^\s"]+)/, (match, scriptPath) => {
        return \`node \${path.posix.join(pluginDir, scriptPath)}\`;
      });
    } else {
      result[key] = resolveCommands(value);
    }
  }
  return result;
}

config['sdlc'] = resolveCommands(sdlcDef);
fs.writeFileSync(hooksFile, JSON.stringify(config, null, 2), 'utf8');
EOF

echo " [OK] Hooks configured: branch protection and agent tool scoping are active."
echo -e "\nInstallation complete! All /sdlc:* skills are ready to use in Antigravity."
echo "Try starting a session and typing: /sdlc:help"
