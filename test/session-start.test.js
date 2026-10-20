const { test, describe, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { HOOK, runHook, makeRepo, writeStoryState, cleanup } = require('./helpers');

const START = HOOK('session-start');
const repos = [];
after(() => repos.forEach(cleanup));

function announce(setup) {
  const repo = makeRepo();
  repos.push(repo);
  setup(repo);
  return runHook(START, { cwd: repo }).stdout;
}

function writeBatch(repo, state) {
  const dir = path.join(repo, 'docs', 'stories', '_batch', 'batch-1');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'batch-state.json'), JSON.stringify(state));
}

describe('session-start announcements', () => {
  test('a paused standalone story points at story-run --resume and its handoff', () => {
    const out = announce((r) =>
      writeStoryState(r, 'ABC-1', { story_key: 'ABC-1', branch: 'b', phase: 'PAUSED', escalations: [{ question: 'Q?', decision: null }] })
    );
    assert.match(out, /ABC-1: PAUSED/);
    assert.match(out, /handoff\.md/);
    assert.match(out, /\/sdlc:story-run ABC-1 --resume/);
  });

  test('a batch member points at the batch orchestrator instead', () => {
    const out = announce((r) => writeStoryState(r, 'ABC-1', { story_key: 'ABC-1', branch: 'b', phase: 'IMPLEMENT', batch: { id: 'batch-1' } }));
    assert.match(out, /\/sdlc:batch-run --resume/);
    assert.doesNotMatch(out, /story-run ABC-1/);
  });

  test('an unfinished batch is announced; a DONE one is not', () => {
    assert.match(announce((r) => writeBatch(r, { batch_id: 'batch-1', phase: 'EXECUTE' })), /batch batch-1: in flight.*batch-handoff\.md/);
    assert.strictEqual(announce((r) => writeBatch(r, { batch_id: 'batch-1', phase: 'DONE' })).trim(), '');
  });

  test('finished stories are silent', () => {
    assert.strictEqual(announce((r) => writeStoryState(r, 'ABC-1', { story_key: 'ABC-1', branch: 'b', phase: 'CLOSED' })).trim(), '');
  });
});
