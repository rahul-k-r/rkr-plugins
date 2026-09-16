const { test, describe } = require('node:test');
const assert = require('node:assert');
const { HOOK, runHook } = require('./helpers');

const GUARD = HOOK('guard-agent-tools');
const ALLOW = 0;
const DENY = 2;

const guard = (agent_type, tool_name) => runHook(GUARD, { agent_type, tool_name });
const statusOf = (agent, tool) => guard(agent, tool).status;

const READ_AGENTS = ['intake', 'surveyor', 'verifier'];
const ALL_AGENTS = [...READ_AGENTS, 'publisher'];

const READ_OPS = [
  'getJiraIssue', 'jira_get_issue',
  'searchJiraIssuesUsingJql', 'jira_search',
  'get_issue', 'list_issues',
];
const WRITE_OPS = [
  'addCommentToJiraIssue', 'jira_add_comment', 'save_comment',
  'editJiraIssue', 'jira_update_issue',
  'createJiraIssue', 'jira_create_issue',
  'jira_create_issue_link', 'save_issue',
];

describe('SubagentHandback — the return channel', () => {
  // Regression: every governed agent used to finish its work and then be denied
  // on the call that delivers its report back to the orchestrator.
  for (const agent of ALL_AGENTS) {
    test(`${agent} may call SubagentHandback`, () => {
      const r = guard(`sdlc:${agent}`, 'SubagentHandback');
      assert.strictEqual(r.status, ALLOW, `denied: ${r.stderr}`);
    });
  }

  test('bare (unprefixed) agent names get the same allowance', () => {
    for (const agent of ALL_AGENTS) {
      assert.strictEqual(statusOf(agent, 'SubagentHandback'), ALLOW, agent);
    }
  });

  test('the tool name is matched exactly, not case-insensitively', () => {
    assert.strictEqual(statusOf('sdlc:intake', 'subagenthandback'), DENY);
    assert.strictEqual(statusOf('sdlc:intake', 'SUBAGENTHANDBACK'), DENY);
    assert.strictEqual(statusOf('sdlc:intake', 'SubagentHandback '), DENY);
  });
});

describe('per-agent builtin allowlists', () => {
  const EXPECTED = {
    intake: ['Read', 'Write', 'Edit', 'Grep', 'Glob', 'ToolSearch', 'SubagentHandback'],
    surveyor: ['Read', 'Write', 'Edit', 'Grep', 'Glob', 'ToolSearch', 'SubagentHandback'],
    verifier: ['Read', 'Grep', 'Glob', 'ToolSearch', 'SubagentHandback'],
    publisher: ['Read', 'ToolSearch', 'SubagentHandback'],
  };

  // Every builtin this harness exposes that a governed agent might plausibly
  // reach for. Each agent must allow exactly its own list out of this set and
  // deny the whole remainder — the negative half is what caught the original bug.
  const KNOWN_BUILTINS = [
    'Read', 'Write', 'Edit', 'NotebookEdit', 'Grep', 'Glob', 'ToolSearch', 'SubagentHandback',
    'Bash', 'PowerShell', 'Agent', 'Task', 'TodoWrite', 'Skill', 'ExitPlanMode', 'EnterPlanMode',
    'WebFetch', 'WebSearch', 'Artifact', 'SendMessage', 'EnterWorktree', 'Monitor', 'TaskOutput',
  ];

  for (const [agent, builtins] of Object.entries(EXPECTED)) {
    test(`${agent} allows exactly its listed builtins and nothing else`, () => {
      for (const tool of KNOWN_BUILTINS) {
        const want = builtins.includes(tool) ? ALLOW : DENY;
        assert.strictEqual(statusOf(agent, tool), want, `${agent} / ${tool}`);
      }
      // guards against the sweep silently covering none of the agent's own list
      for (const tool of builtins) assert.ok(KNOWN_BUILTINS.includes(tool), `sweep missing ${tool}`);
    });
  }

  test('verifier is read-only — no file mutation of any kind', () => {
    assert.strictEqual(statusOf('sdlc:verifier', 'Write'), DENY);
    assert.strictEqual(statusOf('sdlc:verifier', 'Edit'), DENY);
    assert.strictEqual(statusOf('sdlc:verifier', 'NotebookEdit'), DENY);
  });

  // Write can replace a file wholesale, so an agent holding Write and not Edit is
  // not more restricted — only more likely to be denied mid-task on tool choice.
  test('Edit is granted wherever Write is', () => {
    for (const [agent, builtins] of Object.entries(EXPECTED)) {
      assert.strictEqual(
        builtins.includes('Edit'),
        builtins.includes('Write'),
        `${agent}: Edit and Write must be granted together`
      );
      if (builtins.includes('Write')) {
        assert.strictEqual(statusOf(agent, 'Edit'), ALLOW, agent);
      }
    }
  });

  test('publisher has no filesystem search or write builtins', () => {
    for (const tool of ['Write', 'Edit', 'Grep', 'Glob']) {
      assert.strictEqual(statusOf('sdlc:publisher', tool), DENY, tool);
    }
  });

  test('no agent may shell out or spawn further agents', () => {
    for (const agent of ALL_AGENTS) {
      for (const tool of ['Bash', 'PowerShell', 'Agent', 'Task', 'WebFetch', 'WebSearch']) {
        assert.strictEqual(statusOf(agent, tool), DENY, `${agent} should not allow ${tool}`);
      }
    }
  });

  test('an empty tool name fails closed for a governed agent', () => {
    assert.strictEqual(statusOf('sdlc:intake', ''), DENY);
  });
});

describe('tracker operation scoping (server-name agnostic)', () => {
  const SERVERS = [
    'jira',
    'claude_ai_Atlassian_Rovo',   // single underscores inside the server name
    'atlassian-tractionlayer',    // hyphens
    'my__weird__server',          // double underscores inside the server name
  ];

  test('read agents may call every read op on any server name', () => {
    for (const agent of READ_AGENTS) {
      for (const server of SERVERS) {
        for (const op of READ_OPS) {
          assert.strictEqual(statusOf(agent, `mcp__${server}__${op}`), ALLOW, `${agent} ${server} ${op}`);
        }
      }
    }
  });

  test('read agents are denied every write op on any server name', () => {
    for (const agent of READ_AGENTS) {
      for (const server of SERVERS) {
        for (const op of WRITE_OPS) {
          assert.strictEqual(statusOf(agent, `mcp__${server}__${op}`), DENY, `${agent} ${server} ${op}`);
        }
      }
    }
  });

  test('publisher may call every write op on any server name', () => {
    for (const server of SERVERS) {
      for (const op of WRITE_OPS) {
        assert.strictEqual(statusOf('sdlc:publisher', `mcp__${server}__${op}`), ALLOW, `${server} ${op}`);
      }
    }
  });

  // Current behavior, asserted so a change is deliberate: publisher's ops list is
  // FULL_WRITE_OPS only, so it cannot read a ticket back through the tracker.
  test('publisher is denied tracker read ops', () => {
    for (const op of READ_OPS) {
      assert.strictEqual(statusOf('sdlc:publisher', `mcp__jira__${op}`), DENY, op);
    }
  });

  test('the operation is taken from after the LAST double underscore', () => {
    assert.strictEqual(statusOf('sdlc:intake', 'mcp__a__b__jira_get_issue'), ALLOW);
    // ...so an op name buried mid-string is not a match
    assert.strictEqual(statusOf('sdlc:intake', 'mcp__jira_get_issue__somethingelse'), DENY);
  });

  test('op names must match whole, not by prefix or suffix', () => {
    for (const tool of [
      'mcp__jira__jira_get_issue_extra',
      'mcp__jira__x_jira_get_issue',
      'mcp__jira__jira_get_issu',
      'mcp__jira__JIRA_GET_ISSUE',
    ]) {
      assert.strictEqual(statusOf('sdlc:intake', tool), DENY, tool);
    }
  });

  test('malformed MCP tool names are denied, not accidentally parsed', () => {
    for (const tool of [
      'mcp__jira__',            // no operation
      'mcp__jira_get_issue',    // only one separator
      'mcp____jira_get_issue',  // empty server name is still not a read op holder
      'mcpjira__jira_get_issue',
      'jira_get_issue',         // bare op, no mcp prefix
      'Mcp__jira__jira_get_issue',
    ]) {
      assert.strictEqual(statusOf('sdlc:intake', tool), DENY, tool);
    }
  });
});

describe('agent identity resolution', () => {
  test("this plugin's own prefix is stripped", () => {
    assert.strictEqual(statusOf('sdlc:verifier', 'Write'), DENY, 'sdlc:verifier must be governed');
  });

  // Security-relevant: another plugin's same-named agent must not inherit our scope,
  // in either direction (neither governed by it nor granted by it).
  test('another plugin\'s same-named agent is not governed', () => {
    for (const raw of ['otherplugin:intake', 'someplugin:publisher', 'xsdlc:intake', 'sdlc2:verifier']) {
      assert.strictEqual(statusOf(raw, 'Bash'), ALLOW, raw);
    }
  });

  test('a doubly-prefixed name does not resolve to a governed agent', () => {
    assert.strictEqual(statusOf('sdlc:sdlc:intake', 'Bash'), ALLOW);
  });

  // reviewer/integrator are deliberately absent here — their Bash use is gated
  // separately; see inspect-only-bash.test.js.
  test('ungoverned and orchestrator calls pass through untouched', () => {
    assert.strictEqual(statusOf('sdlc:coder', 'Bash'), ALLOW);
    assert.strictEqual(statusOf('sdlc:architect', 'Bash'), ALLOW);
    assert.strictEqual(statusOf('', 'Bash'), ALLOW);
    assert.strictEqual(runHook(GUARD, { tool_name: 'Bash' }).status, ALLOW);
    assert.strictEqual(runHook(GUARD, {}).status, ALLOW);
  });

  test('agent names are matched exactly', () => {
    assert.strictEqual(statusOf('sdlc:Intake', 'Bash'), ALLOW);
    assert.strictEqual(statusOf('sdlc:intake ', 'Bash'), ALLOW);
  });

  test('inherited Object prototype keys are not agent names', () => {
    for (const raw of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      assert.strictEqual(statusOf(raw, 'Bash'), ALLOW, raw);
    }
  });
});

describe('malformed input fails open', () => {
  test('unparseable stdin does not block unrelated work', () => {
    for (const raw of ['', 'not json', '{"agent_type":', 'null', '[]']) {
      assert.strictEqual(runHook(GUARD, raw).status, ALLOW, JSON.stringify(raw));
    }
  });
});

describe('denial feedback', () => {
  test('stderr names the agent, the tool, and the allowed scope', () => {
    const r = guard('sdlc:verifier', 'Write');
    assert.strictEqual(r.status, DENY);
    assert.match(r.stderr, /sdlc gate/);
    assert.match(r.stderr, /verifier/);
    assert.match(r.stderr, /"Write"/);
    assert.match(r.stderr, /SubagentHandback/, 'the scope listing should reflect the real allowlist');
  });

  test('allowed calls stay silent', () => {
    const r = guard('sdlc:intake', 'Read');
    assert.strictEqual(r.stderr.trim(), '');
    assert.strictEqual(r.stdout.trim(), '');
  });
});
