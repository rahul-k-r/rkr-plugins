#!/usr/bin/env node
// SessionStart hook: announce in-flight story-run stories so paused work
// isn't forgotten. Prints to stdout (added to session context); silent when
// there's nothing to report.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { PHASES, DONE } = require('./phases');

let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => {
  let cwd = process.cwd();
  try {
    const payload = JSON.parse(input);
    cwd = payload.cwd || cwd;
  } catch {
    /* fall through with process cwd */
  }

  let root;
  try {
    root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    process.exit(0);
  }

  const storiesDir = path.join(root, 'docs', 'stories');
  const lines = [];
  try {
    for (const key of fs.readdirSync(storiesDir)) {
      const p = path.join(storiesDir, key, 'story-state.json');
      if (!fs.existsSync(p)) continue;
      let s;
      try {
        s = JSON.parse(fs.readFileSync(p, 'utf8'));
      } catch {
        lines.push(`- ${key}: story-state.json is UNPARSEABLE — the audit trail is corrupted; inspect it before resuming.`);
        continue;
      }
      if (!s || !s.phase) continue;
      if (!PHASES.has(s.phase)) {
        // Only a write that bypassed validate-state.js (a Bash-side write) gets here.
        lines.push(
          `- ${s.story_key || key}: phase "${s.phase}" is not a legal phase — the state file is corrupt; ` +
            `set it to the real terminal phase (CLOSED / PR_OPENED / PUBLISHED) or the phase to resume from before trusting it.`
        );
        continue;
      }
      if (DONE.has(s.phase)) continue;
      if (s.phase === 'PAUSED') {
        const q = (s.escalations || []).filter((e) => e && !e.decision).pop();
        lines.push(
          `- ${s.story_key}: PAUSED on an escalation${q ? ` ("${q.question}")` : ''} — ` +
            `run /sdlc:story-run ${s.story_key} --resume to answer and continue.`
        );
      } else {
        lines.push(
          `- ${s.story_key}: in flight (phase ${s.phase}, branch ${s.branch}) — ` +
            `resume with /sdlc:story-run ${s.story_key} --resume.`
        );
      }
    }
  } catch {
    process.exit(0); // no docs/stories in this repo
  }

  if (lines.length) {
    console.log(`sdlc: story-run state found in this repo:\n${lines.join('\n')}`);
  }
  process.exit(0);
});
