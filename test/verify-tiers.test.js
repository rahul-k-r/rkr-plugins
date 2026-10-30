const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('./helpers');

const read = (...p) => fs.readFileSync(path.join(ROOT, 'sdlc', ...p), 'utf8').replace(/\r\n/g, '\n');
const STORY_RUN = read('commands', 'story-run.md');
const BATCH_RUN = read('commands', 'batch-run.md');
const VALIDATOR = read('agents', 'validator.md');
const CODER = read('agents', 'coder.md');
const PLANNER = read('agents', 'planner.md');
const INTAKE = read('agents', 'intake.md');

describe('two-tier verification: scoped per batch, full at the seam and final gates', () => {
  test('story-run resolves a batch-scoped command set with placeholders and falls back to full', () => {
    assert.match(STORY_RUN, /\*Batch-scoped verify commands\*/);
    assert.match(STORY_RUN, /\{test_targets\}/);
    assert.match(STORY_RUN, /\{changed_files\}/);
    assert.match(STORY_RUN, /never guess a scoped form[^\n]*falls back to the full commands/i);
  });

  test('the per-batch validator dispatch is scope: batch with the coder\'s test_targets', () => {
    assert.match(STORY_RUN, /Dispatch `validator` with `scope: batch`/);
    assert.match(STORY_RUN, /`test_targets`[^\n]*`git diff --name-only --diff-filter=d <batch_base_sha>\.\.HEAD`/);
    assert.match(STORY_RUN, /substitute the full test command for that step yourself/);
    assert.match(STORY_RUN, /when `verify_batch` is null, dispatch the full `verify_commands` as `scope: full`/i);
  });

  test('the final review and the seam gate run scope: full', () => {
    assert.match(STORY_RUN, /Dispatch `validator` with `scope: full`/);
    assert.match(STORY_RUN, /\*\*Seam gate\.\*\*[^\n]*`scope: full`/);
  });

  test('state schema carries both command sets', () => {
    assert.match(STORY_RUN, /"verify_commands": \["\.\.\."\]/);
    assert.match(STORY_RUN, /"verify_batch": \["[^"]*null = run verify_commands every batch"\]/);
  });

  test('the coder reports the exact tests it ran', () => {
    assert.match(CODER, /"test_targets": \[/);
    assert.match(CODER, /`test_targets` is always present/);
  });

  test('the validator knows scope, never overclaims, and never runs zero tests silently', () => {
    assert.match(VALIDATOR, /`scope: batch\|full`/);
    assert.match(VALIDATOR, /"scope": "batch\|full"/);
    assert.match(VALIDATOR, /not a full-suite PASS/);
    assert.match(VALIDATOR, /Never pass on zero tests/);
    assert.match(VALIDATOR, /"ran zero tests"/);
  });

  test('batch-run hands stories both tiers; intake quotes both; planner keeps the full-green invariant', () => {
    assert.match(BATCH_RUN, /verify commands \(full and batch-scoped\)/);
    assert.match(INTAKE, /verify commands \(full and batch-scoped\)/);
    assert.match(PLANNER, /verified per batch by the scoped gate and in full at the seam and final gates/);
  });
});
