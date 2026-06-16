# Changelog

## [Unreleased]

### Added

- `plugin-updater` skill — detect installed plugins across Claude Code and Copilot CLI, update them, and maintain a self-learning platform playbook at `skills/plugin-updater/reference/platform-playbook.md` when plugin list/update APIs change.
- `judgment-evidence` skill — capture moments of good user judgment (course-corrections, proactive design calls, bug catches, scope discipline, domain insight) into a personal append-only store. Hybrid detection: silent live capture mid-session plus an end-of-session sweep with unified review. Two-directory store: `~/.agents/` for the shareable main store + config, `~/.agents-local/` for the machine-local sidecar with verbatim text and paths — kept in a separate directory so it can't be accidentally synced when the main store is backed by a private repo or cloud-sync folder. Per-repo and per-cwd anonymization with deterministic 8-char repo hashes; **unknown repos default to anonymized** so safety doesn't depend on the user remembering to classify every new repo. Integrated as step 5 of `wrap-up`.

### Changed

- `CLAUDE.md` — replaced the single skill design bullet with three principles: WHAT over HOW, KISS, Progressive disclosure.
- `wrap-up` skill — inserted step 5 to invoke `judgment-evidence` between `session-reflect` and `handoff`.

## [1.3.0] - 2026-06-03

### Changed

- `skill-review` skill — added validation step (thorough mode only). Findings are now classified as behavioral or meta-evaluative; behavioral findings are validated by a fresh per-finding simulation subagent that returns a trinary verdict (`would-manifest` / `unsure` / `would-not-manifest`). Findings the validator finds unlikely surface in a separate **Possibly invalid** section (no severity demotion). The walkthrough now covers main findings first, then offers a second pass for possibly-invalid ones with the full validator trace alongside. Empirically validated across 12 subagent cells before shipping (8 real findings × 2 prompt variants, plus 4 synthetic controls). See `skills/skill-review/SKILL.md` Step 9 for the architecture.

## [1.2.0] - 2026-06-03

### Added

- `skill-review` skill — review a skill against a 9-axis rubric and emit conversational, severity-tagged findings with suggested fixes. Light mode (single subagent) for short or low-risk skills; thorough mode (general-purpose + rubber-duck in parallel) for skills that fire conditional axes. Calibration bank lives at `skills/skill-review/reference/examples.md`.
- Design doc at `docs/skill-review-design.md` covering the rubric, mode selection, subagent contract, and merge rules.

## [1.1.0] - 2026-05-11

### Added

- `grill-me` skill — interview the user relentlessly about a plan or design until reaching shared understanding (adapted from [mattpocock/skills](https://github.com/mattpocock/skills))
- `handoff` skill — compact the current conversation into a handoff document for another agent to pick up (adapted from [mattpocock/skills](https://github.com/mattpocock/skills))

## [1.0.0] - 2026-05-01

### Added

- `skill-creator` skill — 5-phase structured process for creating new skills
- `plugin-creator` skill — guide for creating Claude Code plugins
- `forge` skill — prompt engineering (create, evaluate, compare)
- `mcp-toggle` skill — toggle MCP servers and manage git skip-worktree
- `fresh-start` skill — post-PR cleanup workflow
- `dotfiles-sync` skill — dotfiles repo setup, repair, and sync
- Plugin manifest at `.claude-plugin/plugin.json`
- Reference files for skill-creator, forge, and dotfiles-sync skills
