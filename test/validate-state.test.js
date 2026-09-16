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
