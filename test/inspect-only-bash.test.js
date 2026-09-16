const { test, describe } = require('node:test');
const assert = require('node:assert');
const { HOOK, runHook } = require('./helpers');

const GUARD = HOOK('guard-agent-tools');
const ALLOW = 0;
const DENY = 2;

const bash = (agent, command) =>
  runHook(GUARD, { agent_type: `sdlc:${agent}`, tool_name: 'Bash', tool_input: { command } }).status;

const INSPECTORS = ['reviewer', 'integrator'];

describe('the commands these agents are actually dispatched', () => {
  const ALLOWED = [
    'git diff abc123..HEAD',
    'git diff main...sprint/w1',
    'git log --oneline -20',
    'git show --stat HEAD',
    'git -C /abs/work/tree diff base..HEAD',
    'git -C "/abs/work tree" diff base..HEAD',
    'cd /abs/work/tree && git diff base..HEAD',
    'gh pr diff 42',
    'gh pr view 42 --json title,body',
    'gh pr view 42 --comments',
    'gh api repos/{owner}/{repo}/issues/42/comments',
    'git diff main...HEAD | head -200',
    'gh pr diff 42 | grep -c "^+"',
  ];

  for (const agent of INSPECTORS) {
    test(`${agent} may run its inspection commands`, () => {
      for (const cmd of ALLOWED) assert.strictEqual(bash(agent, cmd), ALLOW, `${agent}: ${cmd}`);
    });
  }
});

describe('mutation is denied', () => {
  const DENIED = [
    'gh pr checkout 42',
    'git switch main',
    'git checkout -- .',
    'git commit -m x',
    'git push origin main',
    'git stash',
    'git reset --hard origin/main',
    'npm install',
    'rm -rf src',
    "sed -i 's/a/b/' src/app.js",
    'echo hacked',
  ];

  for (const agent of INSPECTORS) {
    test(`${agent} may not mutate the tree`, () => {
      for (const cmd of DENIED) assert.strictEqual(bash(agent, cmd), DENY, `${agent}: ${cmd}`);
    });
  }

  test('redirection and command substitution disqualify the whole command', () => {
    for (const cmd of [
      'git diff > /tmp/out.txt',
      'git diff >> notes.md',
      'git diff $(rm -rf src)',
      'git diff `whoami`',
      'cd /tmp && git diff > x',
    ]) {
      assert.strictEqual(bash('reviewer', cmd), DENY, cmd);
    }
  });

  test('every segment must qualify, not just the first', () => {
    assert.strictEqual(bash('reviewer', 'git diff && rm -rf src'), DENY);
    assert.strictEqual(bash('reviewer', 'git diff; npm install'), DENY);
    assert.strictEqual(bash('reviewer', 'git diff | tee out.txt'), DENY);
  });

  test('a write-flagged gh api call is denied', () => {
    for (const cmd of [
      'gh api -X POST repos/o/r/issues/1/comments',
      'gh api --method PATCH repos/o/r/pulls/1',
      'gh api repos/o/r/issues/1/comments -f body=hi',
    ]) {
      assert.strictEqual(bash('reviewer', cmd), DENY, cmd);
    }
  });

  test('an empty command is denied rather than waved through', () => {
    assert.strictEqual(bash('reviewer', ''), DENY);
  });
});

describe('the gate is narrow', () => {
  test('only Bash is gated for these agents', () => {
    for (const agent of INSPECTORS) {
      for (const tool of ['Read', 'Grep', 'Glob', 'SubagentHandback']) {
        const r = runHook(GUARD, { agent_type: `sdlc:${agent}`, tool_name: tool });
        assert.strictEqual(r.status, ALLOW, `${agent} / ${tool}`);
      }
    }
  });

  test('agents that legitimately mutate are untouched', () => {
    // coder implements, validator runs the repo's own unbounded build command
    for (const agent of ['coder', 'validator']) {
      for (const cmd of ['npm install', 'git commit -m x', 'make build', 'rm -rf dist']) {
        assert.strictEqual(bash(agent, cmd), ALLOW, `${agent}: ${cmd}`);
      }
    }
  });

  test('another plugin\'s reviewer is not governed', () => {
    const r = runHook(GUARD, {
      agent_type: 'otherplugin:reviewer',
      tool_name: 'Bash',
      tool_input: { command: 'rm -rf src' },
    });
    assert.strictEqual(r.status, ALLOW);
  });
});
