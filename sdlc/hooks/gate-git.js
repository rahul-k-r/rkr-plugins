#!/usr/bin/env node
// PreToolUse gate for sdlc workflow repos (detected by docs/stories/
// or docs/design-notes/ at the repo root; other repos are never affected):
//   1. Deny `git commit` directly on main/master, or a sprint/* branch when
//      this repo's branch model is `sprint` — except merge-resolution
//      commits while a merge is in progress (MERGE_HEAD present), e.g.
//      reconciling main into the sprint branch; and except a RELEASE commit
//      (see below).
//   2. Deny force-pushes targeting a protected branch (same set as #1).
//   3. On a branch managed by a story-run story-state.json, deny
//      `git push` / `gh pr create` before phase READY_FOR_PR / PR_OPENED.
//      AUTO_FIX (the --bypass tail's review-fix loop) also pushes legally —
//      it appends reviewed fix commits to an already-open PR.
//
// Release-commit exception: some repos document a standing convention that
// the release commit (a changelog-heading rename plus a version bump, e.g.)
// lands directly on main — no branch, no PR, by design (a PR for a two-file
// version bump is pointless ceremony, and blocking it silently pushes an
// agent toward opening one anyway, which is worse). Since the files that
// make up "a release commit" are different in every repo (CHANGELOG.md +
// a .csproj here, package.json elsewhere...), this isn't something the
// plugin can know — it's opt-in via `.sdlc/config.json`'s
// `releaseCommitPaths` (an array of repo-relative paths). When set, a
// direct commit on a protected branch is allowed if every staged file is
// in that list. Unset (the default) — no exception, unchanged behavior.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// `sprint` repos protect main/master AND sprint/* (the two-tier model);
// `direct` (solo) repos have no sprint branches at all, so only main/master
// is protected. Missing/unreadable config (e.g. init hasn't run yet) is
// treated as `sprint` — the stricter default, never the more permissive one.
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

// True only when `releaseCommitPaths` is configured AND every file staged for
// this commit is in that list. Fails closed (false) on any missing config,
// unreadable git state, or empty staging area — never widens the gate by
// accident.
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

let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => {
  let cmd = '';
  let cwd = process.cwd();
  try {
    const payload = JSON.parse(input);
    cmd = (payload.tool_input && payload.tool_input.command) || '';
    cwd = payload.cwd || cwd;
  } catch {
    process.exit(0); // unparseable payload — don't block unrelated work
  }

  const isCommit = /\bgit\s+(?:[\w-]+\s+)*commit\b/.test(cmd);
  const isPush = /\bgit\s+(?:[\w-]+\s+)*push\b/.test(cmd);
  const isPrCreate = /\bgh\s+pr\s+create\b/.test(cmd);
  if (!isCommit && !isPush && !isPrCreate) process.exit(0);

  // Resolve the repo the command actually TARGETS, not just the session's cwd:
  // the harness parks the shell in the project repo, so a command operating on
  // another repo (leading `cd <path> &&`, or `git -C <path>`) would otherwise be
  // gated against the wrong repo's story state. Honor those two explicit forms.
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
    process.exit(0); // not a git repo — not ours to gate
  }

  const workflowRepo =
    fs.existsSync(path.join(root, 'docs', 'stories')) ||
    fs.existsSync(path.join(root, 'docs', 'design-notes'));
  if (!workflowRepo) process.exit(0);

  const model = branchModel(root);

  const deny = (msg) => {
    console.error(`sdlc gate: ${msg}`);
    process.exit(2);
  };

  if (
    isCommit &&
    protectedBranch(branch, model) &&
    !fs.existsSync(path.join(gitDir, 'MERGE_HEAD')) &&
    !isReleaseCommit(root, cwd)
  ) {
    deny(
      `refusing to commit directly on "${branch}". Cut a story branch first ` +
        `(feat|fix|chore/<key-lower>-slug) — see /sdlc:story-start or /sdlc:commit. ` +
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
      deny(
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
      process.exit(0); // no docs/stories — nothing story-run manages here
    }

    const PUSH_OK = new Set(['READY_FOR_PR', 'PR_OPENED', 'AUTO_FIX']);
    if (state && !PUSH_OK.has(state.phase)) {
      deny(
        `branch "${branch}" is managed by story ${state.story_key} (phase: ${state.phase}). ` +
          `git push / gh pr create are allowed only at phase READY_FOR_PR or later (or AUTO_FIX, ` +
          `the --bypass fix loop) — every batch and the final review must pass first. Finish the ` +
          `run, or resolve its escalation with --resume.`
      );
    }
  }

  process.exit(0);
});
