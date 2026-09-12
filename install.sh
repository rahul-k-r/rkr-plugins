#!/usr/bin/env bash
set -e

# Installer for sdlc Antigravity Plugin and safety hooks

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
    TAR_URL="https://github.com/rahul-k-r/rkr-claude-plugins/archive/refs/heads/main.tar.gz"

    if curl -fsSL "$TAR_URL" | tar -xz -C "$TEMP_DIR" 2>/dev/null; then
        SDLC_SOURCE="$TEMP_DIR/rkr-claude-plugins-main/sdlc"
    else
        echo "Tarball download failed, falling back to git clone..."
        git clone --depth 1 "https://github.com/rahul-k-r/rkr-claude-plugins.git" "$TEMP_DIR/clone" || true
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
echo -e "\n==> Configuring safety hooks in ~/.gemini/config/hooks.json..."
GEMINI_CONFIG_DIR="$HOME/.gemini/config"
mkdir -p "$GEMINI_CONFIG_DIR"

HOOKS_FILE="$GEMINI_CONFIG_DIR/hooks.json"
GATE_GIT="$GEMINI_CONFIG_DIR/plugins/sdlc/hooks-antigravity/gate-git.js"
GUARD_TOOLS="$GEMINI_CONFIG_DIR/plugins/sdlc/hooks-antigravity/guard-agent-tools.js"

# Use python or node to merge hooks.json cleanly
node - <<EOF
const fs = require('fs');
const path = require('path');

const hooksFile = '$HOOKS_FILE';
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

config['sdlc'] = {
  enabled: true,
  PreToolUse: [
    {
      matcher: 'run_command',
      hooks: [
        {
          type: 'command',
          command: 'node "$GATE_GIT"',
          timeout: 15
        }
      ]
    },
    {
      matcher: '.*',
      hooks: [
        {
          type: 'command',
          command: 'node "$GUARD_TOOLS"',
          timeout: 15
        }
      ]
    }
  ]
};

fs.writeFileSync(hooksFile, JSON.stringify(config, null, 2), 'utf8');
EOF

echo " [OK] Hooks configured: branch protection and agent tool scoping are active."
echo -e "\nInstallation complete! All /sdlc:* skills are ready to use in Antigravity."
echo "Try starting a session and typing: /sdlc:help"
