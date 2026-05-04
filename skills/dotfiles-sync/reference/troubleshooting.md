# Dotfiles Sync Troubleshooting

## Repository cannot be found

Ask the user for the absolute path to the dotfiles clone, then validate it by checking for repository markers: `SETUP.md`, `CLAUDE.md`, and `copilot/prompts/`.

If valid, offer to save the path to the pointer file (`~/.claude/dotfiles-sync.json` or `~/.copilot/dotfiles-sync.json`).

## Multiple repositories found

List the valid candidates and ask the user which one to use. Offer to save the chosen path as the pointer file.

## Windows symlink creation fails

Common causes:

- Developer Mode is disabled.
- Terminal is not elevated.
- Target already exists.
- Path quoting is incorrect.

Fixes:

1. Enable Windows Developer Mode, or rerun the terminal as Administrator.
2. Back up or remove the existing target as appropriate.
3. Use PowerShell with `cmd /c mklink` and quoted absolute paths.
4. Use `Move-Item -LiteralPath "<target>" -Destination "<target>.backup-YYYYMMDD-HHMMSS"` for backups instead of deleting existing files.

## Existing files block setup

If a target exists and is not a symlink, back it up before linking:

```text
<target>.backup-YYYYMMDD-HHMMSS
```

Never delete existing config without a backup.

## Vestigial symlinks

After the migration from symlinked skills/settings to the plugin system, some machines may still have vestigial symlinks:

- `~/.claude/skills` → was a directory symlink to `<repo>/claude/skills`
- `~/.claude/settings.json` → was a file symlink to `<repo>/claude/settings.json`

These are now listed as "Not Managed" in the target state. If found as symlinks, offer to remove the link. For `settings.json`, restore a real file with the current content before removing the symlink.

## Link points to the wrong clone

Classify it as `WRONG_LINK`. Remove the symlink itself and recreate it to point at the resolved repo.

If the wrong target is a real directory instead of a symlink, back it up first.

## Broken symlink

Classify it as `BROKEN_LINK`. Remove the symlink itself and recreate it if the repo source exists.

If the repo source is missing, stop and report that the dotfiles clone is incomplete or invalid.

## VS Code prompts not syncing

Check whether the user is using Stable, Insiders, or VSCodium. The prompt directory differs by variant.

If multiple variants exist, ask which one to manage.

After changing prompt links, reload VS Code or restart the Copilot session.

## Claude Code plugins not installing

Common issues:

- **Marketplace not registered**: Run `claude plugin marketplace add <url>` first, then `claude plugin install <name>`.
- **Network/auth failure**: Clone the repo locally to `~/.claude/plugins/marketplaces/<name>`, then run `claude plugin marketplace add <local-path>`.
- **Plugin not found after marketplace add**: Check that the marketplace's `marketplace.json` or `plugin.json` lists the plugin name correctly.

## Copilot CLI plugins not installing

Common issues:

- **Plugin source directory not found** (double-nested `plugins/plugins/...`): This is a bug in the marketplace's `marketplace.json`. If `pluginRoot` is set (e.g., `./plugins`), then each plugin's `source` must be relative to that root (e.g., `./ppux-pr-workflow` not `./plugins/ppux-pr-workflow`). Fix the manifest and retry.
- **Plugin name wrong**: Copilot CLI uses the format `<plugin-name>:<marketplace-name>` (e.g., `ppux-pr-workflow:ppux-plugins`). The marketplace name is not the repo name.
- **Update fails**: Use `/plugin update <plugin-name>:<marketplace-name>`.

## JSON / JSONC validation fails

Stop and report the failing file. Do not claim setup is healthy until managed JSON files parse successfully.

Some Copilot config files may contain JSONC-style comments. Use a JSONC-compatible parser when comments are present instead of strict JSON-only parsing.

## Git pull fails

For `git pull --ff-only` failures:

- If local changes exist, report dirty files and ask before committing or stashing.
- If the branch diverged, stop and ask whether the user wants to rebase, merge, or inspect manually.
- If authentication fails, report the remote and ask the user to fix credentials.

## Sensitive files appear in git status

Stop before committing. Sensitive or machine-local paths should not be staged, including:

- Claude auth files
- API-key config files
- caches
- debug logs
- project history
- plugins marketplaces
- local pointer files
