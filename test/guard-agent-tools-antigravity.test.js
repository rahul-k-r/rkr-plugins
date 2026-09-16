const { test, describe } = require('node:test');
const assert = require('node:assert');
const { HOOK_AG, runHook, decisionOf } = require('./helpers');

// The Antigravity port always exits 0 and signals via a JSON decision on stdout,
// unlike the Claude Code hook's exit-code contract.
const GUARD = HOOK_AG('guard-agent-tools');
const decide = (payload) => {
  const r = runHook(GUARD, payload);
  assert.strictEqual(r.status, 0, 'the Antigravity hook must always exit 0');
  return decisionOf(r);
};

const ALL_AGENTS = ['intake', 'surveyor', 'verifier', 'publisher'];

describe('decision protocol', () => {
  test('every response is a parseable allow/deny decision', () => {
    const d = decide({ Role: 'intake', tool_name: 'view_file' });
    assert.ok(['allow', 'deny'].includes(d), `unexpected decision: ${d}`);
  });

  test('a denial carries an sdlc-prefixed reason', () => {
    const r = runHook(GUARD, { Role: 'verifier', tool_name: 'write_to_file' });
    const body = JSON.parse(r.stdout);
    assert.strictEqual(body.decision, 'deny');
    assert.match(body.reason, /^sdlc gate: /);
    assert.match(body.reason, /verifier/);
  });

  test('unparseable input allows rather than blocks', () => {
    for (const raw of ['', 'not json', 'null', '42', '"a string"', '[]']) {
      assert.strictEqual(decide(raw), 'allow', JSON.stringify(raw));
    }
  });

  // A crash would exit non-zero with no decision on stdout, leaving Antigravity
  // with nothing to act on — worse than either allow or deny.
  test('inherited Object prototype keys are not roles', () => {
    for (const role of ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf']) {
      assert.strictEqual(decide({ Role: role, tool_name: 'run_command' }), 'allow', role);
    }
  });

  test('a non-string role does not crash the hook', () => {
    for (const role of [42, true, ['verifier'], { name: 'verifier' }]) {
      assert.strictEqual(decide({ Role: role, tool_name: 'run_command' }), 'allow', JSON.stringify(role));
    }
  });
});

describe('role extraction', () => {
  test('Role, role, args.Role and subagent_role are all honoured', () => {
    assert.strictEqual(decide({ Role: 'verifier', tool_name: 'write_to_file' }), 'deny');
    assert.strictEqual(decide({ role: 'verifier', tool_name: 'write_to_file' }), 'deny');
    assert.strictEqual(decide({ args: { Role: 'verifier' }, tool_name: 'write_to_file' }), 'deny');
    assert.strictEqual(decide({ subagent_role: 'verifier', tool_name: 'write_to_file' }), 'deny');
  });

  test('an absent or unknown role is ungoverned', () => {
    assert.strictEqual(decide({ tool_name: 'run_command' }), 'allow');
    assert.strictEqual(decide({ Role: 'coder', tool_name: 'run_command' }), 'allow');
    assert.strictEqual(decide({ Role: '', tool_name: 'run_command' }), 'allow');
  });

  test('roles are matched exactly', () => {
    assert.strictEqual(decide({ Role: 'Verifier', tool_name: 'write_to_file' }), 'allow');
    // this port keys on the bare role, so a plugin-qualified name is ungoverned
    assert.strictEqual(decide({ Role: 'sdlc:verifier', tool_name: 'write_to_file' }), 'allow');
  });
});

describe('tool-name extraction', () => {
  test('toolCall.name, tool_name, name and tool are all honoured', () => {
    assert.strictEqual(decide({ Role: 'intake', toolCall: { name: 'view_file' } }), 'allow');
    assert.strictEqual(decide({ Role: 'intake', tool_name: 'view_file' }), 'allow');
    assert.strictEqual(decide({ Role: 'intake', name: 'view_file' }), 'allow');
    assert.strictEqual(decide({ Role: 'intake', tool: 'view_file' }), 'allow');
  });

  test('an unrecognised builtin is denied (fails closed)', () => {
    assert.strictEqual(decide({ Role: 'intake', tool_name: 'some_unknown_tool' }), 'deny');
    assert.strictEqual(decide({ Role: 'intake' }), 'deny');
  });
});

describe('builtin scoping', () => {
  const READ_BUILTINS = ['view_file', 'grep_search', 'find_by_name', 'list_dir', 'Read', 'Grep', 'Glob'];
  const WRITE_BUILTINS = ['write_to_file', 'replace_file_content', 'Write', 'Edit'];

  test('intake and surveyor get read and write file builtins', () => {
    for (const role of ['intake', 'surveyor']) {
      for (const t of [...READ_BUILTINS, ...WRITE_BUILTINS]) {
        assert.strictEqual(decide({ Role: role, tool_name: t }), 'allow', `${role} ${t}`);
      }
    }
  });

  test('verifier gets read builtins only', () => {
    for (const t of READ_BUILTINS) {
      assert.strictEqual(decide({ Role: 'verifier', tool_name: t }), 'allow', t);
    }
    for (const t of WRITE_BUILTINS) {
      assert.strictEqual(decide({ Role: 'verifier', tool_name: t }), 'deny', t);
    }
  });

  test('publisher gets file reads only', () => {
    for (const t of ['view_file', 'Read']) {
      assert.strictEqual(decide({ Role: 'publisher', tool_name: t }), 'allow', t);
    }
    for (const t of ['grep_search', 'list_dir', 'write_to_file', 'Write']) {
      assert.strictEqual(decide({ Role: 'publisher', tool_name: t }), 'deny', t);
    }
  });

  test('no governed agent may run shell commands', () => {
    for (const role of ALL_AGENTS) {
      assert.strictEqual(decide({ Role: role, tool_name: 'run_command' }), 'deny', role);
    }
  });
});

describe('MCP operation scoping', () => {
  test('call_mcp_tool reads the operation out of its args', () => {
    const call = (role, op, argKey = 'ToolName') =>
      decide({ Role: role, tool_name: 'call_mcp_tool', tool_input: { [argKey]: op } });
    assert.strictEqual(call('intake', 'jira_get_issue'), 'allow');
    assert.strictEqual(call('intake', 'jira_get_issue', 'toolName'), 'allow');
    assert.strictEqual(call('intake', 'jira_get_issue', 'tool_name'), 'allow');
    assert.strictEqual(call('intake', 'jira_add_comment'), 'deny');
    assert.strictEqual(call('publisher', 'jira_add_comment'), 'allow');
  });

  test('operation args arrive double-encoded and are unwrapped', () => {
    const d = decide({
      Role: 'intake',
      toolCall: { name: 'call_mcp_tool', args: { ToolName: JSON.stringify('jira_get_issue') } },
    });
    assert.strictEqual(d, 'allow');
  });

  test('eager mcp_ names are matched by known-operation suffix', () => {
    assert.strictEqual(decide({ Role: 'intake', tool_name: 'mcp_jira_get_issue' }), 'allow');
    assert.strictEqual(decide({ Role: 'intake', tool_name: 'mcp_my_server_jira_get_issue' }), 'allow');
    assert.strictEqual(decide({ Role: 'intake', tool_name: 'mcp_jira_add_comment' }), 'deny');
    assert.strictEqual(decide({ Role: 'publisher', tool_name: 'mcp_any_server_jira_add_comment' }), 'allow');
  });

  test('an unknown operation is denied whatever the shape', () => {
    assert.strictEqual(decide({ Role: 'intake', tool_name: 'mcp_unknown_op' }), 'deny');
    assert.strictEqual(decide({ Role: 'intake', tool_name: 'call_mcp_tool', tool_input: {} }), 'deny');
  });

  test('read roles never reach write operations', () => {
    for (const role of ['intake', 'surveyor', 'verifier']) {
      for (const op of ['jira_update_issue', 'jira_create_issue', 'save_issue', 'editJiraIssue']) {
        assert.strictEqual(decide({ Role: role, tool_name: `mcp_srv_${op}` }), 'deny', `${role} ${op}`);
      }
    }
  });
});
