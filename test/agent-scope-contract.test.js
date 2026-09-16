const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, HOOK, runHook } = require('./helpers');

const GUARD = HOOK('guard-agent-tools');

const AGENTS_DIR = path.join(ROOT, 'sdlc', 'agents');
// Sources are checked in with CRLF on Windows; normalise so the line-anchored
// patterns below behave the same on either checkout.
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const guardSrc = read(path.join(ROOT, 'sdlc', 'hooks', 'guard-agent-tools.js'));
const guardAgSrc = read(path.join(ROOT, 'sdlc', 'hooks-antigravity', 'guard-agent-tools.js'));

// The AGENT_SCOPE table is a literal in a stdin-driven script, so it is read from
// source rather than required.
function scopeKeys(src) {
  const m = src.match(/const AGENT_SCOPE = \{([\s\S]*?)\n\};/);
  assert.ok(m, 'could not locate AGENT_SCOPE');
  return [...m[1].matchAll(/^\s*(\w+)\s*:/gm)].map((x) => x[1]);
}

function frontmatter(file) {
  const m = read(file).match(/^---\n([\s\S]*?)\n---/);
  return m ? m[1] : '';
}

const GOVERNED = scopeKeys(guardSrc);

describe('AGENT_SCOPE matches the agents on disk', () => {
  test('it governs exactly the four tracker-touching agents', () => {
    assert.deepStrictEqual([...GOVERNED].sort(), ['intake', 'publisher', 'surveyor', 'verifier']);
  });

  test('every governed key names a real agent file', () => {
    for (const key of GOVERNED) {
      const file = path.join(AGENTS_DIR, `${key}.md`);
      assert.ok(fs.existsSync(file), `AGENT_SCOPE names "${key}" but ${key}.md does not exist`);
      assert.match(frontmatter(file), new RegExp(`^name:\\s*${key}\\s*$`, 'm'), `${key}.md name mismatch`);
    }
  });

  test('both hook variants govern the same agent set', () => {
    assert.deepStrictEqual([...GOVERNED].sort(), [...scopeKeys(guardAgSrc)].sort());
  });

  // The Antigravity port declares itself the "SAME per-agent tool-scoping policy"
  // as the Claude Code hook. Builtin names legitimately differ (different platform
  // tools), but the tracker OPERATION names are the same MCP servers either way —
  // drift there means one platform silently grants or denies what the other doesn't.
  const opsOf = (src, name) => {
    const m = src.match(new RegExp(String.raw`const ${name} = \[([\s\S]*?)\];`));
    assert.ok(m, `could not locate ${name}`);
    return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort();
  };

  test('tracker operation lists do not drift between variants', () => {
    assert.deepStrictEqual(opsOf(guardSrc, 'READ_OPS'), opsOf(guardAgSrc, 'READ_OPS'), 'READ_OPS drift');
    // the AG variant composes FULL_WRITE_OPS from COMMENT_OPS, so compare the union
    const agWrite = [...new Set([...opsOf(guardAgSrc, 'COMMENT_OPS'), ...opsOf(guardAgSrc, 'FULL_WRITE_OPS')])].sort();
    assert.deepStrictEqual(opsOf(guardSrc, 'FULL_WRITE_OPS'), agWrite, 'FULL_WRITE_OPS drift');
  });
});

describe('every agent is scoped by exactly one mechanism', () => {
  const allAgents = () =>
    fs
      .readdirSync(AGENTS_DIR)
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace(/\.md$/, ''));

  const toolsOf = (name) => {
    const line = frontmatter(path.join(AGENTS_DIR, `${name}.md`)).match(/^tools:\s*(.+)$/m);
    return line ? line[1].split(',').map((s) => s.trim()) : null; // null = full inheritance
  };

  // An agent with neither a tools: list nor an AGENT_SCOPE entry inherits every
  // tool with nothing restricting it — the exact hole this hook was built to close.
  test('no agent is left both unlisted and ungoverned', () => {
    for (const name of allAgents()) {
      const scoped = toolsOf(name) !== null || GOVERNED.includes(name);
      assert.ok(scoped, `${name} has no tools: frontmatter and no AGENT_SCOPE entry — it is unscoped`);
    }
  });

  test('the two mechanisms do not overlap', () => {
    for (const name of GOVERNED) {
      assert.strictEqual(toolsOf(name), null, `${name} is hook-governed, so it must not declare tools:`);
    }
  });

  // Write can replace a file wholesale, so withholding Edit from an agent that has
  // Write restricts nothing — it only denies it the idiomatic tool for an artifact
  // that already exists (a revise cycle, a --resume). Applies however it is scoped.
  test('every agent granted Write is also granted Edit', () => {
    for (const name of allAgents()) {
      const tools = toolsOf(name);
      if (tools === null) continue; // hook-governed; covered by the guard's own suite
      if (!tools.includes('Write')) continue;
      assert.ok(tools.includes('Edit'), `${name} has Write but not Edit`);
    }
  });
});

describe('the invariant the hook exists to enforce', () => {
  // The hook is the ONLY thing scoping these four. They deliberately carry no
  // `tools:` frontmatter so they can reach MCP servers whose names vary per
  // project — adding one would silently narrow them and make this hook moot.
  test('no governed agent declares a tools: allowlist', () => {
    for (const key of GOVERNED) {
      const fm = frontmatter(path.join(AGENTS_DIR, `${key}.md`));
      assert.doesNotMatch(fm, /^tools:/m, `${key}.md must not declare tools: — the hook is its only scope`);
    }
  });

  test('agents this hook does NOT govern do declare their own tools', () => {
    // Sanity check the contract runs both ways: ungoverned agents are scoped by
    // frontmatter, so at least one must carry a tools: line.
    const ungoverned = fs
      .readdirSync(AGENTS_DIR)
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace(/\.md$/, ''))
      .filter((n) => !GOVERNED.includes(n));
    assert.ok(ungoverned.length > 0, 'expected agents outside AGENT_SCOPE');
    const withTools = ungoverned.filter((n) => /^tools:/m.test(frontmatter(path.join(AGENTS_DIR, `${n}.md`))));
    assert.ok(withTools.length > 0, 'no ungoverned agent declares tools: — is the contract still true?');
  });
});

describe('every governed agent can return its result', () => {
  // The regression that motivated this suite: an agent finished its work and was
  // then denied on the handback call.
  //
  // The agent list is ENUMERATED from source (so an agent added to AGENT_SCOPE is
  // picked up automatically) but the allowance is asserted by SPAWNING the hook.
  // Asserting it by regex over the source would break the moment the table is
  // refactored to shared constants — which the Antigravity variant already does.
  test('AGENT_SCOPE enumeration is non-empty', () => {
    assert.ok(GOVERNED.length >= 4, `parsed only ${GOVERNED.length} agents — has the table shape changed?`);
  });

  for (const tool of ['SubagentHandback', 'ToolSearch']) {
    test(`every governed agent may call ${tool}`, () => {
      for (const agent of GOVERNED) {
        const r = runHook(GUARD, { agent_type: `sdlc:${agent}`, tool_name: tool });
        assert.strictEqual(r.status, 0, `${agent} was denied ${tool}: ${r.stderr}`);
      }
    });
  }
});
