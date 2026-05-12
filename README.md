# claude-skills-plugin

A Claude Code plugin containing personal skills for productivity, prompt engineering, and workflow automation.

## Installation

### Claude Code

From inside a Claude Code session, run:

```
/plugin marketplace add AbdouMoumen/claude-skills-plugin
/plugin install claude-skills@claude-skills
```

### Copilot CLI

From inside a Copilot CLI session, run the same commands:

```
/plugin marketplace add AbdouMoumen/claude-skills-plugin
/plugin install claude-skills@claude-skills
```

<details>
<summary><strong>Manual / Development</strong></summary>

Clone the repo and point your CLI at it:

```bash
git clone https://github.com/AbdouMoumen/claude-skills-plugin.git ~/claude-skills-plugin
```

Then launch with the plugin directory:

```bash
claude --plugin-dir ~/claude-skills-plugin
# or
copilot --plugin-dir ~/claude-skills-plugin
```

Or add a permanent alias to your shell profile:

```bash
# ~/.bashrc or ~/.zshrc
alias claude='claude --plugin-dir ~/claude-skills-plugin'
```

</details>

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
| **grill-me** | Interview the user relentlessly about a plan or design until reaching shared understanding. Walks each branch of the decision tree. |
| **handoff** | Compact the current conversation into a handoff document for another agent to pick up. |

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

"Grill me on this plan" / "Stress-test my design"
→ grill-me activates

"Handoff" / "Pass this to another session"
→ handoff activates
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
│   ├── grill-me/               # Stress-test plans & designs
│   │   └── SKILL.md
│   ├── handoff/                # Session handoff documents
│   │   └── SKILL.md
│   └── _shared/                 # Shared data schema
│       └── data-schema.md
├── README.md
└── CHANGELOG.md
```

## License

MIT
