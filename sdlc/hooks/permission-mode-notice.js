#!/usr/bin/env node
// UserPromptSubmit hook: when a run command (story-run/design-run/review-run)
// is invoked without an auto-accept permission mode, tell the user up front
// that the run will pause for approval on every edit/command — and how to
// switch. Silent on every other prompt; never blocks.
const RUN_COMMAND = /^\s*\/sdlc:(story-run|design-run|review-run)\b/;
// Modes that don't prompt per tool call; anything else gets the notice.
const AUTO_MODES = new Set(['acceptEdits', 'bypassPermissions', 'auto', 'dontAsk']);

let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => {
  let payload;
  try {
    payload = JSON.parse(input);
  } catch {
    process.exit(0);
  }

  const prompt = payload.prompt_text ?? payload.prompt ?? '';
  const mode = payload.permission_mode ?? 'default';
  if (!RUN_COMMAND.test(prompt) || AUTO_MODES.has(mode)) process.exit(0);

  const command = prompt.match(RUN_COMMAND)[1];
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        systemMessage:
          `sdlc: heads up — auto mode is off (permission mode: ${mode}), ` +
          `so this ${command} will pause and ask you to approve every file edit and command it makes. ` +
          `To let it run unattended, press Shift+Tab until the mode reads "auto" ` +
          `(or start Claude with --permission-mode auto). If auto mode isn't available ` +
          `on this account, accept-edits is the next best option.`,
      },
    })
  );
  process.exit(0);
});
