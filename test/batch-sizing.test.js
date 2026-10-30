const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('./helpers');

const read = (...p) => fs.readFileSync(path.join(ROOT, 'sdlc', ...p), 'utf8').replace(/\r\n/g, '\n');
const PLANNER = read('agents', 'planner.md');
const ARCHITECT = read('agents', 'architect.md');
const HELP = read('commands', 'help.md');
const CODER = read('agents', 'coder.md');
const STORY_RUN = read('commands', 'story-run.md');

const sizing = PLANNER.match(/Target about (\d+) routine subtasks per batch, never more than (\d+), and about (\d+) batches per story/);

describe('batch sizing', () => {
  test('planner states target, ceiling and batches-per-story', () => {
    assert.ok(sizing, 'planner.md sizing sentence not found');
    const [, target, max, batches] = sizing.map(Number);
    assert.ok(target <= max, 'target must not exceed the ceiling');
    assert.ok(batches >= 1);
  });

  test('architect PLAN_REVIEW and help quote the same numbers as the planner', () => {
    const [, target, max, batches] = sizing;
    assert.match(ARCHITECT, new RegExp(`about ${target} routine subtasks, never more than ${max}, about ${batches} batches per story`));
    assert.match(HELP, new RegExp(`about ${target} routine subtasks, ≤${max}, about ${batches} batches per story`));
  });

  test('planner caps contract-changing subtasks per batch instead of shrinking the whole batch', () => {
    assert.match(PLANNER, /at most 2 contract-changing subtasks/);
    assert.doesNotMatch(PLANNER, /smaller \(1–2 subtasks\)/);
  });
});

describe('batch verification dispatch', () => {
  test('reviewer and validator are dispatched concurrently, not back to back', () => {
    assert.match(STORY_RUN, /Dispatch `validator`[^\n]*in the same message as 5b's `reviewer`/);
  });
});

describe('coder dispatch', () => {
  test('the batch spec is inlined: story-run passes it, coder does not read the state file', () => {
    assert.match(STORY_RUN, /Dispatch `coder` with the batch spec \*\*inlined\*\*/);
    assert.match(CODER, /inlined in your dispatch; don't read `story-state\.json`/);
    assert.doesNotMatch(CODER, /story-state\.json`\s*\(for the current batch spec\)/);
  });
});
