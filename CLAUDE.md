# CLAUDE.md — claude-skills-plugin

## Skill Design Conventions

- **WHAT over HOW** — Tell the agent conventions and guardrails, not how to write code. Describe intent and expected behavior, not the specific implementation. Let the agent choose the right tool for the platform.
- **KISS** — Ship minimal instructions. Exercise the skill. Find gaps. Fix. Iterate. Don't preemptively author content for failures that haven't happened.
- **Progressive disclosure** — Heavy details belong in `reference/` docs, loaded on demand. SKILL.md stays focused on the flow.

## Plugin Manifests

- `claude-skills` has one manifest, `.claude-plugin/plugin.json`. Keep its version and description in sync with its entries in `.claude-plugin/marketplace.json` (Claude Code) and `.plugin/marketplace.json` (Copilot; read first).
- `parking-lot` is Copilot-only: `plugins/parking-lot/.plugin/plugin.json` (legacy manifest, no `$schema`; has `"extensions"`, which Claude Code rejects). List it only in `.plugin/marketplace.json`.