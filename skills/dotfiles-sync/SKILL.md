---
name: dotfiles-sync
description: Sync and maintain the dotfiles repository for Claude Code and GitHub Copilot config. Use when asked to sync dotfiles, setup dotfiles, check dotfiles health, pull dotfiles, commit dotfiles, push dotfiles, or install plugins.
allowed-tools: Bash, Read, Write, Edit, Grep, Glob
user-invocable: true
---

# Dotfiles Sync

A desired-state reconciler for dotfiles configuration. Inspects the current machine, compares it against the target state defined below, and proposes an action plan to close the gap.

Works from both **Claude Code** and **GitHub Copilot CLI**.

## Safety Rules

1. Never commit secrets, tokens, cache data, runtime state, project state, or machine-local files.
2. Never overwrite an existing real file or directory without first creating a timestamped backup.
3. Never run destructive git commands such as `reset --hard`, `clean -fd`, or force-push unless the user explicitly asks.
4. Prefer `git pull --ff-only` so sync does not create surprise merge commits.
5. If any JSON or JSONC config is modified or newly linked, validate that the repo-side config parses before reporting success.
6. Treat symlink changes as live config changes; remind the user to restart Claude Code and reload VS Code when relevant.

---

## Target State

This section is the source of truth for what a correctly configured machine looks like.

### Symlinks

| Target Path | Repo Source | Type | Required |
|-------------|------------|------|----------|
| `<vscode>/prompts` | `copilot/prompts` | directory | yes |
| `~/.copilot/mcp-config.json` | `copilot/mcp-config.json` | file | no (skip if source absent in repo) |

### Not Managed (machine-local — must NOT be symlinks)

| Path | Reason |
|------|--------|
| `~/.claude/settings.json` | Machine-specific: plugins, model, telemetry config, local marketplace paths |
| `~/.copilot/config.json` | Runtime state: logged-in users, trusted folders, plugin cache paths |
| `~/.claude/skills` | Vestigial: skills are now delivered via the plugin system |

If any of these paths are symlinks, the skill should flag them as `VESTIGIAL_LINK` and offer to remove the symlink (restoring a real file if appropriate).

### Required Plugins — Claude Code

| Plugin | Marketplace URL |
|--------|----------------|
| `claude-skills` | `https://github.com/AbdouMoumen/claude-skills-plugin` |
| `ai-debugger` | `https://github.com/AbdouMoumen/ai-debugger` |

### Required Plugins — Copilot CLI

| Plugin | Marketplace |
|--------|------------|
| `ppux-pr-workflow` | `ppux-plugins` |
| `devbox` | `ppux-plugins` |
| `session-analyzer` | `ppux-plugins` |

### Path Variables

- `~` → `$HOME` (macOS/Linux) or `%USERPROFILE%` (Windows)
- `<vscode>` → detected VS Code User directory; check in order:
  - Windows: `%APPDATA%\Code\User`, `%APPDATA%\Code - Insiders\User`, `%APPDATA%\VSCodium\User`
  - macOS: `~/Library/Application Support/Code/User`, `~/Library/Application Support/Code - Insiders/User`
  - Linux: `~/.config/Code/User`, `~/.config/Code - Insiders/User`
  - If multiple exist, ask the user which to manage
- `<repo>` → resolved dotfiles repo path

---

## Workflow

Run these phases in order unless the user asks for only one specific operation.

### Phase 1: Resolve the Dotfiles Repository

Use the hybrid locator. See `reference/location-strategies.md` for rationale and alternatives.

#### Candidate validation

A candidate path is this dotfiles repo only if it contains all of these:

- `SETUP.md`
- `CLAUDE.md`
- `copilot/prompts/`

#### Resolution order

Check candidates in this order and stop at the first valid one:

1. Current git repository root.
2. Existing symlink targets:
   - `~/.copilot/mcp-config.json`
   - VS Code `User/prompts` directories
3. Environment variables:
   - `DOTFILES_REPO`
   - `DOTFILES_DIR`
4. Machine-local pointer file:
   - `~/.claude/dotfiles-sync.json` (or `~/.copilot/dotfiles-sync.json` for Copilot CLI)
5. Common paths:
   - `~/dotfiles`
   - `~/src/github/dotfiles`
   - `~/github/dotfiles`
   - `~/repos/dotfiles`
   - Windows equivalents under `%USERPROFILE%`
6. Ask the user for the path. After validating it, offer to save it to the machine-local pointer file.

#### Exact locator commands

Windows PowerShell:

```powershell
$candidates = @()
$paths = @(
  "$env:USERPROFILE\.copilot\mcp-config.json",
  "$env:APPDATA\Code\User\prompts"
)
foreach ($path in $paths) {
  if (Test-Path -LiteralPath $path) {
    $item = Get-Item -LiteralPath $path -Force
    if ($item.Target) { $candidates += $item.Target }
  }
}
if ($env:DOTFILES_REPO) { $candidates += $env:DOTFILES_REPO }
if ($env:DOTFILES_DIR) { $candidates += $env:DOTFILES_DIR }
$pointerPaths = @("$env:USERPROFILE\.claude\dotfiles-sync.json", "$env:USERPROFILE\.copilot\dotfiles-sync.json")
foreach ($p in $pointerPaths) {
  if (Test-Path -LiteralPath $p) {
    $candidates += (Get-Content -Raw $p | ConvertFrom-Json).repoPath
  }
}
$candidates += @(
  "$env:USERPROFILE\dotfiles",
  "$env:USERPROFILE\src\github\dotfiles",
  "$env:USERPROFILE\github\dotfiles",
  "$env:USERPROFILE\repos\dotfiles"
)
$candidates | Where-Object { $_ } | Select-Object -Unique
```

macOS/Linux:

```bash
{
  git rev-parse --show-toplevel 2>/dev/null || true
  for path in "$HOME/.copilot/mcp-config.json"; do
    [ -L "$path" ] && readlink "$path"
  done
  for vscode_dir in "$HOME/Library/Application Support/Code/User" "$HOME/.config/Code/User"; do
    [ -L "$vscode_dir/prompts" ] && readlink "$vscode_dir/prompts"
  done
  [ -n "$DOTFILES_REPO" ] && printf '%s\n' "$DOTFILES_REPO"
  [ -n "$DOTFILES_DIR" ] && printf '%s\n' "$DOTFILES_DIR"
  for p in "$HOME/.claude/dotfiles-sync.json" "$HOME/.copilot/dotfiles-sync.json"; do
    [ -f "$p" ] && node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).repoPath||'')" "$p" 2>/dev/null || true
  done
  printf '%s\n' "$HOME/dotfiles" "$HOME/src/github/dotfiles" "$HOME/github/dotfiles" "$HOME/repos/dotfiles"
} | awk 'NF' | sort -u
```

Candidate validation:

```bash
test -f "<candidate>/SETUP.md" && \
test -f "<candidate>/CLAUDE.md" && \
test -d "<candidate>/copilot/prompts"
```

#### Pointer file format

Machine-local state only. Do not add to the repo.

```json
{
  "repoPath": "/absolute/path/to/dotfiles"
}
```

### Phase 2: Inspect Git Status

After resolving `<repo>`, inspect git state before changing anything.

```bash
git -C "<repo>" status --short --branch
git -C "<repo>" remote -v
```

Interpret the result:

- Clean and behind remote → safe to auto-pull with `git pull --ff-only`.
- Clean and ahead of remote → ask before pushing.
- Dirty working tree → list changed files and ask before committing, stashing, or pulling.
- Merge/rebase in progress → stop and report that manual resolution is needed.

### Phase 3: Collect Current State and Diff Against Target

For each category in the Target State above, inspect the current machine and classify.

#### Symlinks

For each row in the Symlinks table, check the target path:

- `CORRECT_LINK`: symlink exists and points to `<repo>/<source>`.
- `MISSING`: target does not exist. If the source also doesn't exist in the repo and the item is not required, skip it.
- `WRONG_LINK`: symlink exists but points to a different path.
- `BROKEN_LINK`: symlink exists but its target no longer exists.
- `REAL_FILE_OR_DIRECTORY`: target exists and is not a symlink.

Inspection (Windows PowerShell):

```powershell
Get-Item -LiteralPath "<target>" -Force | Format-List FullName,LinkType,Target,Attributes
```

Inspection (macOS/Linux):

```bash
if [ -L "<target>" ]; then
  printf 'LINK %s -> %s\n' "<target>" "$(readlink "<target>")"
elif [ -e "<target>" ]; then
  printf 'REAL %s\n' "<target>"
else
  printf 'MISSING %s\n' "<target>"
fi
```

#### Not-Managed Items

For each path in the Not Managed table, verify it is NOT a symlink:

- `OK`: path is a real file/directory or doesn't exist (correct state).
- `VESTIGIAL_LINK`: path is a symlink (should have been removed in migration).

#### Plugins — Claude Code

Only check when running in Claude Code. Detect by checking if `claude` CLI is available.

```bash
claude plugin list 2>/dev/null
```

For each row in the Claude Code plugins table:
- `INSTALLED`: plugin is listed and enabled.
- `DISABLED`: plugin is listed but disabled.
- `MISSING`: plugin is not listed.
- `MARKETPLACE_MISSING`: the marketplace is not registered.

#### Plugins — Copilot CLI

Only check when running in Copilot CLI. The skill cannot run `/plugin` commands programmatically, so inspect the filesystem:

```powershell
Get-ChildItem "$env:USERPROFILE\.copilot\installed-plugins\<marketplace>\<plugin>" -ErrorAction SilentlyContinue
```

For each row in the Copilot CLI plugins table:
- `INSTALLED`: plugin directory exists.
- `MISSING`: plugin directory does not exist.

### Phase 4: Present Action Plan

Build a plan from the diff results. Group actions by safety level:

#### Auto-apply (safe)

| Action | When |
|--------|------|
| `git pull --ff-only` | Repo is clean and behind remote |
| Create symlink | Target is `MISSING` and source exists in repo |
| Install plugin marketplace | Marketplace is `MISSING` (Claude Code only) |
| Install/enable plugin | Plugin is `MISSING` or `DISABLED` (Claude Code only) |

#### Ask first (destructive)

| Action | When |
|--------|------|
| Backup + replace real file/dir with symlink | Target is `REAL_FILE_OR_DIRECTORY` |
| Remove broken/wrong symlink + recreate | Target is `BROKEN_LINK` or `WRONG_LINK` |
| Remove vestigial symlink | Not-managed item is `VESTIGIAL_LINK` |
| Commit dirty changes | Repo has uncommitted changes |
| Push commits | Repo is ahead of remote |

#### User commands (Copilot CLI plugins)

The skill cannot install Copilot CLI plugins programmatically. Instead, output the exact commands:

```text
Run these commands to install missing Copilot CLI plugins:
  /plugin install ppux-pr-workflow:ppux-plugins
  /plugin install devbox:ppux-plugins
  /plugin install session-analyzer:ppux-plugins
```

### Phase 5: Execute Plan

1. Auto-apply all safe actions.
2. Present destructive actions and wait for user confirmation.
3. Skip optional items where the source doesn't exist in the repo.
4. For Copilot CLI plugins, print the commands for the user to run.

Use the commands in `reference/symlink-commands.md` for symlink operations.

Before replacing `REAL_FILE_OR_DIRECTORY` targets, create a timestamped backup:

```powershell
Move-Item -LiteralPath "<target>" -Destination "<target>.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
```

```bash
mv "<target>" "<target>.backup-$(date +%Y%m%d-%H%M%S)"
```

If Windows symlink creation fails with permission errors, stop and report that the user must either enable Developer Mode or rerun from an elevated terminal.

### Phase 6: Validate and Report

After executing actions, re-inspect all targets to confirm they are in the correct state.

#### JSON / JSONC validation

Validate any linked JSON config files:

```bash
node -e "const fs=require('fs'); for (const f of process.argv.slice(1)) { if (!fs.existsSync(f)) continue; const s=fs.readFileSync(f,'utf8').replace(/^\s*\/\/.*$/mg,''); JSON.parse(s); console.log(f + ': ok'); }" "<repo>/copilot/mcp-config.json"
```

#### Link validation

Verify every managed symlink points to the correct target and is readable.

#### Output format

Always end with this structured summary:

```text
DOTFILES_SYNC_RESULT: success | partial | failed
DOTFILES_REPO: <absolute path>
RESOLUTION_SOURCE: current-repo | symlink | env | pointer-file | common-path | user-provided
ENVIRONMENT: claude-code | copilot-cli

GIT_STATUS:
  BRANCH: <branch>
  CLEAN: yes | no
  AHEAD_BEHIND: <summary>

SYMLINKS:
  VSCODE_PROMPTS: <status>
  COPILOT_MCP_CONFIG: <status>

NOT_MANAGED:
  CLAUDE_SETTINGS: <ok | vestigial_link>
  COPILOT_CONFIG: <ok | vestigial_link>
  CLAUDE_SKILLS: <ok | vestigial_link>

PLUGINS_CLAUDE:
  claude-skills: <installed | missing | disabled>
  ai-debugger: <installed | missing | disabled>

PLUGINS_COPILOT:
  ppux-pr-workflow: <installed | missing>
  devbox: <installed | missing>
  session-analyzer: <installed | missing>

DRIFT_FIXED:
  - <action taken>

DRIFT_REMAINING:
  - <items skipped or declined>

NEXT_STEPS:
  - <restart, reload, or manual commands needed>
```

---

## Git Operations

The skill also supports explicit git operations when the user asks:

### Commit dotfiles changes

Before committing:

1. Run `git -C "<repo>" status --short`.
2. Inspect changed files for unsafe content (no secrets, no machine-local state).
3. Validate changed JSON files.
4. Ask for or confirm the commit message.

Safe synced areas:

- `copilot/mcp-config.json`
- `copilot/prompts/`
- Repo documentation: `README.md`, `SETUP.md`, `CLAUDE.md`

### Push dotfiles changes

Push only after confirming the branch and ahead status.

```bash
git -C "<repo>" status --short --branch
git -C "<repo>" push
```

---

## Edge Cases

- **Repo not found**: Ask for an absolute path and explain the expected repo markers (`SETUP.md`, `CLAUDE.md`, `copilot/prompts/`).
- **Multiple dotfiles repos found**: Ask which one to use and offer to save it to the pointer file.
- **Multiple VS Code variants found**: Ask which prompt directory to manage.
- **Existing real configs in symlink targets**: Back them up before linking.
- **Dirty git state**: Do not pull, commit, or push without user confirmation.
- **Symlink creation denied on Windows**: Report Developer Mode/admin requirement.
- **Config parse validation fails**: Stop and report the failing file before suggesting restart.
- **Plugin marketplace path bug**: If Copilot CLI plugin install fails with double-nested paths (`plugins/plugins/...`), check the marketplace's `marketplace.json` for `pluginRoot` vs `source` path overlap.
