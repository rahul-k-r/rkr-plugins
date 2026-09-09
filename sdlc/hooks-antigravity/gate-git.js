#!/usr/bin/env node
// Antigravity port of hooks/gate-git.js — SAME policy, DIFFERENT I/O contract and a real,
// disclosed reliability gap. See ../docs/antigravity-port-notes.md before relying on this in a
// real repo: Antigravity does not auto-wire a plugin's own hooks.json (confirmed empirically,
// both IDE and CLI) — this file only does anything once manually installed into the user's
// global ~/.gemini/config/hooks.json (see skills/agy-install-hooks/SKILL.md). It cannot
// guarantee the same safety Claude Code gets automatically — that's the whole reason the
// install skill prints a loud warning instead of silently claiming parity.
//
// Policy (identical to hooks/gate-git.js — keep both in sync manually; not yet factored into a
// shared module, see that file's own header for why):
//   1. Deny `git commit` directly on main/master, or a sprint/* branch under branchModel:
//      sprint — except mid-merge (MERGE_HEAD present) or a release commit whose staged files
//      are all covered by .sdlc/config.json's releaseCommitPaths.
//   2. Deny force-pushes targeting a protected branch (same set as #1).
//   3. On a branch managed by a story-run story-state.json, deny push/PR-open before phase
//      READY_FOR_PR / PR_OPENED (or AUTO_FIX, the --bypass fix loop).
//
// I/O contract (confirmed against the real Antigravity hooks system, 2026-09-08): stdin JSON
// in, stdout JSON out — no exit-code signaling. A PreToolUse hook's decision is entirely the
// `decision` field of the JSON object printed to stdout; process.exit code is not part of the
// contract the way Claude Code's is.
//
// UNCONFIRMED, best-effort: the exact field names carrying the shell command string and the
// working directory inside a `run_command` PreToolUse payload were never directly observed —
// only that the tool is named `run_command` and matched via hooks.json's `matcher`. This file
// therefore checks several plausible field paths defensively rather than assuming one. If you
// run this for real and it doesn't fire when it should (or fires on the wrong data), the first
// thing to check is which of these guesses was wrong — log the raw payload once and narrow this
// down to the real field names, then delete the rest of the guesses.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function extractCommand(payload) {
  return (
    payload.tool_input?.command ||
    payload.args?.command ||
    payload.args?.Command ||
    payload.args?.cmd ||
    payload.command ||
    ''
  );
}

function extractCwd(payload, fallback) {
  return (
    payload.cwd ||
    payload.args?.cwd ||
    payload.args?.Cwd ||
    payload.workspace ||
    fallback
  );
}

function branchModel(root) {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(root, '.sdlc', 'config.json'), 'utf8'));
    return cfg.branchModel === 'direct' ? 'direct' : 'sprint';
  } catch {
    return 'sprint';
  }
}

const protectedBranch = (b, model) =>
  b === 'main' || b === 'master' || (model === 'sprint' && /^sprint\//.test(b));

function isReleaseCommit(root, cwd) {
  let allow;
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(root, '.sdlc', 'config.json'), 'utf8'));
    allow = Array.isArray(cfg.releaseCommitPaths) ? cfg.releaseCommitPaths : null;
  } catch {
    return false;
  }
  if (!allow || allow.length === 0) return false;

  let staged;
  try {
    staged = execFileSync('git', ['diff', '--cached', '--name-only'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .trim()
      .split('\n')
      .filter(Boolean);
  } catch {
    return false;
  }
  return staged.length > 0 && staged.every((f) => allow.includes(f));
}

const allow = () => {
  process.stdout.write(JSON.stringify({ decision: 'allow' }));
  process.exit(0);
};
const deny = (reason) => {
  process.stdout.write(JSON.stringify({ decision: 'deny', reason: `sdlc gate: ${reason}` }));
  process.exit(0);
};

let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => {
  let cmd = '';
  let cwd = process.cwd();
  try {
    const payload = JSON.parse(input);
    cmd = extractCommand(payload);
    cwd = extractCwd(payload, cwd);
  } catch {
    return allow(); // unparseable payload — don't block unrelated work
  }

  const isCommit = /\bgit\s+(?:[\w-]+\s+)*commit\b/.test(cmd);
  const isPush = /\bgit\s+(?:[\w-]+\s+)*push\b/.test(cmd);
  const isPrCreate = /\bgh\s+pr\s+create\b/.test(cmd);
  if (!isCommit && !isPush && !isPrCreate) return allow();

  const cdPrefix = cmd.match(/^\s*cd\s+(?:"([^"]+)"|'([^']+)'|(\S+))\s*&&/);
  const dashC = cmd.match(/\bgit\s+-C\s+(?:"([^"]+)"|'([^']+)'|(\S+))/);
  const target = cdPrefix
    ? cdPrefix[1] || cdPrefix[2] || cdPrefix[3]
    : dashC
      ? dashC[1] || dashC[2] || dashC[3]
      : null;
  if (target && !/[$`]/.test(target)) cwd = path.resolve(cwd, target);

  let root, branch, gitDir;
  try {
    const opts = { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };
    root = execFileSync('git', ['rev-parse', '--show-toplevel'], opts).trim();
    branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], opts).trim();
    gitDir = execFileSync('git', ['rev-parse', '--absolute-git-dir'], opts).trim();
  } catch {
    return allow(); // not a git repo — not ours to gate
  }

  const workflowRepo =
    fs.existsSync(path.join(root, 'docs', 'stories')) ||
    fs.existsSync(path.join(root, 'docs', 'design-notes'));
  if (!workflowRepo) return allow();

  const model = branchModel(root);

  if (
    isCommit &&
    protectedBranch(branch, model) &&
    !fs.existsSync(path.join(gitDir, 'MERGE_HEAD')) &&
    !isReleaseCommit(root, cwd)
  ) {
    return deny(
      `refusing to commit directly on "${branch}". Cut a story branch first ` +
        `(feat|fix|chore/<key-lower>-slug) — see /agy-story-start or /agy-commit. ` +
        `(Merge-resolution commits during an in-progress merge are allowed, and so is a release ` +
        `commit whose staged files are all covered by .sdlc/config.json's "releaseCommitPaths".)`
    );
  }

  if (isPush && /(?:^|\s)(?:--force(?:-with-lease)?(?:=\S+)?|-f)(?:\s|$)/.test(cmd)) {
    const targetsProtected =
      /\b(?:main|master)\b/.test(cmd) ||
      (model === 'sprint' && /\bsprint\//.test(cmd)) ||
      protectedBranch(branch, model);
    if (targetsProtected) {
      return deny(
        `refusing to force-push to a protected branch. ` +
          `Force-pushing shared history can destroy work; reconcile with a merge instead.`
      );
    }
  }

  if (isPush || isPrCreate) {
    const storiesDir = path.join(root, 'docs', 'stories');
    let state = null;
    try {
      for (const key of fs.readdirSync(storiesDir)) {
        const p = path.join(storiesDir, key, 'story-state.json');
        if (!fs.existsSync(p)) continue;
        const s = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (s && s.branch === branch) {
          state = s;
          break;
        }
      }
    } catch {
      return allow(); // no docs/stories — nothing story-run manages here
    }

    const PUSH_OK = new Set(['READY_FOR_PR', 'PR_OPENED', 'AUTO_FIX']);
    if (state && !PUSH_OK.has(state.phase)) {
      return deny(
        `branch "${branch}" is managed by story ${state.story_key} (phase: ${state.phase}). ` +
          `git push / gh pr create are allowed only at phase READY_FOR_PR or later (or AUTO_FIX, ` +
          `the --bypass fix loop) — every batch and the final review must pass first. Finish the ` +
          `run, or resolve its escalation with --resume.`
      );
    }
  }

  return allow();
});
