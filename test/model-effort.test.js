const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('./helpers');

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const AGENTS_DIR = path.join(ROOT, 'sdlc', 'agents');
const SKILL = read(path.join(ROOT, 'sdlc', 'internal', 'model-effort', 'SKILL.md'));

const TIERS = ['very-low', 'low', 'medium', 'high', 'extra-high'];
const MODELS = new Set(['haiku', 'sonnet', 'opus', 'fable']);
const EFFORTS = new Set(['low', 'medium', 'high', 'xhigh', 'max', 'inherit']);

const frontmatter = (file) => (read(file).match(/^---\n([\s\S]*?)\n---/) || [, ''])[1];
const field = (fm, k) => (fm.match(new RegExp(`^${k}:\\s*(\\S+)\\s*$`, 'm')) || [])[1];

// Rows of the markdown table under the "## <heading>" section, as [first cell, ...rest].
function table(heading) {
  const m = SKILL.match(new RegExp(`^## ${heading}\\s*$([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'm'));
  assert.ok(m, `section "${heading}" not found`);
  return m[1]
    .split('\n')
    .filter((l) => /^\|/.test(l) && !/^\|[\s-|]+\|$/.test(l))
    .slice(1) // header
    .map((l) => l.split('|').slice(1, -1).map((c) => c.replace(/[*`]/g, '').trim()));
}

const agents = fs
  .readdirSync(AGENTS_DIR)
  .filter((f) => f.endsWith('.md'))
  .map((f) => ({ name: f.replace(/\.md$/, ''), fm: frontmatter(path.join(AGENTS_DIR, f)) }));

describe('Models table', () => {
  const rows = Object.fromEntries(table('Models').map(([a, ...cells]) => [a, cells]));

  test('every agent file has a row, and every row (bar the retry pseudo-row) is an agent', () => {
    for (const { name } of agents) assert.ok(rows[name], `no Models row for agent "${name}"`);
    for (const k of Object.keys(rows)) if (k !== 'coder (retry)') assert.ok(agents.some((a) => a.name === k), `Models row "${k}" has no agent file`);
  });

  test('every row has one valid model per tier', () => {
    for (const [a, cells] of Object.entries(rows)) {
      assert.strictEqual(cells.length, TIERS.length, `${a}: expected ${TIERS.length} tier cells`);
      for (const c of cells) assert.ok(MODELS.has(c), `${a}: "${c}" is not a known model`);
    }
  });

  test('the High column equals each agent file\'s frontmatter model', () => {
    for (const { name, fm } of agents) assert.strictEqual(rows[name][3], field(fm, 'model'), `${name}: High cell drifted from frontmatter`);
  });

  test('coder (retry) is never weaker than coder\'s first attempt', () => {
    const rank = { haiku: 0, sonnet: 1, opus: 2, fable: 3 };
    TIERS.forEach((_, i) => assert.ok(rank[rows['coder (retry)'][i]] >= rank[rows.coder[i]], `tier #${i}: retry model below first attempt`));
    assert.strictEqual(rows['coder (retry)'][3], rows.coder[3], 'High must not escalate on retry');
  });

  test('validator and publisher never move', () => {
    for (const a of ['validator', 'publisher']) assert.ok(rows[a].every((c) => c === 'haiku'), `${a} moved`);
  });
});

describe('Thinking effort table', () => {
  const rows = table('Thinking effort');
  const names = rows.flatMap(([a]) => a.split(',').map((s) => s.trim()));

  test('every agent is covered by a row', () => {
    for (const { name } of agents) assert.ok(names.includes(name) || name === 'coder', `no thinking-effort row covers "${name}"`);
    assert.ok(names.includes('coder') && names.includes('coder (retry)'));
  });

  test('every cell is a valid effort level or inherit', () => {
    for (const [a, ...cells] of rows) {
      assert.strictEqual(cells.length, TIERS.length, `${a}: wrong cell count`);
      for (const c of cells) assert.ok(EFFORTS.has(c), `${a}: "${c}" is not a valid effort`);
    }
  });

  test('High is inherit everywhere except the always-low mechanical agents (so High is unchanged)', () => {
    for (const [a, ...cells] of rows) {
      const mechanical = /validator/.test(a);
      assert.strictEqual(cells[3], mechanical ? 'low' : 'inherit', `${a}: High cell`);
    }
  });

  test('validator and publisher frontmatter agree with the table and forbid advisor use', () => {
    for (const name of ['validator', 'publisher']) {
      const a = agents.find((x) => x.name === name);
      assert.strictEqual(field(a.fm, 'effort'), 'low', `${name}: frontmatter effort`);
      assert.match(read(path.join(AGENTS_DIR, `${name}.md`)), /Do not consult the advisor/);
    }
  });
});

// The Codex and Antigravity ports tier the same agents with their own vocabularies; they must
// stay in step with the Claude table (a row per agent, a retry row, no weaker retry, High flat).
function portTable(file, heading = 'The table') {
  const src = read(path.join(ROOT, 'sdlc', 'internal', file));
  const m = src.match(new RegExp(`^## ${heading}\\s*$([\\s\\S]*?)(?=^## |^\\*\\*The retry ladder|$(?![\\s\\S]))`, 'm'));
  assert.ok(m, `${file}: section "${heading}" not found`);
  const rows = m[1]
    .split('\n')
    .filter((l) => /^\|/.test(l) && !/^\|[\s-|]+\|$/.test(l))
    .slice(1)
    .map((l) => l.split('|').slice(1, -1).map((c) => c.replace(/`/g, '').trim()));
  return Object.fromEntries(rows.map(([a, ...cells]) => [a, cells]));
}
// Port tables list High first, then Very Low … Extra High; reorder to the Claude table's order.
const inTierOrder = (cells) => [cells[1], cells[2], cells[3], cells[0], cells[4]];

describe('Codex model-effort table', () => {
  const rows = portTable('codex-model-effort.md');
  const SLOT = { economy: 0, balanced: 1, workhorse: 2, flagship: 3 };
  const REASON = { low: 0, medium: 1, high: 2, xhigh: 3 };
  const parse = (c) => {
    const [slot, reasoning] = c.split('/').map((s) => s.trim());
    assert.ok(slot in SLOT && reasoning in REASON, `bad Codex cell "${c}"`);
    return { slot: SLOT[slot], reasoning: REASON[reasoning] };
  };

  test('every agent has a row, plus the retry row', () => {
    for (const { name } of agents) assert.ok(rows[name], `no Codex row for "${name}"`);
    assert.ok(rows['coder (retry)']);
  });

  test('retry is never weaker than the first attempt, and High does not escalate', () => {
    const first = inTierOrder(rows.coder).map(parse);
    const retry = inTierOrder(rows['coder (retry)']).map(parse);
    retry.forEach((r, i) => assert.ok(r.slot >= first[i].slot && r.reasoning >= first[i].reasoning, `tier #${i}: retry weaker`));
    assert.deepStrictEqual(retry[3], first[3]);
  });

  test('adjacent tiers change at most one axis (model slot or reasoning), per the file\'s own rule', () => {
    for (const [name, cells] of Object.entries(rows)) {
      const t = inTierOrder(cells).map(parse);
      for (let i = 1; i < t.length; i++) {
        const axes = Number(t[i].slot !== t[i - 1].slot) + Number(t[i].reasoning !== t[i - 1].reasoning);
        assert.ok(axes <= 1, `${name}: tier #${i - 1}→#${i} changes both model slot and reasoning`);
      }
    }
  });
});

describe('Antigravity model-effort table', () => {
  const rows = portTable('gemini-model-effort/SKILL.md');
  const RANK = { flash_lite: 0, flash: 1, pro: 2 };

  test('every agent has a row, plus the retry row, with valid models', () => {
    for (const { name } of agents) assert.ok(rows[name], `no Antigravity row for "${name}"`);
    assert.ok(rows['coder (retry)']);
    for (const [a, cells] of Object.entries(rows)) for (const c of cells) assert.ok(c in RANK, `${a}: "${c}" is not a known model`);
  });

  test('retry is never weaker than the first attempt, and High does not escalate', () => {
    const first = inTierOrder(rows.coder);
    const retry = inTierOrder(rows['coder (retry)']);
    retry.forEach((r, i) => assert.ok(RANK[r] >= RANK[first[i]], `tier #${i}: retry weaker`));
    assert.strictEqual(retry[3], first[3]);
  });

  test('the Medium swap matches the Claude table: designer up, coder starts cheaper', () => {
    assert.strictEqual(rows.designer[3], 'pro');
    assert.strictEqual(rows.coder[3], 'flash');
    assert.strictEqual(rows['coder (retry)'][3], 'pro');
  });
});
