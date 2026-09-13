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

function findCodex() {
  const isWindows = process.platform === 'win32';
  try {
    const cmd = isWindows ? 'where codex' : 'which codex';
    const output = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (output) return output.split(/\r?\n/)[0].trim();
  } catch {}

  if (isWindows) {
    const binDir = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'OpenAI', 'Codex', 'bin');
    if (fs.existsSync(binDir)) {
      for (const entry of fs.readdirSync(binDir)) {
        const fallback = path.join(binDir, entry, 'codex.exe');
        if (fs.existsSync(fallback)) return fallback;
      }
      const fallback = path.join(binDir, 'codex.exe');
      if (fs.existsSync(fallback)) return fallback;
    }
  } else {
    const homeFallbacks = [
      path.join(os.homedir(), '.local', 'bin', 'codex'),
      '/usr/local/bin/codex'
    ];
    for (const f of homeFallbacks) {
      if (fs.existsSync(f)) return f;
    }
  }

  return null;
}

function quoteWindowsCommandArg(value) {
  const text = String(value);
  if (text && !/[\s"&^|<>]/.test(text)) return text;
  return `"${text.replace(/"/g, '\\"')}"`;
}

function spawnCli(executable, args, options = {}) {
  const windowsShim = process.platform === 'win32' && /\.(cmd|bat)$/i.test(executable);
  if (!windowsShim) return spawnSync(executable, args, options);

  // Invoke the Windows shell explicitly. Verbatim arguments preserve the nested
  // quotes around a shim path or argument containing spaces.
  const command = [executable, ...args].map(quoteWindowsCommandArg).join(' ');
  return spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', command], {
    ...options,
    windowsVerbatimArguments: true
  });
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

function configureHooks(sdlcDir) {
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

  const sourceHooksFile = path.join(sdlcDir, 'hooks.json');
  if (!fs.existsSync(sourceHooksFile)) {
    console.warn(' [WARN] hooks.json not found in plugin directory; skipping hook registration.');
    return;
  }

  const pluginInstalledDir = path.join(configDir, 'plugins', 'sdlc');
  const sourceRaw = fs.readFileSync(sourceHooksFile, 'utf8');
  const sourceConfig = JSON.parse(sourceRaw);
  const sdlcHookDef = sourceConfig.sdlc || sourceConfig;

  function resolveCommands(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(resolveCommands);
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'command' && typeof value === 'string') {
        result[key] = value.replace(/node\s+([^\s"]+)/, (match, scriptPath) => {
          const absoluteScript = path.join(pluginInstalledDir, ...scriptPath.split(/[\\/]/));
          return `node ${absoluteScript}`;
        });
      } else {
        result[key] = resolveCommands(value);
      }
    }
    return result;
  }

  hooksConfig['sdlc'] = resolveCommands(sdlcHookDef);

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
  const res = spawnCli(agyPath, ['plugin', 'install', sdlcDir], { stdio: 'inherit' });
  if (res.status !== 0) {
    console.error(` [ERROR] 'agy plugin install' exited with code ${res.status}`);
    process.exit(res.status || 1);
  }
  console.log(' [OK] Plugin installed successfully.');

  console.log('\n==> Configuring safety hooks from plugin manifest...');
  configureHooks(sdlcDir);

  console.log('\nInstallation complete! All /sdlc:* skills are ready to use in Antigravity.');
  console.log('Try typing /sdlc:help in any Antigravity chat session.\n');
}

function update(agyPath) {
  console.log('\n==> Updating sdlc plugin in Antigravity...');
  install(agyPath);
}

function uninstall(agyPath) {
  console.log('\n==> Uninstalling sdlc plugin from Antigravity...');
  const res = spawnCli(agyPath, ['plugin', 'uninstall', 'sdlc'], { stdio: 'inherit' });
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

const CODEX_MARKETPLACE = 'rkr-plugins';
const CODEX_PLUGIN = `sdlc@${CODEX_MARKETPLACE}`;
const CODEX_REPOSITORY = 'rahul-k-r/rkr-plugins';

function ensureCodexMarketplace(codexPath) {
  const upgrade = spawnCli(codexPath, ['plugin', 'marketplace', 'upgrade', CODEX_MARKETPLACE], { stdio: 'inherit' });
  if (upgrade.status === 0) return;

  console.log('\n==> Adding the rkr-plugins marketplace to Codex...');
  const add = spawnCli(codexPath, ['plugin', 'marketplace', 'add', CODEX_REPOSITORY, '--ref', 'main'], { stdio: 'inherit' });
  if (add.status !== 0) {
    console.error(` [ERROR] Could not add marketplace '${CODEX_MARKETPLACE}'.`);
    process.exit(add.status || 1);
  }
}

function installCodex(codexPath) {
  console.log('\n==> Updating the rkr-plugins marketplace in Codex...');
  ensureCodexMarketplace(codexPath);

  console.log(`\n==> Installing ${CODEX_PLUGIN} into Codex...`);
  const res = spawnCli(codexPath, ['plugin', 'add', CODEX_PLUGIN], { stdio: 'inherit' });
  if (res.status !== 0) {
    console.error(` [ERROR] 'codex plugin add' exited with code ${res.status}`);
    process.exit(res.status || 1);
  }
  console.log(' [OK] Codex plugin installed successfully.');
  console.log('\nStart a new Codex task, then type /sdlc:help or /sdlc:story-run.\n');
}

function uninstallCodex(codexPath) {
  console.log(`\n==> Uninstalling ${CODEX_PLUGIN} from Codex...`);
  const res = spawnCli(codexPath, ['plugin', 'remove', CODEX_PLUGIN], { stdio: 'inherit' });
  if (res.error) {
    console.error(` [ERROR] Failed to launch '${codexPath}': ${res.error.message}`);
    process.exit(1);
  }
  if (res.status !== 0) {
    console.warn(` [WARN] 'codex plugin remove' exited with code ${res.status}.`);
    process.exit(res.status || 1);
  } else {
    console.log(' [OK] Codex sdlc plugin uninstalled.');
  }
}

function showHelp() {
  console.log(`
SDLC Plugin Manager for Codex and Antigravity

Usage:
  npx github:rahul-k-r/rkr-plugins <command>

Commands:
  install     Install the sdlc plugin and configure safety hooks (default)
  update      Update the sdlc plugin to latest and refresh hooks
  uninstall   Remove the sdlc plugin and clean up safety hooks
  codex-install   Install sdlc@rkr-plugins into Codex
  codex-update    Refresh the marketplace and reinstall sdlc in Codex
  codex-uninstall Remove sdlc@rkr-plugins from Codex
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

  switch (command) {
    case 'install':
    case 'update':
    case 'uninstall': {
      const agyPath = findAgy();
      if (!agyPath) {
        console.error('\n [ERROR] Antigravity CLI (\'agy\') was not found on PATH or in standard install locations.');
        console.error('Please install Google Antigravity before managing this plugin.\n');
        process.exit(1);
      }
      if (command === 'install') install(agyPath);
      else if (command === 'update') update(agyPath);
      else uninstall(agyPath);
      break;
    }
    case 'codex-install':
    case 'codex-update': {
      const codexPath = findCodex();
      if (!codexPath) {
        console.error('\n [ERROR] Codex CLI was not found on PATH or in standard install locations.');
        console.error('Please install Codex before managing this plugin.\n');
        process.exit(1);
      }
      installCodex(codexPath);
      break;
    }
    case 'codex-uninstall': {
      const codexPath = findCodex();
      if (!codexPath) {
        console.error('\n [ERROR] Codex CLI was not found on PATH or in standard install locations.');
        console.error('Please install Codex before managing this plugin.\n');
        process.exit(1);
      }
      uninstallCodex(codexPath);
      break;
    }
    default:
      console.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}

main();
