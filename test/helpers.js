const { spawnSync, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const HOOK = (name) => path.join(ROOT, 'sdlc', 'hooks', `${name}.js`);
const HOOK_AG = (name) => path.join(ROOT, 'sdlc', 'hooks-antigravity', `${name}.js`);

// Hooks read a JSON payload on stdin. Claude Code hooks signal via exit code
// (0 = allow, 2 = deny, stderr = feedback); Antigravity hooks always exit 0 and
// signal via a JSON decision on stdout.
function runHook(hookPath, payload, opts = {}) {
  const r = spawnSync(process.execPath, [hookPath], {
    input: typeof payload === 'string' ? payload : JSON.stringify(payload),
    encoding: 'utf8',
    ...opts,
  });
  if (r.error) throw r.error;
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

function decisionOf(result) {
  try {
    return JSON.parse(result.stdout).decision;
  } catch {
    return null;
  }
}

// Ignore the contributor's global/system git config — commit.gpgsign, core.hooksPath
// or init.templateDir set there would otherwise break the fixture commits below.
// An empty real file, not os.devNull: git rejects `\\.\nul` as a config path on Windows.
const GITCFG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-gitcfg-'));
const EMPTY_GITCONFIG = path.join(GITCFG_DIR, 'gitconfig');
fs.writeFileSync(EMPTY_GITCONFIG, '');
process.on('exit', () => fs.rmSync(GITCFG_DIR, { recursive: true, force: true }));
const GIT_ENV = { ...process.env, GIT_CONFIG_GLOBAL: EMPTY_GITCONFIG, GIT_CONFIG_NOSYSTEM: '1' };

const git = (cwd, ...args) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', env: GIT_ENV, stdio: ['ignore', 'pipe', 'pipe'] });

// A throwaway git repo. `workflow: true` adds docs/stories, which is how
// gate-git.js decides a repo is an sdlc workflow repo at all.
function makeRepo({ workflow = true, branch = 'main', config = null } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-hook-test-'));
  git(dir, 'init', '-q', '-b', branch);
  git(dir, 'config', 'user.email', 'test@example.com');
  git(dir, 'config', 'user.name', 'Test');
  git(dir, 'commit', '-q', '--allow-empty', '-m', 'init');
  if (workflow) fs.mkdirSync(path.join(dir, 'docs', 'stories'), { recursive: true });
  if (config) {
    fs.mkdirSync(path.join(dir, '.sdlc'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.sdlc', 'config.json'), JSON.stringify(config));
  }
  return dir;
}

function writeStoryState(repo, key, state) {
  const dir = path.join(repo, 'docs', 'stories', key);
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, 'story-state.json');
  fs.writeFileSync(p, typeof state === 'string' ? state : JSON.stringify(state, null, 2));
  return p;
}

const cleanup = (dir) => fs.rmSync(dir, { recursive: true, force: true });

module.exports = { ROOT, HOOK, HOOK_AG, runHook, decisionOf, git, makeRepo, writeStoryState, cleanup };
