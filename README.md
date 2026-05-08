# claude-skills-plugin

A Claude Code plugin containing personal skills for productivity, prompt engineering, and workflow automation.

## Installation

```bash
git clone https://github.com/AbdouMoumen/claude-skills-plugin.git ~/claude-skills-plugin
```

Then launch Claude Code with the plugin:

```bash
claude --plugin-dir ~/claude-skills-plugin
```

Or add a permanent alias to your shell profile:

```bash
# ~/.bashrc or ~/.zshrc
alias claude='claude --plugin-dir ~/claude-skills-plugin'
```

## Skills

| Skill | Description |
|-------|-------------|
| **skill-creator** | Guides Claude through creating new skills using a 5-phase process (discovery, scope, design, implement, validate). Model-invoked when you ask to create a skill. |
| **plugin-creator** | Guides through creating Claude Code plugins with slash commands, skills, hooks, and MCP servers. |
| **forge** | Craft, optimize, and review AI prompts using proven techniques. Supports create, evaluate, and compare workflows. |
| **mcp-toggle** | Toggle MCP servers on/off in `.mcp.json` and manage `git skip-worktree`. |
| **fresh-start** | Post-PR cleanup: verify PR merged, switch to main, delete branch, pull latest, install deps. |
| **dotfiles-sync** | Set up, repair, and git-sync the dotfiles repository for Claude Code and Copilot config. |
| **devbox-monitor** | Continuously monitor AI agent activity and repo health across configured repos on a timer. Writes JSON snapshots to a shared sync path. |
| **devbox-report** | Read devbox status snapshots and generate a self-contained dark-mode HTML report, or answer natural-language queries about repo and agent state. |

## Usage

Skills are **model-invoked** — Claude automatically uses them based on context. Just talk naturally:

```
"Create a skill that validates code before PRs"
→ skill-creator activates

"Write me a system prompt for a code reviewer"
→ forge activates

"Fresh start" / "Next task"
→ fresh-start activates

"Toggle my MCP servers"
→ mcp-toggle activates

"Sync my dotfiles"
→ dotfiles-sync activates

"Monitor my repos" / "Start devbox monitor"
→ devbox-monitor activates

"Show devbox report" / "Which repos have uncommitted changes?"
→ devbox-report activates
```

## Requirements

- Claude Code v1.0.33 or later

## Structure

```
claude-skills-plugin/
├── .claude-plugin/
│   └── plugin.json              # Plugin manifest
├── skills/
│   ├── skill-creator/           # Meta-skill for creating skills
│   │   ├── SKILL.md
│   │   └── reference/
│   ├── plugin-creator/          # Create distributable plugins
│   │   └── SKILL.md
│   ├── forge/                   # Prompt engineering
│   │   ├── SKILL.md
│   │   └── reference/
│   ├── mcp-toggle/              # Toggle MCP servers
│   │   └── SKILL.md
│   ├── fresh-start/             # Post-PR cleanup
│   │   └── SKILL.md
│   ├── dotfiles-sync/           # Dotfiles repo management
│   │   ├── SKILL.md
│   │   └── reference/
│   ├── devbox-monitor/          # Multi-machine repo & agent monitor
│   │   ├── SKILL.md
│   │   └── devbox-snapshot.ps1
│   ├── devbox-report/           # HTML dashboard & NL query reporter
│   │   ├── SKILL.md
│   │   └── references/
│   └── _shared/                 # Shared data schema
│       └── data-schema.md
├── README.md
└── CHANGELOG.md
```

## License

MIT
