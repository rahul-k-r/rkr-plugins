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
const SEP_ROW = /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/; // |---|---| (needs at least one dash)
const substance = (s) => {
  const ls = s.split('\n');
  // Drop table separator rows and the header row above each: a table that is only
  // column titles carries no content.
  const keep = ls.map((l, i) => !(SEP_ROW.test(l) && /\|/.test(l)) && !(/^\s*\|/.test(l) && SEP_ROW.test(ls[i + 1] || '') && /\|/.test(ls[i + 1] || '')));
  return ls
    .filter((_, i) => keep[i])
    .join('\n')
    .replace(/\*\*[^*\n]*:\*\*/g, '') // template labels like **What it is:**
    .replace(/^[\s|\-#>*_`]+$/gm, '') // bare markers
    .replace(/\s+/g, ' ')
    .trim();
};
for (const n of [1, 3, 5]) {
  if (!(n in sectionStart)) continue;
  const text = substance(sectionText(n));
  // §5 may be explicitly empty ("None." / "N/A"); the others may not.
  const explicitlyEmpty = n === 5 && /^(none|n\/?a|not applicable)\b/i.test(text);
  if (!explicitlyEmpty && text.length < 40) {
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
// The window is deliberately local (60 chars before the §, plus the tail of the previous
// line) — a story key or file name elsewhere on the line says nothing about this ref.
// Technical tokens shaped like keys (UTF-8, SHA-256, …) are not documents.
const FOREIGN = /\b(?!(?:UTF|SHA|ISO|RFC|TLS|AES|MD|HTTP|IPV|X)-)[A-Z][A-Z0-9]*-\d+\b|\.(?:md|py|tsx?|jsx?|go|json|ya?ml|sql)\b/;
bodyLines.forEach((l, i) => {
  for (const m of l.matchAll(/§\s?(\d+)(?:\.(\d+))?/g)) {
    const [, sec, sub] = m;
    const before = (bodyLines[i - 1] || '').slice(-60) + '\n' + l.slice(Math.max(0, m.index - 60), m.index);
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
// No "proposed" exemption: a threshold ADR the note introduces is scaffolded on disk
// (Status: Proposed) by the designer, so it resolves like any other.
bodyLines.forEach((l, i) => {
  for (const m of l.matchAll(/\bADR-0*(\d+)\b/gi)) {
    const n = Number(m[1]);
    if (seenAdr.has(n)) continue;
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
      // Only labels with a letter prefix (AC1, US-3) identify anything; a bare "1." matches any digit.
      .map((l) => (l.match(/^\s*(?:[-*]\s*)?([A-Za-z]+)\s?-?\s?(\d+)\s*[:.)]/) || []).slice(1, 3))
      .filter((x) => x.length === 2);
    for (const [letters, digits] of labels) {
      const found = new RegExp(`\\b${letters}[\\s-]?${digits}(?!\\d)`, 'i').test(body);
      if (!found) err('ac-coverage', `acceptance criterion "${letters}${digits}" is never referenced in the note`);
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
