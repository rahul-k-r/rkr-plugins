const { test, describe, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { HOOK, runHook, git, makeRepo, writeStoryState, cleanup } = require('./helpers');

const GATE = HOOK('gate-git');
const ALLOW = 0;
const DENY = 2;

const repos = [];
const repo = (opts) => {
  const d = makeRepo(opts);
  repos.push(d);
  return d;
};
after(() => repos.forEach(cleanup));

const gate = (cwd, command) => runHook(GATE, { cwd, tool_input: { command } });
const statusOf = (cwd, command) => gate(cwd, command).status;

describe('scope — which commands and repos are gated at all', () => {
  test('commands that are not commit/push/pr-create are ignored', () => {
    const r = repo();
    for (const cmd of ['ls', 'npm test', 'git status', 'git log', 'git add .', 'git diff', 'gh pr view']) {
      assert.strictEqual(statusOf(r, cmd), ALLOW, cmd);
    }
  });

  test('a repo without docs/stories or docs/design-notes is never gated', () => {
    const r = repo({ workflow: false });
    assert.strictEqual(statusOf(r, 'git commit -m x'), ALLOW);
  });

  test('docs/design-notes alone marks a workflow repo', () => {
    const r = repo({ workflow: false });
    fs.mkdirSync(path.join(r, 'docs', 'design-notes'), { recursive: true });
    assert.strictEqual(statusOf(r, 'git commit -m x'), DENY);
  });

  test('a non-git directory is not gated', () => {
    const r = repo();
    const outside = path.join(r, '..');
    assert.strictEqual(runHook(GATE, { cwd: outside, tool_input: { command: 'git commit -m x' } }).status, ALLOW);
  });

  test('unparseable payloads fail open', () => {
    for (const raw of ['', 'not json', 'null']) {
      assert.strictEqual(runHook(GATE, raw).status, ALLOW, JSON.stringify(raw));
    }
  });
});

describe('direct commits on protected branches', () => {
  test('commit on main is denied', () => {
    const r = repo({ branch: 'main' });
    const res = gate(r, 'git commit -m "x"');
    assert.strictEqual(res.status, DENY);
    assert.match(res.stderr, /refusing to commit directly on "main"/);
  });

  test('commit on master is denied', () => {
    assert.strictEqual(statusOf(repo({ branch: 'master' }), 'git commit -m x'), DENY);
  });

  test('commit on a story branch is allowed', () => {
    assert.strictEqual(statusOf(repo({ branch: 'feat/abc-123-thing' }), 'git commit -m x'), ALLOW);
  });

  test('commit with intervening word flags is still recognised as a commit', () => {
    const r = repo({ branch: 'main' });
    for (const cmd of ['git --no-pager commit -am y', 'git --git-dir .git commit -m y']) {
      assert.strictEqual(statusOf(r, cmd), DENY, cmd);
    }
  });

  test('global options carrying a value do not hide the commit', () => {
    const r = repo({ branch: 'main' });
    for (const cmd of [
      'git -c user.name=x commit -m y',
      'git -c core.autocrlf=false commit -m y',
      'git --work-tree=/tmp/x commit -m y',
      'git --git-dir .git commit -m y',
      'git -c a=b -c c=d --no-pager commit -m y',
    ]) {
      assert.strictEqual(statusOf(r, cmd), DENY, cmd);
    }
  });

  // A path with a space must be consumed as the option's value, not mistaken for
  // the subcommand. Asserting DENY (not ALLOW) is what makes this meaningful: an
  // undetected command also exits 0, so only a denial proves detection happened.
  test('a quoted path in a global option is consumed as its value', () => {
    const outer = repo({ branch: 'feat/x' });
    const spaced = path.join(outer, 'nested dir');
    fs.mkdirSync(spaced, { recursive: true });
    git(spaced, 'init', '-q', '-b', 'main');
    git(spaced, 'config', 'user.email', 'test@example.com');
    git(spaced, 'config', 'user.name', 'Test');
    git(spaced, 'commit', '-q', '--allow-empty', '-m', 'init');
    fs.mkdirSync(path.join(spaced, 'docs', 'stories'), { recursive: true });

    assert.strictEqual(statusOf(outer, `git -C "${spaced}" commit -m y`), DENY);
  });

  // The detection must not fire on commands that merely contain the subcommand
  // word — the previous `(?:[\w-]+\s+)*` form matched `stash ` as a global option
  // and gated `git stash push` as a push.
  test('subcommands that merely contain the word are not gated', () => {
    const r = repo({ branch: 'main' });
    for (const cmd of [
      'git stash push -- some/path',
      'git log --grep commit',
      'git log --grep=commit',
      'git show --stat HEAD',
      'git bundle create out.bundle main',
    ]) {
      assert.strictEqual(statusOf(r, cmd), ALLOW, cmd);
    }
  });

  test('sprint/* is protected under the sprint model', () => {
    assert.strictEqual(statusOf(repo({ branch: 'sprint/w1' }), 'git commit -m x'), DENY);
  });

  test('sprint/* is NOT protected under the direct model', () => {
    const r = repo({ branch: 'sprint/w1', config: { branchModel: 'direct' } });
    assert.strictEqual(statusOf(r, 'git commit -m x'), ALLOW);
  });

  test('main stays protected under the direct model', () => {
    const r = repo({ branch: 'main', config: { branchModel: 'direct' } });
    assert.strictEqual(statusOf(r, 'git commit -m x'), DENY);
  });

  test('unreadable config falls back to the stricter sprint model', () => {
    const r = repo({ branch: 'sprint/w1' });
    fs.mkdirSync(path.join(r, '.sdlc'), { recursive: true });
    fs.writeFileSync(path.join(r, '.sdlc', 'config.json'), '{ not json');
    assert.strictEqual(statusOf(r, 'git commit -m x'), DENY);
  });

  test('a merge in progress permits the resolution commit on main', () => {
    const r = repo({ branch: 'main' });
    fs.writeFileSync(path.join(r, '.git', 'MERGE_HEAD'), 'deadbeef\n');
    assert.strictEqual(statusOf(r, 'git commit -m "merge"'), ALLOW);
  });
});

describe('release-commit exception', () => {
  // Stage exactly the named files — `git add -A` would also stage .sdlc/config.json
  // and make every case look like an out-of-list commit.
  const stage = (r, files) => {
    for (const [f, body] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(r, f)), { recursive: true });
      fs.writeFileSync(path.join(r, f), body);
      git(r, 'add', '--', f);
    }
  };

  test('allowed when every staged file is in releaseCommitPaths', () => {
    const r = repo({ branch: 'main', config: { releaseCommitPaths: ['package.json', 'CHANGELOG.md'] } });
    stage(r, { 'package.json': '{}', 'CHANGELOG.md': '# log' });
    assert.strictEqual(statusOf(r, 'git commit -m "release"'), ALLOW);
  });

  test('denied when any staged file falls outside the list', () => {
    const r = repo({ branch: 'main', config: { releaseCommitPaths: ['package.json'] } });
    stage(r, { 'package.json': '{}', 'src/app.js': 'x' });
    assert.strictEqual(statusOf(r, 'git commit -m "release"'), DENY);
  });

  test('denied when nothing is staged', () => {
    const r = repo({ branch: 'main', config: { releaseCommitPaths: ['package.json'] } });
    assert.strictEqual(statusOf(r, 'git commit -m "release"'), DENY);
  });

  test('denied when the exception is not configured at all', () => {
    const r = repo({ branch: 'main', config: { branchModel: 'sprint' } });
    stage(r, { 'package.json': '{}' });
    assert.strictEqual(statusOf(r, 'git commit -m "release"'), DENY);
  });

  test('an empty releaseCommitPaths list does not widen the gate', () => {
    const r = repo({ branch: 'main', config: { releaseCommitPaths: [] } });
    stage(r, { 'package.json': '{}' });
    assert.strictEqual(statusOf(r, 'git commit -m "release"'), DENY);
  });
});

describe('force-push protection', () => {
  test('force-pushing main is denied in every flag spelling', () => {
    const r = repo({ branch: 'feat/x' });
    for (const flag of ['--force', '-f', '--force-with-lease', '--force-with-lease=main']) {
      const res = gate(r, `git push ${flag} origin main`);
      assert.strictEqual(res.status, DENY, flag);
      assert.match(res.stderr, /force-push/);
    }
  });

  test('force-pushing while standing on a protected branch is denied', () => {
    assert.strictEqual(statusOf(repo({ branch: 'main' }), 'git push --force origin HEAD'), DENY);
  });

  test('force-pushing a sprint branch is denied under the sprint model', () => {
    assert.strictEqual(statusOf(repo({ branch: 'feat/x' }), 'git push --force origin sprint/w1'), DENY);
  });

  test('force-pushing a story branch is allowed', () => {
    assert.strictEqual(statusOf(repo({ branch: 'feat/x' }), 'git push --force origin feat/x'), ALLOW);
  });

  test('a non-force push to main is not blocked by this rule', () => {
    assert.strictEqual(statusOf(repo({ branch: 'feat/x' }), 'git push origin main'), ALLOW);
  });
});

describe('story-phase push gate', () => {
  const BRANCH = 'feat/abc-1-thing';
  const withPhase = (phase) => {
    const r = repo({ branch: BRANCH });
    writeStoryState(r, 'ABC-1', { story_key: 'ABC-1', branch: BRANCH, phase });
    return r;
  };

  for (const phase of ['READY_FOR_PR', 'PR_OPENED', 'AUTO_FIX']) {
    test(`push is allowed at phase ${phase}`, () => {
      assert.strictEqual(statusOf(withPhase(phase), 'git push -u origin HEAD'), ALLOW);
    });
  }

  for (const phase of ['DESIGN', 'INTAKE', 'PLAN', 'IMPLEMENT', 'FINAL_REVIEW', 'PAUSED']) {
    test(`push is denied at phase ${phase}`, () => {
      const res = gate(withPhase(phase), 'git push -u origin HEAD');
      assert.strictEqual(res.status, DENY);
      assert.match(res.stderr, /ABC-1/);
    });
  }

  test('gh pr create is gated by the same phases', () => {
    assert.strictEqual(statusOf(withPhase('IMPLEMENT'), 'gh pr create --fill'), DENY);
    assert.strictEqual(statusOf(withPhase('READY_FOR_PR'), 'gh pr create --fill'), ALLOW);
  });

  test('a branch with no matching story state is not phase-gated', () => {
    const r = repo({ branch: BRANCH });
    writeStoryState(r, 'ABC-2', { story_key: 'ABC-2', branch: 'feat/other', phase: 'IMPLEMENT' });
    assert.strictEqual(statusOf(r, 'git push -u origin HEAD'), ALLOW);
  });

  test('an unparseable story-state does not block the push', () => {
    const r = repo({ branch: BRANCH });
    writeStoryState(r, 'ABC-1', '{ corrupt');
    assert.strictEqual(statusOf(r, 'git push -u origin HEAD'), ALLOW);
  });
});

describe('resolving the repo a command actually targets', () => {
  test('git -C <path> is gated against that path, not the session cwd', () => {
    const clean = repo({ branch: 'feat/x' });
    const target = repo({ branch: 'main' });
    assert.strictEqual(statusOf(clean, `git -C ${target} commit -m x`), DENY);
    assert.strictEqual(statusOf(clean, `git -C ${target} push --force origin main`), DENY);
  });

  test('git -C pointing at a non-workflow repo stays ungated', () => {
    const clean = repo({ branch: 'feat/x' });
    const plain = repo({ workflow: false, branch: 'main' });
    assert.strictEqual(statusOf(clean, `git -C ${plain} commit -m x`), ALLOW);
  });

  test('a leading cd <path> && is honoured', () => {
    const clean = repo({ branch: 'feat/x' });
    const target = repo({ branch: 'main' });
    assert.strictEqual(statusOf(clean, `cd "${target}" && git commit -m x`), DENY);
  });

  // Exercises the `!/[$`]/.test(target)` guard at gate-git.js:105: the target IS
  // captured here (a single token), then rejected for containing `$`, so the
  // command stays gated against cwd. `$(...)` would not reach the guard at all —
  // the capture is \S+ and cannot span the space inside it.
  test('a target containing a shell variable is not followed', () => {
    const r = repo({ branch: 'main' });
    assert.strictEqual(statusOf(r, 'cd $HOME && git commit -m x'), DENY);
  });
});
