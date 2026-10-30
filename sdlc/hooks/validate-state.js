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

  // Lane sections: consecutive lane-tagged batches run concurrently in separate
  // worktrees (story-run "Lane sections"), so each lane's files must be disjoint
  // from every other lane in the same section — checked here, not just described.
  // Paths compare lower-cased and normalised (./, //, backslashes, leading /): a
  // case-insensitive filesystem makes Foo/ and foo/ the same directory. Only
  // * ? { are glob characters — [ ] are literal, because Next.js/SvelteKit
  // routes (app/[id]/page.tsx) use them.
  const normPath = (p) => path.posix.normalize(p.replace(/\\/g, '/').toLowerCase()).replace(/^(\.\/|\/)+/, '');
  const isGlob = (p) => /[*?{]/.test(p);
  // The directory a glob is anchored in: its literal prefix up to the last '/'.
  // Compared on directory boundaries, so backend/ and backend-tools/*.ts don't
  // collide; a leading wildcard anchors nowhere and overlaps everything.
  const fixedDir = (p) => {
    const i = p.search(/[*?{]/);
    const lit = i < 0 ? p : p.slice(0, i);
    return lit.slice(0, lit.lastIndexOf('/') + 1);
  };
  const dirPrefix = (d, f) => f === d || f.startsWith(d.endsWith('/') ? d : `${d}/`);
  const overlap = (a, b) => {
    a = normPath(a);
    b = normPath(b);
    const ga = isGlob(a);
    const gb = isGlob(b);
    if (ga && gb) {
      const [da, db] = [fixedDir(a), fixedDir(b)];
      return da.startsWith(db) || db.startsWith(da);
    }
    if (ga || gb) {
      const [g, f] = ga ? [a, b] : [b, a];
      const d = fixedDir(g);
      return f.startsWith(d) || d.startsWith(`${f.replace(/\/$/, '')}/`);
    }
    return dirPrefix(a, b) || dirPrefix(b, a);
  };

  const subtasks = Array.isArray(s.plan && s.plan.subtasks) ? s.plan.subtasks : [];
  const batchLane = new Map(); // String(batch) -> lane | null
  const laneFiles = new Map(); // String(batch) -> files of its subtasks
  for (const t of subtasks) {
    if (!t || typeof t !== 'object') fail('plan.subtasks contains a non-object entry');
    if (t.lane != null && typeof t.lane !== 'string') fail(`subtask ${t.id}: lane must be a string or null`);
    const lane = t.lane || null;
    if (t.batch == null) {
      if (lane) fail(`subtask ${t.id} is in lane "${lane}" but has no batch`);
      continue;
    }
    const batch = String(t.batch);
    if (lane && !/^\d+$/.test(batch)) fail(`subtask ${t.id}: a lane subtask needs an integer batch, got "${t.batch}"`);
    if (batchLane.has(batch) && batchLane.get(batch) !== lane) {
      fail(`batch ${batch} mixes lanes ("${batchLane.get(batch)}" and "${lane}") — a batch belongs to exactly one lane`);
    }
    batchLane.set(batch, lane);
    if (lane) {
      const ok = Array.isArray(t.files) && t.files.length > 0 && t.files.every((f) => typeof f === 'string' && f);
      if (!ok) fail(`subtask ${t.id} is in lane "${lane}" but lists no files — lanes can only run in parallel if their files are known to be disjoint`);
      laneFiles.set(batch, (laneFiles.get(batch) || []).concat(t.files));
    }
  }
  const checkSection = (section) => {
    const lanes = [...section.keys()];
    for (let i = 0; i < lanes.length; i++) {
      for (let j = i + 1; j < lanes.length; j++) {
        for (const a of section.get(lanes[i])) {
          for (const b of section.get(lanes[j])) {
            if (overlap(a, b)) fail(`lanes "${lanes[i]}" and "${lanes[j]}" overlap ("${a}" vs "${b}") — lanes in one section run concurrently and must touch disjoint files`);
          }
        }
      }
    }
  };
  let section = new Map();
  for (const batch of [...batchLane.keys()].sort((x, y) => x.localeCompare(y, undefined, { numeric: true }))) {
    const lane = batchLane.get(batch);
    if (!lane) {
      checkSection(section);
      section = new Map();
    } else {
      section.set(lane, (section.get(lane) || []).concat(laneFiles.get(batch) || []));
    }
  }
  checkSection(section);

  if (s.lanes && typeof s.lanes === 'object') {
    for (const [name, l] of Object.entries(s.lanes)) {
      const status = l && l.status;
      if (!['ACTIVE', 'MERGED', 'ABANDONED'].includes(status)) fail(`lanes.${name}.status "${status}" is not ACTIVE, MERGED or ABANDONED`);
      if (status === 'ACTIVE' && !(l.worktree && l.branch && l.fork_sha)) {
        fail(`lanes.${name} is ACTIVE but lacks worktree, branch or fork_sha — --resume needs all three to continue it`);
      }
    }
  }

  process.exit(0);
});
