const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('./helpers');

const read = (...p) => fs.readFileSync(path.join(ROOT, 'sdlc', ...p), 'utf8').replace(/\r\n/g, '\n');
const STORY_RUN = read('commands', 'story-run.md');
const BATCH_RUN = read('commands', 'batch-run.md');
const PLANNER = read('agents', 'planner.md');
const ARCHITECT = read('agents', 'architect.md');
const WORKTREE = read('internal', 'worktree-mode', 'SKILL.md');
const HELP = read('commands', 'help.md');

const frontmatterArgs = (md) => (md.match(/^argument-hint: "([^"]*)"/m) || [, ''])[1];

describe('lanes: the story-run contract', () => {
  test('--lanes is in the usage line, the argument hint and the flag list', () => {
    assert.match(frontmatterArgs(STORY_RUN), /\[--lanes N\]/);
    assert.match(STORY_RUN, /^- `--lanes N` —/m);
    assert.match(STORY_RUN, /\/sdlc:story-run \[<KEY>\][^\n]*\[--lanes N\]/);
  });

  test('lanes_cap is resolved at preflight and recorded in the state schema', () => {
    assert.match(STORY_RUN, /\*\*Resolve `lanes_cap`\*\*/);
    assert.match(STORY_RUN, /"lanes_cap": 2/);
    assert.match(STORY_RUN, /"lanes": \{"be": \{"status": "ACTIVE\|MERGED\|ABANDONED"/);
    assert.match(STORY_RUN, /"schema_version": 7/);
  });

  test('lane sections merge with a merge commit, never a squash, and clean up', () => {
    assert.match(STORY_RUN, /merge --no-ff <branch>-<lane>/);
    assert.match(STORY_RUN, /never a squash/);
    assert.doesNotMatch(STORY_RUN, /merge --squash/);
    assert.match(STORY_RUN, /git worktree remove --force/);
  });

  test('a conflict escalates and is never auto-resolved', () => {
    assert.match(STORY_RUN, /merge --abort`, then \*\*ESCALATE\*\* \(never auto-resolve\)/);
  });

  test('two test suites or builds never run at once', () => {
    assert.match(STORY_RUN, /two test suites or builds never run at once/i);
  });

  test('lanes are event-driven: background dispatch, no round barrier between lanes', () => {
    assert.match(STORY_RUN, /\*\*Event-driven — no lane waits on another\.\*\*/);
    assert.match(STORY_RUN, /Dispatch every step with `run_in_background: true`/);
    assert.doesNotMatch(STORY_RUN, /\*\*Rounds\.\*\*/);
    assert.match(STORY_RUN, /"step": "CODE\|VERIFY"/);
  });

  test('a seam gate runs the full gate after the lanes merge', () => {
    assert.match(STORY_RUN, /\*\*Seam gate\.\*\*[^\n]*full gate on the story branch/);
  });

  test('the final review sweeps leftover lane worktrees, and resume reconciles lanes', () => {
    assert.match(STORY_RUN, /sweep any lane worktree still registered/);
    assert.match(STORY_RUN, /lane section in flight — `lanes` non-empty/);
  });

  test('lane-tagged plans stay valid sequentially', () => {
    assert.match(STORY_RUN, /the plan is always valid sequentially/);
    assert.match(PLANNER, /strictly in order is still a correct build/);
  });
});

describe('lanes: planner, architect, worktrees, batch-run agree', () => {
  test('the planner emits lane and files and requires disjointness', () => {
    assert.match(PLANNER, /"lane": null, "files": \[/);
    assert.match(PLANNER, /contract-first/);
    assert.match(PLANNER, /disjoint `files`/);
  });

  test('the architect reviews lane decomposition', () => {
    assert.match(ARCHITECT, /decomposed contract-first into `lane`s/);
  });

  test('worktree-mode documents lane worktrees: partial bootstrap and lifetime', () => {
    assert.match(WORKTREE, /^## Lane worktrees/m);
    assert.match(WORKTREE, /\*\*Partial bootstrap\.\*\*/);
    assert.match(WORKTREE, /Removed right after the lane merges/);
  });

  test('batch-run divides --lanes across stories and shares its heavy-work lock', () => {
    assert.match(frontmatterArgs(BATCH_RUN), /\[--lanes N\]/);
    assert.match(BATCH_RUN, /max\(1, floor\(N \/ running stories\)\)/);
    assert.match(BATCH_RUN, /--lanes <per-story share of --lanes>/);
    assert.match(BATCH_RUN, /also the lock for story-run's lane sections/);
  });

  test('help mentions parallel lanes', () => {
    assert.match(HELP, /\*\*Parallel lanes\.\*\*/);
  });
});
