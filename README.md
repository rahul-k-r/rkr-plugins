# Rahul's Agent Plugins (`rkr-plugins`)

A collection of personal plugins and workflows designed for **Claude Code**, **Codex**, and **Google Antigravity (AGY)**.

This repository serves as a plugin marketplace and workspace source. All plugins in this repository are engineered to run across Claude Code, Codex, and Antigravity while maintaining a single, shared source of truth for business logic and command specifications.

---

## Available Plugins

| Plugin | Version | Description | Platforms |
|---|---|---|---|
| **[`sdlc`](./sdlc/)** | `0.6.0` | Comprehensive story SDLC: design-review gate, full autonomous story lifecycle (`story-run`), multi-expert design deliberation (`design-run`), multi-PR review subsystem (`review-run`), and product design review (`product-design-review`). | Claude Code, Codex, Antigravity |

---

## Installation Guide

### 1. Claude Code

#### Option A: Marketplace Installation
Add this repository as a plugin marketplace in Claude Code:

```bash
claude plugin marketplace add rahul-k-r/rkr-plugins
claude plugin install sdlc@rkr-plugins
```

#### Option B: Local / Development Installation
Load the plugin from a local directory:

```bash
claude plugin install ./sdlc
```

Hooks are automatically loaded by Claude Code via `sdlc/hooks/hooks.json`.

---

### 2. Codex

Install the personal SDLC plugin from the repository marketplace:

```bash
npx github:rahul-k-r/rkr-plugins codex-install
```

To refresh it after an update:

```bash
npx github:rahul-k-r/rkr-plugins codex-update
```

PowerShell and Bash users can run `install.ps1 -Codex` or `install.sh --codex`.
Start a new Codex task after installation so its command index is rebuilt.

---

### 3. Google Antigravity (AGY)

#### Cross-Platform (Recommended — Windows, macOS, Linux)
Install directly via `npx` (requires Node.js):
```bash
npx github:rahul-k-r/rkr-plugins install
```

To update to the latest version:
```bash
npx github:rahul-k-r/rkr-plugins update
```

To cleanly uninstall the plugin and remove safety hooks:
```bash
npx github:rahul-k-r/rkr-plugins uninstall
```

---

#### Alternative: OS Shell Scripts

##### Windows (PowerShell)
```powershell
irm https://raw.githubusercontent.com/rahul-k-r/rkr-plugins/main/install.ps1 | iex
```

##### macOS / Linux (Bash)
```bash
curl -fsSL https://raw.githubusercontent.com/rahul-k-r/rkr-plugins/main/install.sh | bash
```

*(If running inside a locally cloned repository, you can run `./install.ps1` or `./install.sh` directly)*

#### Verify Installation
```bash
agy plugin list
agy -p "/skills"
```

All commands are ready to use in your chat as `/sdlc:<command>` (e.g. `/sdlc:story-run`, `/sdlc:help`, `/sdlc:commit`).

#### Installing Safety Hooks in Antigravity
To enable branch protection (`gate-git.js`) and agent tool scoping (`guard-agent-tools.js`) under Antigravity:
Run the install command inside your Antigravity chat:
```
/sdlc:install-hooks
```
This merges the hook configuration into your global `~/.gemini/config/hooks.json`.

#### Local / Workspace Development
If you have cloned this repository and are developing plugins locally, Antigravity automatically discovers `sdlc` in this workspace via `.agents/plugins.json`:
```json
{
  "entries": [
    { "path": "sdlc" }
  ]
}
```

---

## Three-Harness Architecture

```
rkr-plugins/
├── .claude-plugin/              # Claude Code marketplace definition
│   └── marketplace.json
├── .agents/                     # Antigravity workspace configuration
│   └── plugins.json
└── sdlc/                        # The SDLC Plugin
    ├── plugin.json              # Antigravity & Agent Plugin spec
    ├── .codex-plugin/           # Codex plugin manifest
    ├── .claude-plugin/          # Claude Code plugin spec
    ├── commands/                # Single Source of Truth for all workflow logic
    │   ├── story-run.md
    │   ├── design-run.md
    │   └── ...
    ├── agents/                  # Multi-agent personas
    │   ├── designer.md
    │   ├── architect.md
    │   └── ...
    ├── skills/                  # Command adapters (namespaced as sdlc:<name>)
    │   ├── story-run/SKILL.md
    │   ├── design-run/SKILL.md
    │   └── ...
    ├── hooks/                   # Claude Code hooks
    └── hooks-antigravity/       # Antigravity lifecycle hooks
```

- **Single Source of Truth**: All workflow phases, checks, and prompt logic live in `sdlc/commands/*.md` and `sdlc/agents/*.md`.
- **Zero Drift**: Updating a command's workflow automatically updates it for Claude Code, Codex, and Antigravity.
- **Harness Adapters**: `sdlc/skills/<name>/SKILL.md` files provide thin, native adapters that translate harness primitives (`multi_agent_v1__spawn_agent` for Codex, `invoke_subagent` for Antigravity, and `Task` for Claude Code) while keeping command names (`/sdlc:story-run`) identical across platforms.

---

## License & Author

- **Author**: Rahul (<rahulkundapurr@gmail.com>)
- **Repository**: [github.com/rahul-k-r/rkr-plugins](https://github.com/rahul-k-r/rkr-plugins)
