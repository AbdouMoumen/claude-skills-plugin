# Platform Playbook: Plugin Listing and Updates

This file is the runtime reference for `plugin-updater`.

It is intentionally mutable: when the CLI/API surface changes, the skill updates this file so future runs use the latest known behavior.

## Update Contract

When runtime behavior differs from this file:
1. Update the affected platform section (`list_strategy`, `update_strategy`, `parse_hints`, and fallback notes).
2. Set `last_verified` to the current ISO-8601 timestamp.
3. Append one entry to `Learning Log` with what changed and why.

Keep guidance intent-focused. Avoid platform-specific implementation details unless they are required for correctness.

---

## Platform: claude-code

- `runtime_detection`: Run `claude --version`, then verify plugin namespace with `claude plugin --help`.
- `list_strategy`: Run `claude plugin list` and parse plugin entries as fully qualified IDs (`<plugin>@<marketplace>`) with inline `Version`, `Scope`, and `Status`.
- `update_strategy`: Use per-plugin updates only: `claude plugin update <plugin@marketplace>`. Bare plugin names can fail even when listed as installed.
- `fallback_discovery`: If command behavior drifts, inspect `claude plugin --help` and `claude plugin update --help` before retrying updates.
- `parse_hints`: Keep both `plugin_id` (base name) and `source` (marketplace suffix from `@...`). Treat `Status: enabled` as enabled state.
- `compatibility_notes`: If command surfaces change, keep prior behavior only as fallback documentation.
- `last_verified`: 2026-06-16T16:09:24Z

## Platform: copilot-cli

- `runtime_detection`: Run `copilot --version`, then verify plugin namespace with `copilot plugin --help`.
- `list_strategy`: Run `copilot plugin list` and parse bullet entries (`name` or `name@marketplace`) with `(v<version>)`.
- `update_strategy`: Use per-plugin updates: `copilot plugin update <name>`. For marketplace-qualified installs, plain names are accepted (for example, `devbox` for `devbox@ppux-plugins`).
- `fallback_discovery`: If command behavior drifts, inspect `copilot plugin --help` and `copilot plugin update --help` before retrying updates.
- `parse_hints`: If plugin includes `@marketplace`, split into `plugin_id` and `source`. If no state field is present in output, set state to `unknown`.
- `compatibility_notes`: If command surfaces change, keep prior behavior only as fallback documentation.
- `last_verified`: 2026-06-16T16:09:24Z

---

## Learning Log

Append newest entries at the top.

### 2026-06-16T16:09:24Z
- change: learned concrete list/update command behavior from live runtimes
- platforms: claude-code, copilot-cli
- reason: Claude requires fully qualified plugin IDs (`name@marketplace`) for updates; Copilot accepts plain names for updates

### 2026-06-16T00:00:00Z
- change: playbook initialized
- platforms: claude-code, copilot-cli
- reason: bootstrap baseline for self-learning plugin update workflow
