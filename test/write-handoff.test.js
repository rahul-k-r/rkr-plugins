const { test, describe, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { HOOK, runHook, makeRepo, writeStoryState, cleanup } = require('./helpers');

const WRITE = HOOK('write-handoff');
const repos = [];
after(() => repos.forEach(cleanup));

// Persists `state` as the story's state file, fires the hook as a PostToolUse write, returns handoff.md (or null).
function handoff(state, { files = [] } = {}) {
  const repo = makeRepo();
  repos.push(repo);
  const file = writeStoryState(repo, 'ABC-1', { story_key: 'ABC-1', branch: 'feat/abc-1-x', ...state });
  for (const f of files) fs.writeFileSync(path.join(path.dirname(file), f), '');
  const r = runHook(WRITE, { tool_input: { file_path: file } });
  assert.strictEqual(r.status, 0);
  const out = path.join(path.dirname(file), 'handoff.md');
  return fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : null;
}

const status = (md) => md.match(/\*\*Status:\*\* (\w+)/)[1];

describe('status', () => {
  test('closed with nothing outstanding is DONE', () => {
    assert.strictEqual(status(handoff({ phase: 'CLOSED' })), 'DONE');
  });

  test('an undecided escalation is NEEDS_DECISION and is spelled out with options', () => {
    const md = handoff({
      phase: 'PAUSED',
      escalations: [{ phase: 'IMPLEMENT', batch: 2, question: 'Use outbox or direct publish?', options: ['outbox', 'direct'], recommendation: 'outbox', decision: null }],
    });
    assert.strictEqual(status(md), 'NEEDS_DECISION');
    assert.match(md, /Use outbox or direct publish\?/);
    assert.match(md, /option: outbox/);
    assert.match(md, /recommendation: outbox/);
    assert.match(md, /--resume/);
  });

  test('a decided escalation is not listed', () => {
    const md = handoff({ phase: 'IMPLEMENT', escalations: [{ question: 'Q?', decision: 'A' }] });
    assert.strictEqual(status(md), 'NEEDS_ACTION');
    assert.doesNotMatch(md, /Decisions needed/);
  });

  test('a checkpoint pending_question counts as a decision', () => {
    const md = handoff({ phase: 'PAUSED', checkpoint: { pending_question: 'Which base branch?' } });
    assert.strictEqual(status(md), 'NEEDS_DECISION');
    assert.match(md, /Which base branch\?/);
  });

  test('PR opened without bypass awaits review and surfaces review notes', () => {
    const md = handoff({
      phase: 'PR_OPENED',
      pr: { number: 7, url: 'https://github.com/o/r/pull/7' },
      final_review: { notes: [{ kind: 'ASSUMPTION', note: 'assumed UTC', ref: 'src/a.ts:10' }] },
    });
    assert.strictEqual(status(md), 'AWAITING_REVIEW');
    assert.match(md, /pull\/7/);
    assert.match(md, /\[ASSUMPTION\] assumed UTC — src\/a\.ts:10/);
  });

  test('PR opened under bypass is NEEDS_ACTION: the tail has not finished', () => {
    const md = handoff({ phase: 'PR_OPENED', bypass: true });
    assert.strictEqual(status(md), 'NEEDS_ACTION');
    assert.match(md, /--bypass tail/);
  });

  test('unresolved discovered work keeps a closed story from being DONE', () => {
    const md = handoff({
      phase: 'CLOSED',
      discovered_work: [{ description: 'flaky retry', evidence: 'a.go:3', recommendation: 'new-story', resolution: null }],
    });
    assert.strictEqual(status(md), 'NEEDS_ACTION');
    assert.match(md, /flaky retry/);
  });
});

describe('next action', () => {
  test('incognito READY_FOR_PR points at story-pr, never resume', () => {
    const md = handoff({ phase: 'READY_FOR_PR', write_mode: 'incognito' });
    assert.match(md, /\/sdlc:story-pr/);
  });

  test('a mid-flight phase resumes by key', () => {
    assert.match(handoff({ phase: 'IMPLEMENT' }), /\/sdlc:story-run ABC-1 --resume/);
  });

  test('a batch member resumes through its orchestrator, not on its own', () => {
    const md = handoff({ phase: 'IMPLEMENT', batch: { id: 'batch-1', lane: 1 } });
    assert.match(md, /\/sdlc:batch-run --resume/);
    assert.doesNotMatch(md, /\/sdlc:story-run ABC-1 --resume/);
  });
});

describe('content', () => {
  test('lists unfinished subtasks and open BLOCKING/MAJOR findings but not MINOR ones', () => {
    const md = handoff({
      phase: 'AUTO_REVIEW',
      plan: { subtasks: [{ id: 'ST-1', title: 'done one', status: 'DONE' }, { id: 'ST-2', title: 'todo one', batch: 2, status: 'PENDING' }] },
      auto_review: { findings: [{ severity: 'MAJOR', title: 'missing auth check' }, { severity: 'MINOR', title: 'naming nit' }] },
    });
    assert.match(md, /ST-2/);
    assert.doesNotMatch(md, /ST-1/);
    assert.match(md, /missing auth check/);
    assert.doesNotMatch(md, /naming nit/);
  });

  test('batches committed since the last reviewer pass are surfaced, and silence when none', () => {
    const md = handoff({ phase: 'IMPLEMENT', batch_review: { every: 3, batches_since: 2, last_reviewed_sha: 'abc' } });
    assert.match(md, /2 batch\(es\) committed since the last reviewer pass/);
    assert.doesNotMatch(handoff({ phase: 'IMPLEMENT', batch_review: { every: 3, batches_since: 0 } }), /since the last reviewer pass/);
  });

  test('design rounds whose mechanical fixes were applied without a re-review are surfaced', () => {
    const md = handoff({
      phase: 'IMPLEMENT',
      design: { reviews: [{ verdict: 'APPROVE' }, { verdict: 'REVISE', scope: 'mechanical_unreviewed', mechanical_applied: ['a', 'b'] }] },
    });
    assert.match(md, /1 design round\(s\) had mechanical fixes applied without a re-review/);
  });

  test('handoff.stop_reason and notes are carried through', () => {
    const md = handoff({ phase: 'AWAITING_CI', handoff: { stop_reason: 'CI red: lint', notes: ['BATCH_COMPLETE 2 failed to post'] } });
    assert.match(md, /Stopped because: CI red: lint/);
    assert.match(md, /BATCH_COMPLETE 2 failed to post/);
  });

  test('pointers list only files that exist', () => {
    const md = handoff({ phase: 'PAUSED' }, { files: ['checkpoint.md'] });
    assert.match(md, /checkpoint\.md/);
    assert.doesNotMatch(md, /context-pack\.md/);
  });

  test('is rewritten, not appended, on the next write', () => {
    const repo = makeRepo();
    repos.push(repo);
    const file = writeStoryState(repo, 'ABC-1', { story_key: 'ABC-1', branch: 'b', phase: 'PAUSED', checkpoint: { pending_question: 'Q?' } });
    runHook(WRITE, { tool_input: { file_path: file } });
    writeStoryState(repo, 'ABC-1', { story_key: 'ABC-1', branch: 'b', phase: 'CLOSED' });
    runHook(WRITE, { tool_input: { file_path: file } });
    const md = fs.readFileSync(path.join(path.dirname(file), 'handoff.md'), 'utf8');
    assert.strictEqual(status(md), 'DONE');
    assert.doesNotMatch(md, /Q\?/);
  });
});

describe('batch rollup', () => {
  function batch(b, stories = {}) {
    const repo = makeRepo();
    repos.push(repo);
    for (const [key, st] of Object.entries(stories)) writeStoryState(repo, key, { story_key: key, branch: 'b', ...st });
    const dir = path.join(repo, 'docs', 'stories', '_batch', 'batch-1');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'batch-state.json');
    fs.writeFileSync(file, JSON.stringify({ batch_id: 'batch-1', ...b }));
    assert.strictEqual(runHook(WRITE, { tool_input: { file_path: file } }).status, 0);
    return fs.readFileSync(path.join(dir, 'batch-handoff.md'), 'utf8');
  }

  test('tabulates every story and flags the ones awaiting a decision', () => {
    const md = batch(
      { phase: 'EXECUTE', stories: [{ key: 'A-1', status: 'PAUSED' }, { key: 'A-2', status: 'WAITING' }], edges: [{ from: 'A-1', to: 'A-2', type: 'needs-code' }] },
      { 'A-1': { phase: 'PAUSED', escalations: [{ question: 'Q?', decision: null }] } }
    );
    assert.match(md, /\*\*Status:\*\* NEEDS_DECISION/);
    assert.match(md, /\| A-1 \| PAUSED \| PAUSED \| — \| 1 \|/);
    assert.match(md, /\| A-2 \| WAITING .* A-1 \(needs-code\) \|/);
    assert.match(md, /batch-run --resume/);
  });

  test('a fully settled batch is DONE; blocked stories make it NEEDS_ACTION', () => {
    const done = batch({ phase: 'DONE', stories: [{ key: 'A-1', status: 'CLOSED' }] }, { 'A-1': { phase: 'CLOSED' } });
    assert.match(done, /\*\*Status:\*\* DONE/);
    const blocked = batch({ phase: 'EXECUTE', stories: [{ key: 'A-1', status: 'FAILED' }, { key: 'A-2', status: 'BLOCKED', blocked_by: 'A-1 failed' }] });
    assert.match(blocked, /\*\*Status:\*\* NEEDS_ACTION/);
    assert.match(blocked, /A-2 \(BLOCKED\): A-1 failed/);
  });

  test('PR_OPENED is not settled under --bypass, and DONE needs the batch itself to be DONE', () => {
    const stories = [{ key: 'A-1', status: 'PR_OPENED' }];
    assert.match(batch({ phase: 'DONE', flags: { passthrough: ['--bypass'] }, stories }), /\*\*Status:\*\* NEEDS_ACTION/);
    assert.match(batch({ phase: 'EXECUTE', stories }), /\*\*Status:\*\* RUNNING/);
    assert.match(batch({ phase: 'DONE', stories }), /\*\*Status:\*\* DONE/);
  });

  test('object PRs, multiline and pipe-bearing cells render as one clean row', () => {
    const md = batch({
      phase: 'EXECUTE',
      stories: [{ key: 'A-1', status: 'BLOCKED', pr: { number: 5, url: null }, blocked_by: 'A-0 failed\nfoo | bar' }],
    });
    assert.doesNotMatch(md, /\[object Object\]/);
    assert.match(md, /\| A-1 \| BLOCKED \| — \| #5 \| 0 \| A-0 failed foo \/ bar \|/);
  });

  test('stories waiting on a merge are called out once the batch has stopped', () => {
    const md = batch({
      phase: 'DONE',
      edges: [{ from: 'A-1', to: 'A-2', type: 'needs-code' }],
      stories: [{ key: 'A-1', status: 'PR_OPENED' }, { key: 'A-2', status: 'WAITING' }],
    });
    assert.match(md, /\*\*Status:\*\* NEEDS_ACTION/);
    assert.match(md, /A-2: waits for A-1 to be merged/);
    assert.match(md, /Merge the PRs/);
  });

  test('next action tracks whether --comment was passed and posted', () => {
    const base = { phase: 'DONE', stories: [{ key: 'A-1', status: 'CLOSED' }] };
    assert.match(batch({ ...base, flags: { comment: true } }), /still to post/);
    assert.match(batch({ ...base, flags: { comment: true }, comments: { tickets: { 'A-1': { posted_at: 'x' } } } }), /comments are posted/);
    assert.match(batch(base), /comments-draft\.md/);
  });
});

describe('never blocks or writes where it should not', () => {
  test('ignores files that are not a story-state.json', () => {
    const repo = makeRepo();
    repos.push(repo);
    const dir = path.join(repo, 'docs', 'stories', 'ABC-1');
    fs.mkdirSync(dir, { recursive: true });
    const f = path.join(dir, 'plan-summary.md');
    fs.writeFileSync(f, 'x');
    assert.strictEqual(runHook(WRITE, { tool_input: { file_path: f } }).status, 0);
    assert.ok(!fs.existsSync(path.join(dir, 'handoff.md')));
  });

  test('corrupt or illegal-phase state exits 0 and writes nothing', () => {
    assert.strictEqual(handoff({ phase: 'NOPE' }), null);
    const repo = makeRepo();
    repos.push(repo);
    const file = writeStoryState(repo, 'ABC-1', '{ garbage');
    assert.strictEqual(runHook(WRITE, { tool_input: { file_path: file } }).status, 0);
    assert.ok(!fs.existsSync(path.join(path.dirname(file), 'handoff.md')));
  });

  test('bad stdin exits 0', () => {
    assert.strictEqual(runHook(WRITE, 'not json').status, 0);
  });
});
