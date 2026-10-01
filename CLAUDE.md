# CLAUDE.md — claude-skills-plugin

## Skill Design Conventions

- **WHAT over HOW** — Tell the agent conventions and guardrails, not how to write code. Describe intent and expected behavior, not the specific implementation. Let the agent choose the right tool for the platform.
- **KISS** — Ship minimal instructions. Exercise the skill. Find gaps. Fix. Iterate. Don't preemptively author content for failures that haven't happened.
- **Progressive disclosure** — Heavy details belong in `reference/` docs, loaded on demand. SKILL.md stays focused on the flow.

## Plugin Manifests

- `.plugin/plugin.json` (Copilot CLI/app; read first) and `.claude-plugin/plugin.json` (Claude Code) must stay in sync: name, description, version, and other metadata. The only difference is that `.plugin/plugin.json` has `"extensions"`, which Claude Code's validator rejects. Keep `.plugin/plugin.json` a legacy manifest (no `$schema`). Also keep the version and description in `.claude-plugin/marketplace.json` in sync.