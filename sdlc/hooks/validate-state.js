#!/usr/bin/env node
// PostToolUse hook: validate a story-state.json right after it's written or
// edited, so a corrupted audit trail is caught at the moment of corruption.
// Exit 2 feeds stderr back to the agent as feedback (the write already
// happened; the agent must repair it).
const fs = require('fs');
const path = require('path');

const PHASES = new Set([
  'DESIGN', 'INTAKE', 'PLAN', 'IMPLEMENT',
  'FINAL_REVIEW', 'READY_FOR_PR', 'PR_OPENED',
  'AUTO_REVIEW', 'AUTO_FIX', 'AWAITING_CI', 'MERGED', 'CLOSED', // --bypass tail (story-run.md)
  'PUBLISHED', // standalone design-run's terminal phase (design-run.md)
  'PAUSED',
]);

let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => {
  let filePath = '';
  try {
    const payload = JSON.parse(input);
    filePath = (payload.tool_input && payload.tool_input.file_path) || '';
  } catch {
    process.exit(0);
  }

  const norm = filePath.replace(/\\/g, '/');
  if (!/\/docs\/stories\/[^/]+\/story-state\.json$/.test(norm)) process.exit(0);
  if (!fs.existsSync(filePath)) process.exit(0);

  const fail = (msg) => {
    console.error(
      `sdlc state validation: ${path.basename(path.dirname(filePath))}/story-state.json ` +
        `is invalid after this write — ${msg}. Repair it now; a broken state file corrupts ` +
        `the audit trail and breaks --resume and the push gate.`
    );
    process.exit(2);
  };

  let s;
  try {
    s = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    fail(`not parseable JSON (${e.message})`);
  }
  if (!s || typeof s !== 'object') fail('root is not an object');
  if (!s.story_key) fail('missing story_key');
  if (!PHASES.has(s.phase)) fail(`illegal phase "${s.phase}" (expected one of: ${[...PHASES].join(', ')})`);
  if (!s.branch) fail('missing branch');

  process.exit(0);
});
