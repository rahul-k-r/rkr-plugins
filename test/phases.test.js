const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('./helpers');
const { PHASES, DONE } = require('../sdlc/hooks/phases');

const gateGitSrc = fs
  .readFileSync(path.join(ROOT, 'sdlc', 'hooks', 'gate-git.js'), 'utf8')
  .replace(/\r\n/g, '\n');

describe('phase vocabulary', () => {
  test('the phases story-run walks through are all present', () => {
    for (const p of ['DESIGN', 'INTAKE', 'PLAN', 'IMPLEMENT', 'FINAL_REVIEW', 'READY_FOR_PR', 'PR_OPENED']) {
      assert.ok(PHASES.has(p), `missing phase ${p}`);
    }
  });

  test('the --bypass tail and terminal phases are present', () => {
    for (const p of ['AUTO_REVIEW', 'AUTO_FIX', 'AWAITING_CI', 'MERGED', 'CLOSED', 'PUBLISHED', 'PAUSED']) {
      assert.ok(PHASES.has(p), `missing phase ${p}`);
    }
  });

  test('DONE is a subset of PHASES', () => {
    for (const p of DONE) assert.ok(PHASES.has(p), `${p} is terminal but not a legal phase`);
  });

  test('PAUSED is not terminal — --resume has work to do', () => {
    assert.ok(!DONE.has('PAUSED'));
  });

  test('phase names are upper snake case', () => {
    for (const p of PHASES) assert.match(p, /^[A-Z][A-Z_]*$/, p);
  });
});

describe('cross-hook consistency', () => {
  // gate-git.js hardcodes its own push-allowed set; if a phase name is renamed in
  // phases.js and not there, the push gate silently blocks a legal push.
  test("gate-git's push-allowed phases are all legal phases", () => {
    const m = gateGitSrc.match(/PUSH_OK\s*=\s*new Set\(\[([^\]]*)\]\)/);
    assert.ok(m, 'could not locate PUSH_OK in gate-git.js');
    const pushOk = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    assert.ok(pushOk.length > 0);
    for (const p of pushOk) assert.ok(PHASES.has(p), `PUSH_OK phase ${p} is not in PHASES`);
  });
});
