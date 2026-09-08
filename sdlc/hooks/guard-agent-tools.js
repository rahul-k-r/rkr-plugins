#!/usr/bin/env node
// PreToolUse gate restoring per-agent tool scoping for the six sdlc subagents
// that touch a tracker (intake, pr-reviewer, surveyor, verifier, publisher,
// scribe) — WITHOUT hardcoding MCP server names anywhere.
//
// Why this exists: a subagent's `tools:` frontmatter can grant one exact
// server (`mcp__myserver__*`) but has no wildcard across server-name variants
// (no `mcp__*__toolname`, no bare `mcp__*` on the allow side — confirmed
// against the platform docs, not inferred). MCP server names are chosen
// per-project/per-user and can't be enumerated in advance. A hook can only
// ADD restriction on top of what frontmatter already allows, never grant
// beyond it — so the only way these six agents can reach an MCP server whose
// name isn't known ahead of time is to carry NO `tools:` field at all (full
// inheritance). This hook is what keeps that from meaning unrestricted
// access: it reads `agent_type` + `tool_name` from the PreToolUse payload and
// denies anything outside that agent's approved built-in tools and tracker
// operations — matched by OPERATION name via regex, never by server name, so
// a brand-new MCP server name never needs a plugin edit again.
//
// Adding a new *operation* name variant (a tracker MCP with different tool
// naming than what's listed below) still needs an edit here — that part
// isn't eliminable, only the per-server-name repetition is.

const READ_OPS = [
  'getJiraIssue', 'jira_get_issue',
  'searchJiraIssuesUsingJql', 'jira_search',
  'get_issue', 'list_issues',
];
const COMMENT_OPS = ['addCommentToJiraIssue', 'jira_add_comment', 'save_comment'];
const FULL_WRITE_OPS = [
  ...COMMENT_OPS,
  'editJiraIssue', 'jira_update_issue',
  'createJiraIssue', 'jira_create_issue',
  'jira_create_issue_link',
  'save_issue',
];
// Fixed plugin-bundled tool name — never varies per project (it's not a
// user-chosen server name), so it's a plain exact entry rather than
// something this hook needs to generalize.
const OMNIBUS_TOOL = 'mcp__plugin_traction-atlassian_atlassian';

const AGENT_SCOPE = {
  intake: { builtins: ['Read', 'Write', 'Grep', 'Glob'], ops: READ_OPS },
  'pr-reviewer': { builtins: ['Read', 'Grep', 'Glob', 'Bash'], ops: READ_OPS },
  surveyor: { builtins: ['Read', 'Grep', 'Glob'], ops: READ_OPS },
  verifier: { builtins: ['Read', 'Grep', 'Glob'], ops: READ_OPS },
  publisher: { builtins: ['Read'], ops: FULL_WRITE_OPS },
  scribe: { builtins: ['Read', 'Write', 'Edit'], ops: COMMENT_OPS },
};

let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => {
  let payload;
  try {
    payload = JSON.parse(input);
  } catch {
    process.exit(0); // unparseable — don't block unrelated work
  }

  const agentType = payload.agent_type;
  const scope = agentType && AGENT_SCOPE[agentType];
  if (!scope) process.exit(0); // orchestrator, or an agent this hook doesn't govern

  const toolName = payload.tool_name || '';
  if (scope.builtins.includes(toolName)) process.exit(0);
  if (toolName === OMNIBUS_TOOL) process.exit(0);

  // mcp__<any server name, hyphens/underscores allowed>__<operation> — the
  // operation is whatever follows the LAST `__`, so a server name containing
  // single underscores (e.g. claude_ai_Linear) still splits correctly.
  const opMatch = /^mcp__.+__([A-Za-z0-9_]+)$/.exec(toolName);
  if (opMatch && scope.ops.includes(opMatch[1])) process.exit(0);

  console.error(
    `sdlc gate: "${agentType}" is scoped to {${scope.builtins.join(', ')}} plus tracker ops ` +
      `{${scope.ops.join(', ')}} (on any MCP server) — "${toolName}" isn't in that list. This ` +
      `agent has no tools: allowlist in its own frontmatter (MCP server names vary per project), ` +
      `so this hook enforces its scope dynamically instead — see skills/tracker-adapter/SKILL.md.`
  );
  process.exit(2);
});
