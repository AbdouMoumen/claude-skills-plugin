# Dotfiles Sync Troubleshooting

## Repository cannot be found

Ask the user for the absolute path to the dotfiles clone, then validate it by checking for repository markers such as `SETUP.md`, `CLAUDE.md`, `claude/settings.json`, and `copilot/config.json`.

If valid, offer to save the path to `~/.claude/dotfiles-sync.json`.

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

## Claude skills not loading

Check that `~/.claude/skills/dotfiles-sync/SKILL.md` is reachable through the symlink.

Then restart Claude Code. Skills are loaded at session startup.

## JSON / JSONC validation fails

Stop and report the failing file. Do not claim setup is healthy until these parse successfully:

- `claude/settings.json`
- `copilot/config.json`
- `copilot/mcp-config.json`

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
