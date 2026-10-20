#!/usr/bin/env node
// PostToolUse hook: after every write to a story-state.json, re-render
// docs/stories/<KEY>/handoff.md beside it — a self-contained brief a fresh chat
// can act on without replaying the run. Rendering is mechanical (no model
// tokens) and happens on every state persist, so the file is current even when
// the session dies, the cache expires, or the run stops at an escalation.
// Never blocks: any problem exits 0 silently (validate-state.js owns validity).
const fs = require('fs');
const path = require('path');
const { PHASES } = require('./phases');

const list = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);
const oneLine = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

// What a fresh chat should run for each phase — mirrors story-run.md's Resume semantics.
function nextAction(s, key, pendingDecisions) {
  const resume = `/sdlc:story-run ${key} --resume`;
  if (s.phase === 'CLOSED') return 'Nothing — the story is closed.';
  if (s.phase === 'PUBLISHED') return 'Nothing — the design run is published.';
  if (pendingDecisions) return `Answer the decision(s) above in the fresh chat, then run \`${resume}\` — it records each answer and continues.`;
  if (s.phase === 'READY_FOR_PR') {
    return s.write_mode === 'incognito' || s.incognito
      ? `Final review is clean; the run never pushes in incognito mode. Rework commits if you like, then \`/sdlc:story-pr\` (or push and \`gh pr create\` yourself).`
      : `Run \`${resume}\` — it goes straight to push + PR.`;
  }
  if (s.phase === 'PR_OPENED') {
    return s.bypass
      ? `The PR is open but the --bypass tail hasn't finished: run \`${resume}\` to continue auto-review → CI → merge → close.`
      : 'Review the PR (yourself or `/sdlc:review-run`), starting with the review notes below; then merge and `/sdlc:close-story`.';
  }
  return `Run \`${resume}\` — it continues from phase ${s.phase}.`;
}

function render(s, key, dir) {
  const escalations = list(s.escalations).filter((e) => !e.decision);
  const cp = s.checkpoint || {};
  const openFindings = list(s.auto_review && s.auto_review.findings).filter((f) =>
    /^(BLOCKING|MAJOR)$/i.test(f.severity || '')
  );
  const openWork = list(s.discovered_work).filter((w) => !w.resolution);
  const batches = list(s.plan && s.plan.subtasks).filter((t) => t.status !== 'DONE');
  const notes = list(s.final_review && s.final_review.notes);
  const pendingDecisions = escalations.length > 0 || !!cp.pending_question;

  let status;
  if (pendingDecisions) status = 'NEEDS_DECISION';
  else if (s.phase === 'CLOSED' || s.phase === 'PUBLISHED') status = openWork.length ? 'NEEDS_ACTION' : 'DONE';
  else if (s.phase === 'PR_OPENED' && !s.bypass) status = openWork.length || openFindings.length ? 'NEEDS_ACTION' : 'AWAITING_REVIEW';
  else status = 'NEEDS_ACTION';

  const out = [];
  out.push(`# Handoff — ${key}`);
  out.push('');
  out.push(`**Status:** ${status} · **Phase:** ${s.phase} · **Generated:** ${new Date().toISOString()}`);
  out.push('');
  out.push(
    '_Auto-generated from `story-state.json` on every state write — do not edit. A fresh chat can act on this file alone; read the pointers at the bottom only if needed._'
  );
  out.push('');

  out.push('## Where it stands');
  const where = [
    s.branch && `- Branch: \`${s.branch}\`` + (s.base_branch ? ` → \`${s.base_branch}\`` : ''),
    s.worktree && `- Worktree: \`${s.worktree}\``,
    s.pr && s.pr.url && `- PR: ${s.pr.url}`,
    `- Mode: ${s.write_mode || 'normal'}${s.bypass ? ', --bypass' : ''}${s.turbo ? ', --turbo' : ''}`,
    s.handoff && s.handoff.stop_reason && `- Stopped because: ${oneLine(s.handoff.stop_reason)}`,
    cp.phase_substep && `- Sub-step: ${oneLine(cp.phase_substep)}`,
  ].filter(Boolean);
  out.push(...where, '');

  out.push('## Next action');
  out.push(nextAction(s, key, pendingDecisions), '');

  if (pendingDecisions) {
    out.push('## Decisions needed');
    for (const e of escalations) {
      out.push(`- **${oneLine(e.question)}** (${e.phase || s.phase}${e.batch ? `, batch ${e.batch}` : ''})`);
      for (const o of list(e.options)) out.push(`  - option: ${oneLine(o)}`);
      if (e.recommendation) out.push(`  - recommendation: ${oneLine(e.recommendation)}`);
    }
    if (cp.pending_question && !escalations.some((e) => oneLine(e.question) === oneLine(cp.pending_question))) {
      out.push(`- **${oneLine(cp.pending_question)}** (from checkpoint)`);
    }
    out.push('');
  }

  const pending = [];
  for (const t of batches) pending.push(`- Subtask ${t.id}${t.batch ? ` (batch ${t.batch})` : ''} ${t.status || 'PENDING'}: ${oneLine(t.title)}`);
  for (const f of openFindings)
    pending.push(`- Open ${f.severity} review finding: ${oneLine(f.title || f.summary || f.description || f.finding)}${f.file ? ` (${f.file}${f.line ? `:${f.line}` : ''})` : ''}`);
  for (const w of openWork)
    pending.push(`- Discovered work, undecided: ${oneLine(w.description)} — evidence ${oneLine(w.evidence)}; recommended: ${oneLine(w.recommendation)}`);
  if (pending.length) out.push('## Pending work', ...pending, '');

  if (notes.length) {
    out.push('## Review notes (look at these first)');
    for (const n of notes) out.push(`- [${n.kind || 'NOTE'}] ${oneLine(n.note)}${n.ref ? ` — ${oneLine(n.ref)}` : ''}`);
    out.push('');
  }

  const extra = list(s.handoff && s.handoff.notes);
  if (extra.length) out.push('## Other notes', ...extra.map((n) => `- ${oneLine(n)}`), '');

  const b = s.budgets || {};
  const retries = Object.entries(b.retries_used || {}).filter(([, n]) => n > 0).map(([k, n]) => `batch ${k}: ${n}/${b.max_retries_per_batch}`);
  out.push('## Budgets used');
  out.push(
    `- replans ${b.replans_used ?? 0}/${b.max_replans ?? '?'} · plan revisions ${b.plan_revisions_used ?? 0}/${b.max_plan_revisions ?? '?'} · design revisions ${b.design_revisions_used ?? 0}/${b.max_design_revisions ?? '?'}` +
      (retries.length ? ` · retries ${retries.join(', ')}` : '') +
      (s.auto_review && s.auto_review.fix_attempts ? ` · auto-fix attempts ${s.auto_review.fix_attempts}/2` : '')
  );
  out.push('');

  out.push('## Pointers (read only if needed)');
  const rel = (f) => `docs/stories/${key}/${f}`;
  const exists = (f) => fs.existsSync(path.join(dir, f));
  for (const f of ['checkpoint.md', 'context-pack.md', 'plan-summary.md', 'provenance.md'])
    if (exists(f)) out.push(`- \`${rel(f)}\``);
  if (s.design && s.design.note_path) out.push(`- Design note: \`${s.design.note_path}\``);
  out.push(`- State: \`${rel('story-state.json')}\``);
  out.push('');
  return out.join('\n');
}

let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => {
  try {
    const payload = JSON.parse(input);
    const filePath = (payload.tool_input && payload.tool_input.file_path) || '';
    const norm = filePath.replace(/\\/g, '/');
    const m = norm.match(/\/docs\/stories\/([^/]+)\/story-state\.json$/);
    if (!m || !fs.existsSync(filePath)) process.exit(0);
    const s = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!s || typeof s !== 'object' || !PHASES.has(s.phase)) process.exit(0);
    const dir = path.dirname(filePath);
    fs.writeFileSync(path.join(dir, 'handoff.md'), render(s, s.story_key || m[1], dir));
  } catch {
    /* never block a write over a handoff render */
  }
  process.exit(0);
});
