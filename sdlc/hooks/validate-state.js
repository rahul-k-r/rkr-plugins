#!/usr/bin/env node
// PostToolUse hook: validate a story-state.json right after it's written or
// edited, so a corrupted audit trail is caught at the moment of corruption.
// Exit 2 feeds stderr back to the agent as feedback (the write already
// happened; the agent must repair it).
const fs = require('fs');
const path = require('path');
const { PHASES } = require('./phases');

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

  // Budgets are enforced here, not just described: a used counter past its max
  // means a cycle ran without the developer's recorded authorization (which
  // raises the max). See design-run.md "Revision budgets".
  const b = s.budgets;
  if (b && typeof b === 'object') {
    for (const k of ['frame_revisions', 'design_revisions', 'plan_revisions', 'replans']) {
      const used = b[`${k}_used`];
      const max = b[`max_${k}`];
      if (typeof used === 'number' && typeof max === 'number' && used > max) {
        fail(`budgets.${k}_used (${used}) exceeds max_${k} (${max}) — a further cycle needs the developer's decision recorded in escalations[] and max_${k} raised`);
      }
    }
    if (typeof b.max_retries_per_batch === 'number' && b.retries_used && typeof b.retries_used === 'object') {
      for (const [batch, n] of Object.entries(b.retries_used)) {
        if (typeof n === 'number' && n > b.max_retries_per_batch) {
          fail(`budgets.retries_used[${batch}] (${n}) exceeds max_retries_per_batch (${b.max_retries_per_batch})`);
        }
      }
    }
  }

  process.exit(0);
});
