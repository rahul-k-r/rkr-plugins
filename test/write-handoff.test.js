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
