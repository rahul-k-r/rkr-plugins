#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawnSync } = require('child_process');

function findAgy() {
  const isWindows = process.platform === 'win32';
  try {
    const cmd = isWindows ? 'where agy' : 'which agy';
    const output = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (output) {
      return output.split(/\r?\n/)[0].trim();
    }
  } catch {}

  if (isWindows) {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    const fallback = path.join(localAppData, 'agy', 'bin', 'agy.exe');
    if (fs.existsSync(fallback)) return fallback;
  } else {
    const homeFallbacks = [
      path.join(os.homedir(), '.local', 'bin', 'agy'),
      '/usr/local/bin/agy'
    ];
    for (const f of homeFallbacks) {
      if (fs.existsSync(f)) return f;
    }
  }

  return null;
}

function getSdlcSource() {
  const localSdlc = path.resolve(__dirname, '..', 'sdlc');
  if (fs.existsSync(path.join(localSdlc, 'plugin.json'))) {
    return localSdlc;
  }
  return null;
}

function getGeminiConfigDir() {
  return path.join(os.homedir(), '.gemini', 'config');
}

function getHooksFile() {
  return path.join(getGeminiConfigDir(), 'hooks.json');
}

function configureHooks() {
  const configDir = getGeminiConfigDir();
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const hooksFile = getHooksFile();
  let hooksConfig = {};

  if (fs.existsSync(hooksFile)) {
    try {
      const raw = fs.readFileSync(hooksFile, 'utf8').trim();
      if (raw) hooksConfig = JSON.parse(raw);
    } catch {
      try {
        fs.copyFileSync(hooksFile, `${hooksFile}.bak`);
      } catch {}
      hooksConfig = {};
    }
  }

  const gateGit = path.join(configDir, 'plugins', 'sdlc', 'hooks-antigravity', 'gate-git.js').replace(/\\/g, '/');
  const guardTools = path.join(configDir, 'plugins', 'sdlc', 'hooks-antigravity', 'guard-agent-tools.js').replace(/\\/g, '/');

  hooksConfig['sdlc'] = {
    enabled: true,
    PreToolUse: [
      {
        matcher: 'run_command',
        hooks: [
          {
            type: 'command',
            command: `node "${gateGit}"`,
            timeout: 15
          }
        ]
      },
      {
        matcher: '.*',
        hooks: [
          {
            type: 'command',
            command: `node "${guardTools}"`,
            timeout: 15
          }
        ]
      }
    ]
  };

  fs.writeFileSync(hooksFile, JSON.stringify(hooksConfig, null, 2), 'utf8');
  console.log(' [OK] Safety hooks configured in ~/.gemini/config/hooks.json');
}

function removeHooks() {
  const hooksFile = getHooksFile();
  if (!fs.existsSync(hooksFile)) return;

  try {
    const raw = fs.readFileSync(hooksFile, 'utf8').trim();
    if (!raw) return;
    const hooksConfig = JSON.parse(raw);
    if (hooksConfig['sdlc']) {
      delete hooksConfig['sdlc'];
      fs.writeFileSync(hooksFile, JSON.stringify(hooksConfig, null, 2), 'utf8');
      console.log(' [OK] Removed sdlc hooks from ~/.gemini/config/hooks.json');
    }
  } catch (err) {
    console.error(' [WARN] Failed to update hooks.json:', err.message);
  }
}

function install(agyPath) {
  const sdlcDir = getSdlcSource();
  if (!sdlcDir) {
    console.error(' [ERROR] Could not find sdlc/plugin.json in the package.');
    process.exit(1);
  }

  console.log('\n==> Installing sdlc plugin into Antigravity...');
  const res = spawnSync(agyPath, ['plugin', 'install', sdlcDir], { stdio: 'inherit' });
  if (res.error) {
    console.error(` [ERROR] Failed to launch '${agyPath}': ${res.error.message}`);
    process.exit(1);
  }
  if (res.status !== 0) {
    console.error(` [ERROR] 'agy plugin install' exited with code ${res.status}`);
    process.exit(res.status || 1);
  }
  console.log(' [OK] Plugin installed successfully.');

  console.log('\n==> Configuring safety hooks...');
  configureHooks();

  console.log('\nInstallation complete! All /sdlc:* skills are ready to use in Antigravity.');
  console.log('Try typing /sdlc:help in any Antigravity chat session.\n');
}

function update(agyPath) {
  console.log('\n==> Updating sdlc plugin in Antigravity...');
  install(agyPath);
}

function uninstall(agyPath) {
  console.log('\n==> Uninstalling sdlc plugin from Antigravity...');
  const res = spawnSync(agyPath, ['plugin', 'uninstall', 'sdlc'], { stdio: 'inherit' });
  if (res.error) {
    console.warn(` [WARN] Failed to launch '${agyPath}': ${res.error.message}`);
  } else if (res.status !== 0) {
    console.warn(` [WARN] 'agy plugin uninstall sdlc' exited with code ${res.status} (plugin may not have been registered).`);
  } else {
    console.log(' [OK] sdlc plugin uninstalled.');
  }

  console.log('\n==> Removing safety hooks...');
  removeHooks();

  console.log('\nUninstallation complete. sdlc has been cleanly removed.\n');
}

function showHelp() {
  console.log(`
SDLC Plugin Manager for Antigravity

Usage:
  npx github:rahul-k-r/rkr-claude-plugins <command>

Commands:
  install     Install the sdlc plugin and configure safety hooks (default)
  update      Update the sdlc plugin to latest and refresh hooks
  uninstall   Remove the sdlc plugin and clean up safety hooks
  help        Show this help message
`);
}

function main() {
  const args = process.argv.slice(2);
  const command = (args[0] || 'install').toLowerCase();

  if (command === 'help' || command === '--help' || command === '-h') {
    showHelp();
    return;
  }

  const agyPath = findAgy();
  if (!agyPath) {
    console.error('\n [ERROR] Antigravity CLI (\'agy\') was not found on PATH or in standard install locations.');
    console.error('Please install Google Antigravity before managing this plugin.\n');
    process.exit(1);
  }

  switch (command) {
    case 'install':
      install(agyPath);
      break;
    case 'update':
      update(agyPath);
      break;
    case 'uninstall':
      uninstall(agyPath);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}

main();
