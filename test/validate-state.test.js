const { test, describe, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { HOOK, runHook } = require('./helpers');
const { PHASES } = require('../sdlc/hooks/phases');

const VALIDATE = HOOK('validate-state');
const OK = 0;
const INVALID = 2;

const dirs = [];
after(() => dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

// Writes a story-state.json at a path the hook's pattern recognises and validates it.
function check(state, { key = 'ABC-1', filename = 'story-state.json' } = {}) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-state-test-'));
  dirs.push(base);
  const dir = path.join(base, 'docs', 'stories', key);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, filename);
  fs.writeFileSync(file, typeof state === 'string' ? state : JSON.stringify(state));
  return runHook(VALIDATE, { tool_input: { file_path: file } });
}

const valid = { story_key: 'ABC-1', branch: 'feat/abc-1-thing', phase: 'IMPLEMENT' };

describe('which files are validated', () => {
  test('a well-formed story-state.json passes', () => {
    assert.strictEqual(check(valid).status, OK);
  });

  test('files outside docs/stories/<key>/story-state.json are ignored', () => {
    assert.strictEqual(check('{ garbage', { filename: 'notes.json' }).status, OK);
  });

  test('a non-existent path is ignored', () => {
    const r = runHook(VALIDATE, { tool_input: { file_path: '/nope/docs/stories/X/story-state.json' } });
    assert.strictEqual(r.status, OK);
  });

  test('a missing or unparseable payload is ignored', () => {
    assert.strictEqual(runHook(VALIDATE, {}).status, OK);
    assert.strictEqual(runHook(VALIDATE, 'not json').status, OK);
  });

  // The hook normalises separators for the path pattern but then stats the raw
  // path, so a backslash path only resolves on Windows. There is no portable way
  // to make one exist elsewhere.
  test('Windows-style backslash paths are recognised', { skip: process.platform !== 'win32' }, () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-state-test-'));
    dirs.push(base);
    const dir = path.join(base, 'docs', 'stories', 'ABC-9');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'story-state.json');
    fs.writeFileSync(file, '{ corrupt');
    // path.join already yields backslashes on win32; force the case regardless
    const r = runHook(VALIDATE, { tool_input: { file_path: file.replace(/\//g, '\\') } });
    assert.strictEqual(r.status, INVALID);
  });
});

describe('structural validation', () => {
  test('unparseable JSON is reported', () => {
    const r = check('{ not json');
    assert.strictEqual(r.status, INVALID);
    assert.match(r.stderr, /not parseable JSON/);
  });

  test('a non-object root is reported', () => {
    for (const body of ['[]', '"a string"', '42', 'null']) {
      const r = check(body);
      assert.strictEqual(r.status, INVALID, body);
    }
  });

  test('missing story_key is reported', () => {
    const r = check({ branch: 'feat/x', phase: 'IMPLEMENT' });
    assert.strictEqual(r.status, INVALID);
    assert.match(r.stderr, /missing story_key/);
  });

  test('missing branch is reported', () => {
    const r = check({ story_key: 'ABC-1', phase: 'IMPLEMENT' });
    assert.strictEqual(r.status, INVALID);
    assert.match(r.stderr, /missing branch/);
  });

  test('the error message identifies the story directory', () => {
    const r = check({ story_key: 'ABC-1', phase: 'IMPLEMENT' }, { key: 'XYZ-7' });
    assert.match(r.stderr, /XYZ-7\/story-state\.json/);
  });
});

describe('phase legality', () => {
  for (const phase of PHASES) {
    test(`accepts phase ${phase}`, () => {
      assert.strictEqual(check({ ...valid, phase }).status, OK);
    });
  }

  test('rejects an unknown phase', () => {
    const r = check({ ...valid, phase: 'BANANA' });
    assert.strictEqual(r.status, INVALID);
    assert.match(r.stderr, /illegal phase "BANANA"/);
  });

  test('rejects a missing phase and a wrong-case phase', () => {
    assert.strictEqual(check({ story_key: 'A', branch: 'b' }).status, INVALID);
    assert.strictEqual(check({ ...valid, phase: 'implement' }).status, INVALID);
  });
});

// A lane section is a run of consecutive lane-tagged batches: they execute
// concurrently in separate worktrees, so their file sets must not overlap.
describe('lane plans', () => {
  const st = (id, batch, lane, files) => ({ id, batch, lane, files, status: 'PENDING' });
  const planned = (...subtasks) => check({ ...valid, plan: { subtasks } });

  test('a plan with no lanes is unaffected', () => {
    assert.strictEqual(planned({ id: 'ST-1', batch: 1 }, { id: 'ST-2', batch: 2 }).status, OK);
  });

  test('two lanes with disjoint files pass', () => {
    const r = planned(
      st('ST-1', 1, null, ['shared/types.ts']),
      st('ST-2', 2, 'be', ['backend/app/']),
      st('ST-3', 3, 'fe', ['frontend/src/**']),
      st('ST-4', 4, null, ['docs/'])
    );
    assert.strictEqual(r.status, OK);
  });

  test('overlapping directory vs file between lanes is rejected', () => {
    const r = planned(st('ST-2', 2, 'be', ['backend/app/']), st('ST-3', 3, 'fe', ['backend/app/views.py']));
    assert.strictEqual(r.status, INVALID);
    assert.match(r.stderr, /lanes "be" and "fe".*overlap/);
  });

  test('a glob that can match the other lane\'s file is rejected', () => {
    const r = planned(st('ST-2', 2, 'be', ['frontend/src/**']), st('ST-3', 3, 'fe', ['frontend/src/a.ts']));
    assert.strictEqual(r.status, INVALID);
    assert.match(r.stderr, /overlap/);
  });

  test('the same file in two lanes is rejected', () => {
    const r = planned(st('ST-2', 2, 'a', ['x.ts']), st('ST-3', 3, 'b', ['x.ts']));
    assert.strictEqual(r.status, INVALID);
    assert.match(r.stderr, /overlap/);
  });

  test('paths are compared after normalisation: case, ./, leading /, backslashes', () => {
    for (const [a, b] of [
      ['Backend/a.py', 'backend/a.py'],
      ['a/./b.ts', 'a/b.ts'],
      ['/a/b.ts', 'a/b.ts'],
      ['a\\b.ts', 'a/b.ts'],
      ['./a/', 'a/c.ts'],
    ]) {
      const r = planned(st('ST-2', 2, 'x', [a]), st('ST-3', 3, 'y', [b]));
      assert.strictEqual(r.status, INVALID, `${a} vs ${b}`);
    }
  });

  test('globs are compared on directory boundaries, not raw string prefixes', () => {
    assert.strictEqual(planned(st('ST-2', 2, 'a', ['backend']), st('ST-3', 3, 'b', ['backend-tools/*.ts'])).status, OK);
    assert.strictEqual(planned(st('ST-2', 2, 'a', ['src/api/']), st('ST-3', 3, 'b', ['src/apix/**'])).status, OK);
    assert.strictEqual(planned(st('ST-2', 2, 'a', ['src/']), st('ST-3', 3, 'b', ['src/api/**'])).status, INVALID);
  });

  test('a leading wildcard overlaps everything and says so', () => {
    const r = planned(st('ST-2', 2, 'a', ['**/*.ts']), st('ST-3', 3, 'b', ['docs/x.md']));
    assert.strictEqual(r.status, INVALID);
    assert.match(r.stderr, /overlap/);
  });

  test('square brackets are literal path characters (Next.js / SvelteKit routes), not globs', () => {
    const r = planned(st('ST-2', 2, 'a', ['app/[id]/page.tsx']), st('ST-3', 3, 'b', ['app/other/page.tsx']));
    assert.strictEqual(r.status, OK);
    assert.strictEqual(planned(st('ST-2', 2, 'a', ['app/[id]/page.tsx']), st('ST-3', 3, 'b', ['app/[id]/']))
      .status, INVALID);
  });

  test('batches are ordered numerically: 10 follows 2, not 1', () => {
    const r = planned(st('ST-2', 2, 'a', ['x/']), { id: 'ST-3', batch: 3 }, st('ST-4', 10, 'b', ['x/']));
    assert.strictEqual(r.status, OK, 'lanes in different sections may overlap');
    const sameSection = planned(st('ST-2', 2, 'a', ['x/']), st('ST-4', 10, 'b', ['x/']), { id: 'ST-5', batch: 11 });
    assert.strictEqual(sameSection.status, INVALID, 'a plain string sort would put 10 before 2 and split them');
  });

  test('a malformed plan is reported, never a hook crash (exit 1 would silently skip validation)', () => {
    for (const subtasks of [[null], ['x'], [42]]) {
      const r = check({ ...valid, plan: { subtasks } });
      assert.strictEqual(r.status, INVALID, JSON.stringify(subtasks));
      assert.match(r.stderr, /non-object/);
    }
    for (const lane of [{}, 3, ['a']]) {
      const r = planned({ id: 'ST-1', batch: 1, lane, files: ['a/'] });
      assert.strictEqual(r.status, INVALID, JSON.stringify(lane));
      assert.match(r.stderr, /lane must be a string/);
    }
  });

  test('a lane subtask needs an integer batch; "2" and 2 are the same batch', () => {
    assert.strictEqual(planned({ id: 'ST-1', lane: 'a', files: ['a/'] }).status, INVALID);
    assert.strictEqual(planned(st('ST-1', '1b', 'a', ['a/'])).status, INVALID);
    const r = planned(st('ST-2', '2', 'a', ['a/']), st('ST-3', 2, 'b', ['b/']));
    assert.strictEqual(r.status, INVALID);
    assert.match(r.stderr, /batch 2 mixes lanes/);
  });

  test('a lane may overlap itself across its own batches', () => {
    const r = planned(st('ST-2', 2, 'be', ['backend/']), st('ST-3', 3, 'be', ['backend/app/']), st('ST-4', 4, 'fe', ['frontend/']));
    assert.strictEqual(r.status, OK);
  });

  test('lanes in different sections (split by an untagged batch) may overlap', () => {
    const r = planned(st('ST-2', 2, 'a', ['x/']), { id: 'ST-3', batch: 3 }, st('ST-4', 4, 'b', ['x/']));
    assert.strictEqual(r.status, OK);
  });

  test('a lane subtask must list its files', () => {
    for (const files of [undefined, [], ['']]) {
      const r = planned(st('ST-2', 2, 'be', files));
      assert.strictEqual(r.status, INVALID, JSON.stringify(files));
      assert.match(r.stderr, /ST-2.*lane "be".*no files/);
    }
  });

  test('one batch cannot span two lanes', () => {
    const r = planned(st('ST-2', 2, 'be', ['a/']), st('ST-3', 2, 'fe', ['b/']));
    assert.strictEqual(r.status, INVALID);
    assert.match(r.stderr, /batch 2 mixes lanes/);
  });

  describe('lane records', () => {
    const withLanes = (lanes) => check({ ...valid, lanes });

    test('an ACTIVE lane needs its worktree, branch and fork sha', () => {
      assert.strictEqual(withLanes({ be: { status: 'ACTIVE' } }).status, INVALID);
      assert.strictEqual(withLanes({ be: { status: 'ACTIVE', worktree: '/w', branch: 'b-be', fork_sha: 'abc' } }).status, OK);
    });

    test('a MERGED or ABANDONED lane needs nothing more; an unknown status is rejected', () => {
      assert.strictEqual(withLanes({ be: { status: 'MERGED' } }).status, OK);
      assert.strictEqual(withLanes({ be: { status: 'ABANDONED' } }).status, OK);
      assert.strictEqual(withLanes({ be: { status: 'DONE?' } }).status, INVALID);
    });
  });
});

describe('revision budgets', () => {
  const budgeted = (budgets) => check({ ...valid, budgets });

  for (const k of ['frame_revisions', 'design_revisions', 'plan_revisions', 'replans']) {
    test(`${k}_used over max_${k} is rejected`, () => {
      const r = budgeted({ [`${k}_used`]: 3, [`max_${k}`]: 2 });
      assert.strictEqual(r.status, INVALID);
      assert.match(r.stderr, new RegExp(`budgets\\.${k}_used`));
    });

    test(`${k}_used at max_${k} is allowed`, () => {
      assert.strictEqual(budgeted({ [`${k}_used`]: 2, [`max_${k}`]: 2 }).status, OK);
    });
  }

  test('per-batch retries over the cap are rejected', () => {
    const r = budgeted({ max_retries_per_batch: 2, retries_used: { batch1: 1, batch2: 5 } });
    assert.strictEqual(r.status, INVALID);
    assert.match(r.stderr, /retries_used\[batch2\]/);
  });

  test('per-batch retries at the cap are allowed', () => {
    assert.strictEqual(budgeted({ max_retries_per_batch: 2, retries_used: { b: 2 } }).status, OK);
  });

  test('absent, partial, or non-numeric budgets are not enforced', () => {
    assert.strictEqual(budgeted(undefined).status, OK);
    assert.strictEqual(budgeted({}).status, OK);
    assert.strictEqual(budgeted({ replans_used: 9 }).status, OK, 'no max to compare against');
    assert.strictEqual(budgeted({ replans_used: '9', max_replans: 1 }).status, OK, 'non-numeric');
  });
});
