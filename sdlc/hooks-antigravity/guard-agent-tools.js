#!/usr/bin/env node
// Antigravity port of hooks/guard-agent-tools.js — SAME per-agent tool-scoping policy, adapted
// to Antigravity's dispatch and MCP-naming shapes. Read ../docs/antigravity-port-notes.md before
// relying on this: two real gaps exist here that Claude Code's original doesn't have.
//
//   1. Plugin hooks.json does not auto-wire under Antigravity (confirmed empirically) — this
//      file only does anything once manually installed into the user's global
//      ~/.gemini/config/hooks.json (see skills/install-hooks/SKILL.md).
//   2. Agent identity relies on the dispatching wrapper setting `Role` to the exact agent name
//      (see antigravity-port-notes.md's "How to translate a Task dispatch" — every dispatch sets
//      `Role` this way now, not just the four this hook governs). If a dispatch sets Role to
//      anything else, this hook has NO way to identify it and will treat the call as ungoverned
//      (allowed) rather than denied — a silent fail-open, not fail-closed, for that one specific
//      failure mode. This is a real, disclosed weaker guarantee than Claude Code's `agent_type`
//      field, which the platform sets itself and can't be gotten wrong by a prompt author.
//
// Policy (identical to hooks/guard-agent-tools.js — keep both in sync manually):
//   intake, surveyor, verifier, publisher each get a fixed set of built-in tools plus a fixed set
//   of tracker READ/WRITE operations, matched by OPERATION name on ANY MCP server — never by
//   server name, so a new project's differently-named tracker connection never needs an edit here.
//
// MCP naming (confirmed against real Antigravity transcripts, 2026-09-08 — see the notes doc):
//   - Lazy-loaded servers (the default) dispatch through one fixed tool, `call_mcp_tool`, with
//     `ServerName`/`ToolName` as args — sometimes double-JSON-encoded (a raw transcript showed
//     `"ToolName":"\"get_workspace\""`, i.e. the value is itself a quoted JSON string). Handled
//     defensively below.
//   - Eager-loaded servers use `mcp_<server>_<tool>` (single underscore) as the tool name
//     directly — corroborated by a real permission-evaluator's source, not yet directly
//     observed in a transcript; handled the same way regardless, since the operation-matching
//     logic doesn't depend on which is true.
//
// UNCONFIRMED, best-effort: the exact top-level field names carrying the built-in (non-MCP)
// tool name and the dispatching subagent's Role were never directly observed in a PreToolUse
// payload specifically (only in transcript/audit logs, which may not share the same shape) —
// checked defensively below across several plausible paths. Narrow this to the real field names
// once tested against a live payload.
//
// Also unconfirmed: the AGENT_SCOPE builtins list below assumes Antigravity's file-read/write/
// search tools are literally named "Read"/"Write"/"Grep"/"Glob"/"Edit", same as Claude Code —
// only `run_command` (replacing Claude's "Bash") is confirmed, from the hooks test's own
// `matcher: "run_command"`. If the others turn out to be named differently, every builtins list
// below needs updating to match — this hook fails closed in that case (denies a legitimate
// built-in call it doesn't recognize), not open, so the failure mode is "too strict," not silent.

const READ_OPS = [
  'getJiraIssue', 'jira_get_issue',
  'searchJiraIssuesUsingJql', 'jira_search',
  'get_issue', 'list_issues', 'get_workspace',
];
const COMMENT_OPS = ['addCommentToJiraIssue', 'jira_add_comment', 'save_comment'];
const FULL_WRITE_OPS = [
  ...COMMENT_OPS,
  'editJiraIssue', 'jira_update_issue',
  'createJiraIssue', 'jira_create_issue',
  'jira_create_issue_link',
  'save_issue',
];

// Shared builtin sets — intake/surveyor get read+write file access, verifier read-only. Kept as
// named constants (rather than repeated per-agent) so a platform tool-name correction (see the
// header's "Also unconfirmed" note) is a one-place edit, same as READ_OPS/FULL_WRITE_OPS above.
const READ_BUILTINS = ['view_file', 'grep_search', 'find_by_name', 'list_dir', 'Read', 'Grep', 'Glob'];
const RW_BUILTINS = [...READ_BUILTINS, 'write_to_file', 'replace_file_content', 'Write'];

const AGENT_SCOPE = {
  intake: { builtins: RW_BUILTINS, ops: READ_OPS },
  surveyor: { builtins: RW_BUILTINS, ops: READ_OPS },
  verifier: { builtins: READ_BUILTINS, ops: READ_OPS },
  publisher: { builtins: ['view_file', 'Read'], ops: FULL_WRITE_OPS },
};

// A value observed as a JSON-encoded string (e.g. `"\"get_workspace\""`) unwraps to its plain
// form; anything else passes through unchanged. Defensive against the double-encoding seen in
// real transcript data for MCP call args.
function unwrap(v) {
  if (typeof v !== 'string') return v;
  try {
    const parsed = JSON.parse(v);
    return typeof parsed === 'string' ? parsed : v;
  } catch {
    return v;
  }
}

function extractRole(payload) {
  return payload.Role || payload.role || payload.args?.Role || payload.subagent_role || null;
}

function extractToolName(payload) {
  return payload.toolCall?.name || payload.tool_name || payload.name || payload.tool || '';
}

// Returns the operation name if this call is an MCP dispatch this hook can reason about, else
// null. Handles both confirmed naming shapes.
function mcpOperation(toolName, payload) {
  if (toolName === 'call_mcp_tool') {
    const args = payload.toolCall?.args || payload.tool_input || payload.args || {};
    const op = unwrap(args.ToolName ?? args.toolName ?? args.tool_name);
    return op || null;
  }
  const eager = /^mcp_(.+)$/.exec(toolName);
  if (eager) {
    const remainder = eager[1];
    const knownOps = [...READ_OPS, ...COMMENT_OPS, ...FULL_WRITE_OPS];
    // Match by known-operation SUFFIX rather than splitting on underscores positionally — a
    // server name can itself contain underscores, so there's no reliable fixed split point.
    for (const op of knownOps) {
      if (remainder === op || remainder.endsWith('_' + op)) return op;
    }
  }
  return null;
}

const allow = () => {
  process.stdout.write(JSON.stringify({ decision: 'allow' }));
  process.exit(0);
};
const deny = (reason) => {
  process.stdout.write(JSON.stringify({ decision: 'deny', reason: `sdlc gate: ${reason}` }));
  process.exit(0);
};

let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => {
  let payload;
  try {
    payload = JSON.parse(input);
  } catch {
    return allow(); // unparseable — don't block unrelated work
  }

  const role = extractRole(payload);
  const scope = role && AGENT_SCOPE[role];
  if (!scope) return allow(); // orchestrator, or an agent this hook doesn't govern

  const toolName = extractToolName(payload);
  if (scope.builtins.includes(toolName)) return allow();

  const op = mcpOperation(toolName, payload);
  if (op && scope.ops.includes(op)) return allow();

  return deny(
    `"${role}" is scoped to {${scope.builtins.join(', ')}} plus tracker ops ` +
      `{${scope.ops.join(', ')}} (on any MCP server) — "${toolName}"${op ? ` (op: ${op})` : ''} ` +
      `isn't in that list. See internal/tracker-adapter/SKILL.md and ` +
      `docs/antigravity-port-notes.md for how this scoping works and its known limits.`
  );
});
