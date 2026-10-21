const { test, describe, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { ROOT } = require('./helpers');

const LINT = path.join(ROOT, 'sdlc', 'scripts', 'design-lint.js');
const dirs = [];
after(() => dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

const FILLER = 'This section carries real, specific content about the story under design for the test.';
const SECTION = (n, title, extra = '') => `## ${n}. ${title}\n\n${FILLER}\n${extra}\n\n`;

function note({ s1 = FILLER, s3 = '### 3.1 — Pick a store\n' + FILLER, s5 = FILLER, skip = [], tail = '', deps = '' } = {}) {
  let t = `# Design Note\n\n| Field | Value |\n|---|---|\n| Depends-on | ${deps} |\n\n---\n\n`;
  const body = { 1: s1, 2: FILLER, 3: s3, 4: FILLER, 5: s5, 6: FILLER, 7: FILLER };
  for (let n = 1; n <= 7; n++) if (!skip.includes(n)) t += `## ${n}. Section ${n}\n\n${body[n]}\n\n`;
  return t + tail;
}

function lint(content, { adrs = [], notes = [], ac = null } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-lint-'));
  dirs.push(root);
  fs.mkdirSync(path.join(root, 'docs', 'adr'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs', 'design-notes'), { recursive: true });
  for (const n of adrs) fs.writeFileSync(path.join(root, 'docs', 'adr', `ADR-${String(n).padStart(4, '0')}-x.md`), '');
  for (const k of notes) fs.writeFileSync(path.join(root, 'docs', 'design-notes', `${k}.md`), '');
  const file = path.join(root, 'docs', 'design-notes', 'ABC-1.md');
  fs.writeFileSync(file, content);
  const args = [LINT, file, '--root', root];
  if (ac) {
    const acf = path.join(root, 'ac.txt');
    fs.writeFileSync(acf, ac);
    args.push('--ac-file', acf);
  }
  const r = spawnSync(process.execPath, args, { encoding: 'utf8' });
  return { status: r.status, ...JSON.parse(r.stdout) };
}
const checks = (r, kind = 'errors') => r[kind].map((e) => e.check);

describe('structure', () => {
  test('a complete note passes', () => {
    const r = lint(note());
    assert.strictEqual(r.status, 0, JSON.stringify(r.errors));
    assert.strictEqual(r.ok, true);
  });

  test('a missing core section is an error', () => {
    const r = lint(note({ skip: [4] }));
    assert.strictEqual(r.status, 1);
    assert.deepStrictEqual(checks(r), ['sections']);
  });

  test('hollow §1/§3/§5 (template labels and comments only) are errors', () => {
    const hollow = '<!-- guidance -->\n**What it is:**\n\n**What it is NOT:**\n';
    const r = lint(note({ s1: hollow, s5: hollow }));
    assert.deepStrictEqual(checks(r).sort(), ['hollow-section', 'hollow-section']);
  });

  test('§3 without any "### 3.N" issue is an error', () => {
    assert.ok(checks(lint(note({ s3: FILLER }))).includes('issues'));
  });
});

describe('real-world note shapes', () => {
  test('"## §N Title" headings count as sections', () => {
    const t = note().replace(/^## (\d)\. /gm, '## §$1 ');
    assert.strictEqual(lint(t).status, 0);
  });

  test('section refs qualified by another story or a .md file are not checked against this note', () => {
    const r = lint(note({ tail: 'ID-216 already solved it (§3.8, keepalive).\nSee developer-brief.md §8.\n(ID-217\n§3.10 covers the PATCH)\n' }));
    assert.strictEqual(r.status, 0, JSON.stringify(r.errors));
  });

  test('issues headed "### D1 —" / "### I2" count as §3 issues, and then §3.N refs are not checked', () => {
    const r = lint(note({ s3: '### D1 — Pick a store\n' + FILLER + '\n### D2 — Retry\n' + FILLER, tail: 'Per §3.9 and §3.14R.\n' }));
    assert.strictEqual(r.status, 0, JSON.stringify(r.errors));
  });

  test('a "3.14R"-style heading satisfies a §3.14 reference', () => {
    const r = lint(note({ s3: '### 3.1 — A\n' + FILLER + '\n### 3.14R — Ruling\n' + FILLER, tail: 'See §3.14.\n' }));
    assert.strictEqual(r.status, 0, JSON.stringify(r.errors));
  });

  test('a reference qualified by a source file is not checked against this note', () => {
    assert.strictEqual(lint(note({ tail: 'test_errors.py:14 pins a transcribed §3.9 table.\n' })).status, 0);
  });

  test('missing §6/§7 is a warning (§7 is empty at design time); missing §1–§5 stays an error', () => {
    const late = lint(note({ skip: [6, 7] }));
    assert.strictEqual(late.status, 0);
    assert.deepStrictEqual(checks(late, 'warnings'), ['sections', 'sections']);
    assert.deepStrictEqual(checks(lint(note({ skip: [2] }))), ['sections']);
  });

  test('§5 may be explicitly "None"/"N/A"; a §5 that is only table headers is hollow', () => {
    assert.strictEqual(lint(note({ s5: 'None.' })).status, 0);
    assert.strictEqual(lint(note({ s5: 'N/A — no obligations.' })).status, 0);
    const headersOnly = '| Obligation | Owner | Ticket | Status | Notes on how this lands |\n|---|---|---|---|---|\n';
    assert.deepStrictEqual(checks(lint(note({ s5: headersOnly }))), ['hollow-section']);
  });

  test('the foreign-context window is local: a distant ID does not excuse a bad reference', () => {
    const far = 'ADR-0052 sets the rule. ' + 'x'.repeat(90) + ' See §3.7.\n';
    assert.deepStrictEqual(checks(lint(note({ tail: far }), { adrs: [52] })), ['dangling-ref']);
    assert.strictEqual(lint(note({ tail: 'Per ADR-0052 §3.7 the rule holds.\n' }), { adrs: [52] }).status, 0);
  });

  test('tokens like UTF-8 and SHA-256 are not mistaken for another document', () => {
    assert.deepStrictEqual(checks(lint(note({ tail: 'Encoded as UTF-8, see §3.7.\n' }))), ['dangling-ref']);
  });

  test('two-digit section numbers are read whole (§10 is past §7, not §1)', () => {
    const r = lint(note({ tail: 'See §10.\n' }));
    assert.strictEqual(r.status, 0);
    assert.deepStrictEqual(checks(r, 'warnings'), ['dangling-ref']);
  });

  test('a section past §7 on an unqualified line is a warning, not an error', () => {
    const r = lint(note({ tail: 'See §9.\n' }));
    assert.strictEqual(r.status, 0);
    assert.deepStrictEqual(checks(r, 'warnings'), ['dangling-ref']);
  });

  test('calling an ADR "proposed" does not exempt it: the scaffold must exist on disk', () => {
    const text = note({ tail: 'Adds ADR-0071 (proposed, scaffolded below).\nPer ADR-0099 (Accepted), the proposed TTL applies.\n' });
    const r = lint(text);
    assert.deepStrictEqual(checks(r), ['adr-ref', 'adr-ref']);
    assert.strictEqual(lint(text, { adrs: [71, 99] }).status, 0);
  });

  test('ADR ids in Depends-on are not treated as story keys', () => {
    assert.strictEqual(lint(note({ deps: 'ADR-0038, ID-9' }), { adrs: [38], notes: ['ID-9'] }).warnings.length, 0);
  });
});

describe('cross-references', () => {
  test('a reference to a §3 issue that does not exist is flagged', () => {
    const r = lint(note({ tail: 'See §3.4 for the retry rule.\n' }));
    assert.deepStrictEqual(checks(r), ['dangling-ref']);
  });

  test('a reference to an existing issue or section is fine', () => {
    assert.strictEqual(lint(note({ tail: 'See §3.1 and §5.\n' })).status, 0);
  });


  test('references inside fenced code and HTML comments are ignored', () => {
    assert.strictEqual(lint(note({ tail: '```\n§3.9 ADR-0099\n```\n<!-- §3.8 ADR-0098 -->\n' })).status, 0);
  });
});

describe('ADRs and dependencies', () => {
  test('an unresolved ADR reference is an error; a resolved one (any padding) is fine', () => {
    const r = lint(note({ tail: 'Per ADR-0052 and ADR-7.\n' }), { adrs: [7] });
    assert.deepStrictEqual(checks(r), ['adr-ref']);
    assert.match(r.errors[0].message, /ADR-0052/);
  });

  test('each unresolved ADR is reported once', () => {
    const r = lint(note({ tail: 'ADR-0052. Again ADR-0052.\n' }));
    assert.strictEqual(r.errors.filter((e) => e.check === 'adr-ref').length, 1);
  });

  test('a Depends-on story with no design note is a warning, not an error', () => {
    const r = lint(note({ deps: 'XYZ-9' }));
    assert.strictEqual(r.status, 0);
    assert.deepStrictEqual(checks(r, 'warnings'), ['dependency-note']);
    assert.strictEqual(lint(note({ deps: 'XYZ-9' }), { notes: ['XYZ-9'] }).warnings.length, 0);
  });
});

describe('acceptance-criteria coverage', () => {
  const AC = 'AC1: first thing\nAC2: second thing\n- AC3. third\n';

  test('every labelled criterion must be addressed', () => {
    const r = lint(note({ tail: 'AC1 and AC3 are handled in §3.1.\n' }), { ac: AC });
    assert.deepStrictEqual(checks(r), ['ac-coverage']);
    assert.match(r.errors[0].message, /AC2/);
  });

  test('label matching ignores spacing and case', () => {
    assert.strictEqual(lint(note({ tail: 'ac 1, AC-2, Ac3.\n' }), { ac: AC }).status, 0);
  });

  test('AC1 is not satisfied by AC10', () => {
    const r = lint(note({ tail: 'Covers AC10 and AC2 and AC3.\n' }), { ac: AC });
    assert.deepStrictEqual(checks(r), ['ac-coverage']);
    assert.match(r.errors[0].message, /AC1\b/);
  });

  test('bare-number labels carry no information and are not checked', () => {
    assert.strictEqual(lint(note(), { ac: '1. first\n2. second\n' }).status, 0);
  });

  test('without --ac-file the check is skipped', () => {
    assert.strictEqual(lint(note()).status, 0);
  });
});

describe('placeholders and input', () => {
  test('TODO markers are warnings', () => {
    const r = lint(note({ tail: 'TODO: decide the cache TTL\n' }));
    assert.strictEqual(r.status, 0);
    assert.deepStrictEqual(checks(r, 'warnings'), ['placeholder']);
  });

  test('a missing note file is an error', () => {
    const r = spawnSync(process.execPath, [LINT, '/nope/missing.md'], { encoding: 'utf8' });
    assert.strictEqual(r.status, 1);
    assert.strictEqual(JSON.parse(r.stdout).errors[0].check, 'input');
  });

  test('error line numbers point at the offending line', () => {
    const r = lint(note({ tail: 'x\nSee §3.7.\n' }));
    const line = fs.readFileSync(path.join(dirs[dirs.length - 1], 'docs', 'design-notes', 'ABC-1.md'), 'utf8').split('\n').findIndex((l) => l.includes('§3.7')) + 1;
    assert.strictEqual(r.errors[0].line, line);
  });
});
