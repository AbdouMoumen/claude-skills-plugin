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
│   └── dotfiles-sync/           # Dotfiles repo management
│       ├── SKILL.md
│       └── reference/
├── README.md
└── CHANGELOG.md
```

## License

MIT
