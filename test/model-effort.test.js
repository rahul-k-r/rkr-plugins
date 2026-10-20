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
