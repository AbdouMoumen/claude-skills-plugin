# Changelog

## [Unreleased]

### Added

- Parking Lot (`parking-lot` 1.3.0): panel UX refresh.
  - Each row has one compact split button, **▶ Queue** plus a **▾** menu with ⚡ Send now, Ask, Edit, Copy text, and Delete, in place of the ▶ / ⚡ / ✎ / ✕ hover icons. The menu is keyboard navigable and closes on Escape or an outside click. Done items get Edit, Copy text, and Delete.
  - New **Ask** send kind: it queues `/parking-lot ask <n> — <text>` (with `📎N` and `Notes:` like work) and doesn't change the item's status. The skill gains an `ask <n>` command (discuss without working it; offer to work it or mark it done only if the user agrees) and an `argument-hint`.
  - Delete and Clear done act immediately and show an undo toast (about 6s) instead of a confirm. Undo restores items exactly (ids, order, status, timestamps, notes, attachments). Removed items wait in a server-side trash, and their copied files are deleted only when the undo window expires or the extension stops. Ids are never reused.
  - The open list is split into **Now** (in progress, with a left accent) and **Up next**; the labels are hidden when nothing is in progress. Drag reorder works within each section.
  - Compact header: `🅿️ Parking Lot · N open · on #X`. The subtitle moved into the empty state, along with a shortcut hint.
  - Keyboard: selectable rows; ↑/↓, Space (done), E (edit), Q (queue), A (ask), Del/Backspace (delete with undo), Alt+↑/↓ (move), Esc, and `/` or N (focus the add box). The legend appears in the empty state and the header tooltip.
- Parking Lot (`parking-lot` 1.2.0): richer item context.
  - Shift+Enter in the add box opens a notes field; Enter adds the item with its notes.
  - Notes render as plain text with line breaks and clickable `http(s)` links, clamped to two lines (click to expand).
  - Paste screenshots or files into the add-box notes or the ✎ edit form. They're copied to `<session files>/parking-lot/` (25 MB cap each) and shown as 📎 chips; images get a thumbnail that enlarges on click.
  - `parking_add` / `parking_update` accept `attachments` (absolute paths of existing files), stored as references that are never copied or deleted. `parking_update`'s `status` is now optional so the agent can attach files without changing status. The agent can't remove attachments.
  - `parking_list` shows full attachment paths. The per-prompt context and ▶ / ⚡ prompts show only a `📎N` marker.
  - Deleting an item or Clear done deletes its copied files, with a confirm that says how many. Marking done keeps them. Missing referenced files are dimmed with ⚠.
- Parking Lot panel (`parking-lot` 1.1.0): each row shows a muted relative time, `added 3d ago` for open items and `done 2h ago` for done items, with the full local date/time in a tooltip. Uses the existing `createdAt` / `completedAt` fields; no data format change.

### Changed

- Parking Lot panel: done items are sorted by completion time, most recent first (items without `completedAt` last). Open items keep their manual drag order.

## [1.5.0] - 2026-10-01

### Added

- `parking-lot` skill in the `parking-lot` plugin (`plugins/parking-lot/skills/parking-lot/`). `/parking-lot` (or `open`) opens the canvas, `list` shows open items, `next` shows the topmost item and asks before starting it, `work <n>` works an item through to `done` with a completion note, and `/parking-lot <text>` parks an item. Natural-language equivalents ("what's next", "do #3") count as commands, not new items.
- Parking Lot panel: a ✎ Edit hover button on each row, next to ▶ / ⚡ / ✕. It does the same thing as double-clicking the text, which still works.

### Changed

- Parking Lot is now its own Copilot-only plugin, `parking-lot` (1.0.0), at `plugins/parking-lot/` with a legacy `.plugin/plugin.json` that declares `"extensions": "./extensions"`. The extension moved to `plugins/parking-lot/extensions/parking-lot/`; its code is unchanged.
- Copilot discovers `parking-lot` through `.plugin/marketplace.json`, a Copilot-only marketplace manifest listing both plugins that Copilot reads before `.claude-plugin/marketplace.json`. Claude Code's marketplace still lists only `claude-skills`.
- `claude-skills` description no longer mentions Parking Lot.
- Parking Lot ▶ / ⚡ buttons now send `/parking-lot work <n> — <item text>`, with `Notes: …` on the next line if the item has notes. Extension-sent prompts deliver slash commands as plain text (verified), so the skill is matched from its description.

### Removed

- Root `.plugin/plugin.json`. `claude-skills` is back to a single manifest, `.claude-plugin/plugin.json`, which Copilot also reads.

### Migration

- If you got Parking Lot through `claude-skills` 1.4.0, run `copilot plugin update claude-skills`, then `copilot plugin install parking-lot@claude-skills`.
## [1.4.0] - 2026-10-01

### Added

- `parking-lot` canvas extension (GitHub Copilot app only; Claude Code ignores it). It is a per-session backlog panel with `parking_add` / `parking_list` / `parking_update` tools and ships at `extensions/parking-lot/`.
- `.plugin/plugin.json`, a Copilot-only legacy manifest that Copilot reads before `.claude-plugin/plugin.json`. It adds `"extensions": "./extensions"`, which Claude Code's manifest validation rejects (`Unrecognized key`).

- `skill-distill` skill — make existing skills leaner by preserving required outcomes, removing unnecessary instructions, and reusing `skill-eval` for user-approved behavioral comparisons with versioned evidence.
- `change-walkthrough` skill — read-only, interactive walkthroughs of local changes and active or historical pull requests, with one-section-at-a-time navigation, revision-aware diff links, and an Azure DevOps comparison reference.
- `plugin-updater` skill — detect installed plugins across Claude Code and Copilot CLI, update them, and maintain a self-learning platform playbook at `skills/plugin-updater/reference/platform-playbook.md` when plugin list/update APIs change.
- `judgment-evidence` skill — capture moments of good user judgment (course-corrections, proactive design calls, bug catches, scope discipline, domain insight) into a personal append-only store. Hybrid detection: silent live capture mid-session plus an end-of-session sweep with unified review. Two-directory store: `~/.agents/` for the shareable main store + config, `~/.agents-local/` for the machine-local sidecar with verbatim text and paths — kept in a separate directory so it can't be accidentally synced when the main store is backed by a private repo or cloud-sync folder. Per-repo and per-cwd anonymization with deterministic 8-char repo hashes; **unknown repos default to anonymized** so safety doesn't depend on the user remembering to classify every new repo. Integrated as step 5 of `wrap-up`.

### Changed

- `CLAUDE.md` — replaced the single skill design bullet with three principles: WHAT over HOW, KISS, Progressive disclosure.
- `wrap-up` skill — inserted step 5 to invoke `judgment-evidence` between `session-reflect` and `handoff`.
- Plugin manifests: version bumped to 1.4.0 and the description now mentions the Parking Lot canvas.

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
