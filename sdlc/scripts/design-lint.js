#!/usr/bin/env node
// Deterministic pre-architect lint for a design note. Catches the mechanical
// defect class (missing/hollow sections, unresolved ADR refs, dangling §
// cross-refs, unmapped AC) before an opus review round is spent on it.
// Repo-specific checks (schema limits, naming) deliberately stay out.
//
//   node design-lint.js <note.md> [--root <repo-root>] [--ac-file <file>]
//
// --root     repo root used to resolve docs/adr and docs/design-notes (default: cwd)
// --ac-file  one acceptance criterion per line, each starting with its label
//            (e.g. "AC1: ..."); every label must be addressed in the note
// Prints a JSON report; exits 0 when there are no errors, 1 otherwise.
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const notePath = args.find((a, i) => !a.startsWith('--') && (i === 0 || !args[i - 1].startsWith('--')));
const root = path.resolve(flag('--root') || process.cwd());
const acFile = flag('--ac-file');

const errors = [];
const warnings = [];
const err = (check, message, line = null) => errors.push({ check, message, line });
const warn = (check, message, line = null) => warnings.push({ check, message, line });
const finish = () => {
  console.log(JSON.stringify({ ok: errors.length === 0, errors, warnings }, null, 2));
  process.exit(errors.length ? 1 : 0);
};

if (!notePath || !fs.existsSync(notePath)) {
  err('input', `design note not found: ${notePath || '(no path given)'}`);
  finish();
}

const text = fs.readFileSync(notePath, 'utf8').replace(/\r\n/g, '\n');
const lines = text.split('\n');
const lineOf = (re) => {
  const i = lines.findIndex((l) => re.test(l));
  return i >= 0 ? i + 1 : null;
};

// Blank out HTML comments (the template's guidance text) and fenced code, keeping
// line structure so reported line numbers stay true.
const strip = (s) =>
  s
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/[^\n]/g, ' '));
const body = strip(text);
const bodyLines = body.split('\n');

// --- 1. sections §1–§7 present; §1, §3, §5 substantive ----------------------
const sectionStart = {};
bodyLines.forEach((l, i) => {
  const m = l.match(/^##\s+§?\s*(\d)(?:[.:]|\s|$)/); // "## 1.", "## §1 Scope", "## 1 Scope"
  if (m && !(m[1] in sectionStart)) sectionStart[m[1]] = i;
});
for (let n = 1; n <= 7; n++) {
  // §6/§7 are filled during review/implementation, so their absence is not a design defect.
  if (!(n in sectionStart)) (n <= 5 ? err : warn)('sections', `missing section "## ${n}."`);
}
const sectionText = (n) => {
  if (!(n in sectionStart)) return '';
  const rest = bodyLines.slice(sectionStart[n] + 1);
  const end = rest.findIndex((l) => /^##\s+§?\s*\d(?:[.:]|\s|$)/.test(l));
  return (end >= 0 ? rest.slice(0, end) : rest).join('\n');
};
const substance = (s) =>
  s
    .replace(/\*\*[^*\n]*:\*\*/g, '') // template labels like **What it is:**
    .replace(/^[\s|\-#>*_`]+$/gm, '') // separators, bare markers
    .replace(/\s+/g, ' ')
    .trim();
for (const n of [1, 3, 5]) {
  if (n in sectionStart && substance(sectionText(n)).length < 40) {
    err('hollow-section', `§${n} is empty or only template placeholders`, sectionStart[n] + 1);
  }
}

// --- 2. §3 has at least one issue -------------------------------------------
// Issues are headed "### 3.N", or — in notes that name them by id — "### D1" / "### I2".
const issues = [...body.matchAll(/^###\s+§?3\.(\d+)/gm)].map((m) => Number(m[1]));
const namedIssues = [...body.matchAll(/^###\s+[DI]\d+\b/gm)].length;
if ('3' in sectionStart && issues.length === 0 && namedIssues === 0) err('issues', '§3 has no "### 3.N" (or "### D1") design issue');

// --- 3. dangling § cross-references -----------------------------------------
const ownKey = (path.basename(notePath, '.md').match(/^[A-Za-z0-9]+-\d+$/) || ['(none)'])[0];
// A § reference qualified by another document (a story key, an ADR, a *.md file) in
// the preceding text of its line or the line before points at that document, not
// at this note — never check those.
const FOREIGN = /\b[A-Z][A-Z0-9]*-\d+\b|\.(?:md|py|tsx?|jsx?|go|json|ya?ml|sql)\b/;
bodyLines.forEach((l, i) => {
  for (const m of l.matchAll(/§\s?(\d)(?:\.(\d+))?/g)) {
    const [, sec, sub] = m;
    const before = (bodyLines[i - 1] || '') + '\n' + l.slice(0, m.index);
    if (FOREIGN.test(before.replace(new RegExp(`\\b${ownKey}\\b`, 'g'), ''))) continue;
    if (Number(sec) < 1 || Number(sec) > 7) warn('dangling-ref', `reference to §${sec}, past this note's §7 (another document?)`, i + 1);
    else if (sub && sec === '3' && issues.length && !issues.includes(Number(sub))) err('dangling-ref', `reference to §3.${sub}, which has no "### 3.${sub}" heading`, i + 1);
  }
});

// --- 4. ADR references resolve ----------------------------------------------
const adrDir = path.join(root, 'docs', 'adr');
const adrFiles = fs.existsSync(adrDir) ? fs.readdirSync(adrDir) : [];
const adrNums = new Set(
  adrFiles.map((f) => (f.match(/^ADR-0*(\d+)/i) || [])[1]).filter(Boolean).map(Number)
);
const seenAdr = new Set();
// An ADR the note itself calls proposed/pending/new is being created by this story.
const PENDING_ADR = /\b(proposed|propose|scaffold(?:ed)?|pending|new ADR|to be (?:added|created|written)|will (?:add|create))\b/i;
bodyLines.forEach((l, i) => {
  for (const m of l.matchAll(/\bADR-0*(\d+)\b/gi)) {
    const n = Number(m[1]);
    if (seenAdr.has(n) || PENDING_ADR.test(l)) continue;
    seenAdr.add(n);
    if (!adrNums.has(n)) err('adr-ref', `ADR-${String(n).padStart(4, '0')} is referenced but docs/adr has no such file`, i + 1);
  }
});

// --- 5. referenced design notes exist (warning: the dependency may be unwritten)
const dep = (text.match(/^\|\s*Depends-on\s*\|\s*([^|\n]*)\|/m) || [])[1] || '';
for (const key of (dep.replace(/<!--[\s\S]*?-->/g, '').match(/[A-Za-z][A-Za-z0-9]*-\d+/g) || []).filter((k) => !/^ADR-/i.test(k))) {
  if (!fs.existsSync(path.join(root, 'docs', 'design-notes', `${key}.md`))) {
    warn('dependency-note', `Depends-on ${key} has no docs/design-notes/${key}.md`, lineOf(/Depends-on/));
  }
}

// --- 6. every acceptance criterion is addressed ------------------------------
if (acFile) {
  if (!fs.existsSync(acFile)) {
    err('input', `ac-file not found: ${acFile}`);
  } else {
    const labels = fs
      .readFileSync(acFile, 'utf8')
      .split(/\r?\n/)
      .map((l) => (l.match(/^\s*(?:[-*]\s*)?([A-Za-z]*\s?-?\d+)\s*[:.)]/) || [])[1])
      .filter(Boolean);
    const norm = (s) => s.replace(/[\s-]/g, '').toLowerCase();
    const haystack = norm(body);
    for (const label of labels) {
      if (!haystack.includes(norm(label))) err('ac-coverage', `acceptance criterion "${label}" is never referenced in the note`);
    }
  }
}

// --- 7. leftover placeholders (warnings) ------------------------------------
bodyLines.forEach((l, i) => {
  if (/\b(TODO|FIXME|XXX)\b/.test(l)) warn('placeholder', `unresolved marker: ${l.trim().slice(0, 80)}`, i + 1);
});
if (/Issue title: a concise statement/.test(text) && !/^###\s+3\.\d+/m.test(body)) {
  err('placeholder', 'the template\'s "3.N" issue heading is still a placeholder');
}

finish();
