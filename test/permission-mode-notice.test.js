const { test, describe } = require('node:test');
const assert = require('node:assert');
const { HOOK, runHook } = require('./helpers');

const NOTICE = HOOK('permission-mode-notice');

const run = (payload) => runHook(NOTICE, payload);
const noticeFor = (r) => {
  if (!r.stdout.trim()) return null;
  return JSON.parse(r.stdout).hookSpecificOutput;
};

const RUN_COMMANDS = ['story-run', 'design-run', 'review-run'];

describe('when the notice fires', () => {
  test('a run command in a prompting mode gets the notice', () => {
    for (const cmd of RUN_COMMANDS) {
      const out = noticeFor(run({ prompt_text: `/sdlc:${cmd} ABC-1`, permission_mode: 'default' }));
      assert.ok(out, `${cmd} should produce a notice`);
      assert.strictEqual(out.hookEventName, 'UserPromptSubmit');
      assert.match(out.systemMessage, new RegExp(cmd));
      assert.match(out.systemMessage, /default/);
    }
  });

  test('leading whitespace does not defeat detection', () => {
    assert.ok(noticeFor(run({ prompt_text: '   /sdlc:story-run ABC-1', permission_mode: 'plan' })));
  });

  test('the mode defaults to "default" when absent', () => {
    const out = noticeFor(run({ prompt_text: '/sdlc:story-run ABC-1' }));
    assert.ok(out);
    assert.match(out.systemMessage, /permission mode: default/);
  });

  test('prompt_text and prompt are both honoured', () => {
    assert.ok(noticeFor(run({ prompt: '/sdlc:review-run', permission_mode: 'default' })));
  });
});

describe('when the notice stays silent', () => {
  test('auto-accepting modes get no notice', () => {
    for (const mode of ['acceptEdits', 'bypassPermissions', 'auto', 'dontAsk']) {
      assert.strictEqual(run({ prompt_text: '/sdlc:story-run ABC-1', permission_mode: mode }).stdout.trim(), '', mode);
    }
  });

  test('non-run commands and ordinary prompts get no notice', () => {
    for (const prompt of [
      '/sdlc:commit',
      '/sdlc:story-start ABC-1',
      'please run the story',
      'tell me about /sdlc:story-run',
      '/sdlc:story-runner',
    ]) {
      assert.strictEqual(run({ prompt_text: prompt, permission_mode: 'default' }).stdout.trim(), '', prompt);
    }
  });

  test('malformed or empty payloads stay silent and never block', () => {
    for (const raw of ['', 'not json', '{}', 'null', '42', '[]']) {
      const r = runHook(NOTICE, raw);
      assert.strictEqual(r.status, 0, JSON.stringify(raw));
      assert.strictEqual(r.stdout.trim(), '');
    }
  });
});

describe('the hook never blocks', () => {
  test('exit is always 0, notice or not', () => {
    assert.strictEqual(run({ prompt_text: '/sdlc:story-run ABC-1', permission_mode: 'default' }).status, 0);
    assert.strictEqual(run({ prompt_text: 'hello', permission_mode: 'default' }).status, 0);
  });
});
