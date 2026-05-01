---
name: dotfiles-sync
description: Sync and maintain the dotfiles repository for Claude Code and GitHub Copilot config. Use when asked to sync dotfiles, setup dotfiles, repair symlinks, link Claude config, link Copilot config, check dotfiles health, pull dotfiles, commit dotfiles, or push dotfiles.
allowed-tools: Bash, Read, Write, Edit, Grep, Glob
user-invocable: true
---

# Dotfiles Sync

Set up, repair, verify, and git-sync this dotfiles repository from any Claude Code session.

This skill is global because the dotfiles setup links `~/.claude/skills` to this repository's `claude/skills` directory. Once installed, it can be invoked from any working directory.

## Core Responsibilities

- Locate the dotfiles repository from any project.
- Set up or repair symlinks for Claude Code and GitHub Copilot configuration.
- Run safe git sync workflows for the dotfiles repo.
- Report health status in a structured, actionable format.

## Safety Rules

1. Never commit secrets, tokens, cache data, runtime state, project state, or machine-local files.
2. Never overwrite an existing real file or directory without first creating a timestamped backup.
3. Never run destructive git commands such as `reset --hard`, `clean -fd`, or force-push unless the user explicitly asks.
4. Prefer `git pull --ff-only` so sync does not create surprise merge commits.
5. If any JSON or JSONC config is modified or newly linked, validate that the repo-side config parses before reporting success.
6. Treat symlink changes as live config changes; remind the user to restart Claude Code and reload VS Code when relevant.

## Workflow Overview

Run these phases in order unless the user asks for only one specific operation.

1. Resolve the dotfiles repository.
2. Inspect git status.
3. Inspect managed symlinks.
4. Apply requested setup, repair, pull, commit, or push actions.
5. Validate and report.

## Phase 1: Resolve the Dotfiles Repository

Use the hybrid locator. See `reference/location-strategies.md` for rationale and alternatives.

### Candidate validation

A candidate path is this dotfiles repo only if it contains all of these:

- `SETUP.md`
- `CLAUDE.md`
- `claude/settings.json`
- `claude/skills/`
- `copilot/config.json`
- `copilot/mcp-config.json`
- `copilot/prompts/`

### Resolution order

Check candidates in this order and stop at the first valid one:

1. Current git repository root.
2. Existing symlink targets:
   - `~/.claude/skills`
   - `~/.claude/settings.json`
   - `~/.copilot/config.json`
   - `~/.copilot/mcp-config.json`
   - VS Code `User/prompts` directories.
3. Environment variables:
   - `DOTFILES_REPO`
   - `DOTFILES_DIR`
4. Machine-local pointer file:
   - `~/.claude/dotfiles-sync.json`
5. Common paths:
   - `~/dotfiles`
   - `~/src/github/dotfiles`
   - `~/github/dotfiles`
   - `~/repos/dotfiles`
   - Windows equivalents under `%USERPROFILE%`.
6. Ask the user for the path. After validating it, offer to save it to the machine-local pointer file.

### Exact locator commands

Use OS-appropriate commands to collect candidate paths, then validate each candidate against the marker list above.

Current git root:

```bash
git rev-parse --show-toplevel 2>/dev/null
```

Windows PowerShell symlink and pointer checks:

```powershell
$candidates = @()
$paths = @(
  "$env:USERPROFILE\.claude\skills",
  "$env:USERPROFILE\.claude\settings.json",
  "$env:USERPROFILE\.copilot\config.json",
  "$env:USERPROFILE\.copilot\mcp-config.json"
)
foreach ($path in $paths) {
  if (Test-Path -LiteralPath $path) {
    $item = Get-Item -LiteralPath $path -Force
    if ($item.Target) { $candidates += $item.Target }
  }
}
if ($env:DOTFILES_REPO) { $candidates += $env:DOTFILES_REPO }
if ($env:DOTFILES_DIR) { $candidates += $env:DOTFILES_DIR }
$pointer = "$env:USERPROFILE\.claude\dotfiles-sync.json"
if (Test-Path -LiteralPath $pointer) {
  $candidates += (Get-Content -Raw $pointer | ConvertFrom-Json).repoPath
}
$candidates += @(
  "$env:USERPROFILE\dotfiles",
  "$env:USERPROFILE\src\github\dotfiles",
  "$env:USERPROFILE\github\dotfiles",
  "$env:USERPROFILE\repos\dotfiles"
)
$candidates | Where-Object { $_ } | Select-Object -Unique
```

macOS/Linux symlink and pointer checks:

```bash
{
  git rev-parse --show-toplevel 2>/dev/null || true
  for path in "$HOME/.claude/skills" "$HOME/.claude/settings.json" "$HOME/.copilot/config.json" "$HOME/.copilot/mcp-config.json"; do
    [ -L "$path" ] && readlink "$path"
  done
  [ -n "$DOTFILES_REPO" ] && printf '%s\n' "$DOTFILES_REPO"
  [ -n "$DOTFILES_DIR" ] && printf '%s\n' "$DOTFILES_DIR"
  [ -f "$HOME/.claude/dotfiles-sync.json" ] && node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')).repoPath || '')" "$HOME/.claude/dotfiles-sync.json" 2>/dev/null || true
  printf '%s\n' "$HOME/dotfiles" "$HOME/src/github/dotfiles" "$HOME/github/dotfiles" "$HOME/repos/dotfiles"
} | awk 'NF' | sort -u
```

Candidate validation example:

```bash
test -f "<candidate>/SETUP.md" && \
test -f "<candidate>/CLAUDE.md" && \
test -f "<candidate>/claude/settings.json" && \
test -d "<candidate>/claude/skills" && \
test -f "<candidate>/copilot/config.json" && \
test -f "<candidate>/copilot/mcp-config.json" && \
test -d "<candidate>/copilot/prompts"
```

### Pointer file format

Use this file only as machine-local state. Do not add it to this repo.

```json
{
  "repoPath": "/absolute/path/to/dotfiles"
}
```

## Phase 2: Inspect Git Status

After resolving `<repo>`, inspect git state before changing anything.

```bash
git -C "<repo>" status --short --branch
git -C "<repo>" remote -v
```

Interpret the result:

- Clean and behind remote: safe to run `git pull --ff-only` when syncing.
- Clean and ahead of remote: ask before pushing.
- Dirty working tree: list changed files and ask before committing, stashing, or pulling.
- Merge/rebase in progress: stop and report that manual resolution is needed.

## Phase 3: Inspect Managed Links

Managed targets:

| Local target                 | Repo source                      | Type              |
| ---------------------------- | -------------------------------- | ----------------- |
| `~/.claude/skills`           | `<repo>/claude/skills`           | directory symlink |
| `~/.claude/settings.json`    | `<repo>/claude/settings.json`    | file symlink      |
| `~/.copilot/config.json`     | `<repo>/copilot/config.json`     | file symlink      |
| `~/.copilot/mcp-config.json` | `<repo>/copilot/mcp-config.json` | file symlink      |
| VS Code `User/prompts`       | `<repo>/copilot/prompts`         | directory symlink |

For each target, classify status as:

- `CORRECT_LINK`: symlink exists and points to the expected repo source.
- `MISSING`: target does not exist.
- `WRONG_LINK`: target is a symlink but points elsewhere.
- `BROKEN_LINK`: target is a symlink but its source does not exist.
- `REAL_FILE_OR_DIRECTORY`: target exists and is not a symlink.

Inspection commands:

```powershell
Get-Item -LiteralPath "<target>" -Force | Format-List FullName,LinkType,Target,Attributes
```

```bash
if [ -L "<target>" ]; then
  printf 'LINK %s -> %s\n' "<target>" "$(readlink "<target>")"
elif [ -e "<target>" ]; then
  printf 'REAL %s\n' "<target>"
else
  printf 'MISSING %s\n' "<target>"
fi
```

If multiple VS Code user directories exist, ask which prompt directory to manage. Check common directories:

- Windows: `%APPDATA%\Code\User`, `%APPDATA%\Code - Insiders\User`, `%APPDATA%\VSCodium\User`
- macOS: `~/Library/Application Support/Code/User`, `~/Library/Application Support/Code - Insiders/User`, `~/Library/Application Support/VSCodium/User`
- Linux: `~/.config/Code/User`, `~/.config/Code - Insiders/User`, `~/.config/VSCodium/User`

## Phase 4: Apply Requested Actions

### Setup or repair symlinks

Use the commands in `reference/symlink-commands.md`.

Before replacing `REAL_FILE_OR_DIRECTORY` targets, create a timestamped backup next to the original target:

```bash
mv "<target>" "<target>.backup-YYYYMMDD-HHMMSS"
```

On Windows PowerShell, use `Move-Item` with the same suffix pattern.

When repairing a wrong or broken symlink, remove only the symlink itself, then recreate it.

If Windows symlink creation fails with permission errors, stop and report that the user must either enable Developer Mode or rerun from an elevated terminal.

### Pull latest dotfiles

Only pull automatically when the working tree is clean.

```bash
git -C "<repo>" pull --ff-only
```

If the working tree is dirty, report changed files and ask how to proceed.

### Commit dotfiles changes

Before committing:

1. Run `git -C "<repo>" status --short`.
2. Inspect changed files for unsafe content.
3. Validate changed JSON files.
4. Ask for or confirm the commit message.

Never stage ignored files or known sensitive files. Safe synced areas are:

- `claude/settings.json`
- `claude/skills/`
- `copilot/config.json`
- `copilot/mcp-config.json`
- `copilot/prompts/`
- repo documentation such as `README.md`, `SETUP.md`, and `CLAUDE.md`

### Push dotfiles changes

Push only after confirming the branch and ahead status.

```bash
git -C "<repo>" status --short --branch
git -C "<repo>" push
```

## Phase 5: Validate

Run the applicable checks after setup, repair, or git operations.

### JSON / JSONC validation

Validate repo-side config files when present or changed. Some Copilot config files may contain JSONC-style comments, so use strict JSON parsing only when the file is strict JSON.

```bash
python -m json.tool "<repo>/claude/settings.json" > /dev/null
python -m json.tool "<repo>/copilot/config.json" > /dev/null
python -m json.tool "<repo>/copilot/mcp-config.json" > /dev/null
```

If Python is unavailable or a file contains JSONC-style comments, use an available JSONC-compatible parser. If no JSONC parser is available, a conservative fallback for full-line `//` comments is:

```bash
node -e "const fs=require('fs'); for (const f of process.argv.slice(1)) { const s=fs.readFileSync(f,'utf8').replace(/^\s*\/\/.*$/mg,''); JSON.parse(s); console.log(f + ': ok'); }" "<repo>/claude/settings.json" "<repo>/copilot/config.json" "<repo>/copilot/mcp-config.json"
```

### Link validation

Verify every managed target again after changes. Read one linked config and list one linked directory to prove access works.

```bash
cat ~/.claude/settings.json
ls ~/.claude/skills
```

Use OS-appropriate equivalents on Windows if the shell does not support these commands.

## Output Format

Always end with this structured summary:

```text
DOTFILES_SYNC_RESULT: success | partial | failed
DOTFILES_REPO: <absolute path>
RESOLUTION_SOURCE: current-repo | symlink | env | pointer-file | common-path | user-provided

GIT_STATUS:
  BRANCH: <branch>
  CLEAN: yes | no
  AHEAD_BEHIND: <summary>
  CHANGED_FILES: <count and list if dirty>

LINK_STATUS:
  CLAUDE_SKILLS: <status>
  CLAUDE_SETTINGS: <status>
  COPILOT_CONFIG: <status>
  COPILOT_MCP_CONFIG: <status>
  VSCODE_PROMPTS: <status or not-managed>

ACTIONS_TAKEN:
  - <action>

VALIDATION:
  CONFIG_PARSE: pass | fail | skipped
  LINKS: pass | fail | skipped

NEXT_STEPS:
  - <restart or follow-up action>
```

## Edge Cases

- **Repo not found**: Ask for an absolute path and explain the expected repo markers.
- **Multiple dotfiles repos found**: Ask which one to use and offer to save it to the pointer file.
- **Multiple VS Code variants found**: Ask which prompt directory to manage.
- **Existing real configs found**: Back them up before linking.
- **Dirty git state**: Do not pull, commit, or push without user confirmation.
- **Symlink creation denied on Windows**: Report Developer Mode/admin requirement.
- **Config parse validation fails**: Stop and report the failing file before suggesting restart.
- **Skill not visible after setup**: Restart Claude Code and verify `~/.claude/skills/dotfiles-sync/SKILL.md` is reachable.
