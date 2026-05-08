---
name: devbox-monitor
description: 'Continuously monitor AI agent activity and repo health across configured repos on a timer. Writes timestamped JSON status files to a shared sync path for use by devbox-report.'
argument-hint: '[--config] to reconfigure; [--once] to run a single snapshot instead of looping'
---

# DevBox Monitor

> ⚠ **This skill runs forever.** It loops indefinitely — collecting git state, detecting AI sessions, and writing snapshot files on every cycle. The `--once` flag is the only way to run a single pass. Do not stop after the first snapshot.

Runs on a configurable timer, repeatedly snapshotting AI agent activity and repo state and writing results to a shared sync path. Runs until the session is ended or interrupted (Ctrl+C).

## Implementation note

The mechanical data collection in Steps 2–5 is a deterministic loop with no per-iteration LLM judgment required. Implementations SHOULD extract those steps into a standalone PowerShell/Bash script saved under the agent's session workspace and invoke it as a long-running background process via the agent's async-shell facility. This keeps the monitor running without consuming agent tokens per cycle and lets it survive agent idleness.

A working PowerShell reference implementation of Steps 2–5 ships alongside this file as [`devbox-snapshot.ps1`](./devbox-snapshot.ps1). Agents may copy/adapt it (e.g. translate to Bash, change the config path) rather than reimplementing from scratch.

The agent remains responsible for: initial config setup (Step 1), launching the script, and running Step 6 (the intelligent companion report) **on a scheduled cadence** — by default every hour, configurable via `intelligentReportIntervalSeconds`. Step 6 runs for the first time after the first snapshot cycle completes, then repeats on schedule. Both loops run forever; neither is on-demand.

## Step 1 — Load Config

The config file must be stored in a **machine-local, non-synced location** — it must NOT live inside the skill folder, since the skills directory is synced across machines and the config is machine-specific (different repos, hostname, paths per machine).

Choose a suitable location based on the agent/environment:
- On Copilot CLI: use `~/.copilot/devbox-monitor-config.json`
- On Claude: use `~/.claude/devbox-monitor-config.json`
- If neither applies, use `~/.config/devbox-monitor/config.json`
- The location must be outside any synced directory (not under `~/.claude/skills/`, `~/.copilot/skills/`, OneDrive, etc.)

Read the config from that path. If the file does not exist, or if `--config` was passed as the argument, run setup:
- Ask the user for `syncPath` (absolute path where status files should be written/synced)
- Ask the user for `repos` (list of absolute repo paths to monitor)
- Ask the user for `intervalSeconds` (how often to snapshot; suggest 300 as default = 5 minutes)
- Ask the user for `intelligentReportIntervalSeconds` (how often to run the Step 6 intelligent analysis; suggest 3600 as default = 1 hour)
- Detect and store `hostname` (run `hostname` shell command)
- Write the config to the chosen path and tell the user where it was saved

After setup (or on every loop iteration after config load), proceed to **Step 2**.

## Step 2 — Collect Data Per Repo

For each path in `repos`, run the following shell commands and capture output. **The snippets below are PowerShell** — translate `2>$null`, `Get-*`, etc. for Bash/POSIX equivalents as needed. If a repo path doesn't exist or is not a git repo, record an error and skip it.

```
git -C <path> branch --show-current
git -C <path> log -1 --pretty=format:"%H|%h|%s|%an|%ar|%aI"
git -C <path> status --porcelain
git -C <path> stash list
git -C <path> rev-list --count --left-right HEAD...@{u} 2>$null
git -C <path> remote get-url origin 2>$null
git -C <path> for-each-ref --sort=-committerdate --format='%(refname:short)|%(objectname)|%(objectname:short)|%(committerdate:iso-strict)|%(committerdate:relative)|%(authorname)|%(subject)' refs/heads/
```

Parse results into the schema defined in [../_shared/data-schema.md](../_shared/data-schema.md).

**Staged/unstaged/untracked counts**: from `git status --porcelain`, parse the two-character status prefix. The first column is the index (staged) state, the second is the worktree (unstaged) state. Lines starting with `??` are untracked. A line with both columns dirty (e.g. `MM`) counts in both staged and unstaged.

**Ahead/behind**: `rev-list --count --left-right HEAD...@{u}` returns two whitespace-separated numbers — left is ahead, right is behind.

**Time since last commit**: derive from the ISO timestamp in git log output vs. now.

**Most recently modified tracked file**: run `git -C <path> ls-files --modified`, then `Get-Item` each to find the newest `LastWriteTime`. Store path relative to the repo root.

**Branches**: parse each line of `for-each-ref` output (pipe-separated). Mark `isCurrent: true` when the branch name matches the current branch. Implementations may cap the list at 50 for very large repos.

### Provider Detection and `prSource`

For each repo, detect its git provider from the remote URL:

1. Run `git -C <path> remote get-url origin` to get the remote URL.
2. Classify:
   - URL contains `github.com` → `prSource: "github"`
   - URL contains `dev.azure.com` or `.visualstudio.com` → `prSource: "ado"`
   - Anything else → `prSource: "unknown"`
3. If the URL is empty or the command fails, check `config.repoProviders[<path>]` as fallback.
4. If still unclassified, set `prSource: "unknown"`.

Store `prSource` on the RepoSnapshot. Do **not** call `gh pr list` or `az repos pr list` in the monitor — PR data is fetched live by the report at generation time.

## Step 3 — Detect Active AI Sessions (canonical method)

> This step runs on **every loop iteration**, not just the first. AI session state changes frequently.

Copilot/Claude write a sentinel file `inuse.<PID>.lock` inside each session folder while it is open. This is the canonical "in use" marker — the same one `copilot resume` reads. **Use this instead of process-name scanning or recent-mtime heuristics** (the older heuristics produced false positives and missed live sessions).

For each lock found at `~/.copilot/session-state/<uuid>/inuse.<PID>.lock`:

1. Extract `PID` from the filename.
2. Check whether the process is alive: `Get-Process -Id <PID> -ErrorAction SilentlyContinue`.
   - Alive → `state: "live"`.
   - Not alive → `state: "stale"` (the lock leaked from a crashed/killed instance).
3. Read `~/.copilot/session-state/<uuid>/workspace.yaml` for canonical attribution. The file is a flat YAML written by the Copilot CLI when the session was created and contains:
   ```yaml
   id: <uuid>
   cwd: <absolute path>
   git_root: <absolute path or absent>
   repository: <owner/repo or ADO path, when applicable>
   branch: <branch name>
   summary: <human-readable session title>
   ```
4. Emit an `AiSession` record per the schema. Include both live and stale sessions (consumers may filter).

To attribute a session to a configured repo, prefer `gitRoot` (canonical) over `workingDir`. Match case-insensitively, requiring either path equality or that the session path lives under the repo path with a path separator boundary (so `C:\repo10` does not match `C:\repo1`). Sessions that don't match any configured repo MUST still be emitted — collect them under a top-level `orphanedAiSessions` field so leaked locks for unconfigured repos remain visible.

```powershell
# Reference implementation
$sessRoot = "$env:USERPROFILE\.copilot\session-state"
Get-ChildItem $sessRoot -Recurse -Force -File -Filter 'inuse.*.lock' | ForEach-Object {
  $sessionDir = $_.Directory
  $sessionId  = $sessionDir.Name
  $pid_       = if ($_.Name -match '^inuse\.(\d+)\.lock$') { [int]$matches[1] } else { $null }
  $alive      = [bool](Get-Process -Id $pid_ -ErrorAction SilentlyContinue)
  $workspace  = Join-Path $sessionDir.FullName 'workspace.yaml'
  # parse workspace.yaml for cwd / git_root / branch / summary / repository
  # emit AiSession record
}
```

Cleanup hint: stale locks are safe to delete (`Remove-Item ~/.copilot/session-state/<uuid>/inuse.<PID>.lock`). The skill MUST NOT delete them automatically — surface them in the report and let `devbox-report` or the user decide.

## Step 4 — Write Output

Construct the full snapshot object per the [data schema](../_shared/data-schema.md).

Write two files:
- `<syncPath>/<hostname>-latest.json` — always overwritten with the current snapshot
- `<syncPath>/<hostname>-<ISO-timestamp>.json` — archive copy (replace `:` with `-` in timestamp for filename safety)

If `syncPath` directory does not exist, create it.

## Step 5 — Summarize and Loop

After writing, print a single-line status to the user:
```
[HH:MM:SS] OK N repos | B branches | L live sessions (S stale, O orphaned) | C repos w/ changes -> <syncPath> | next snapshot Xs | next analysis Ym
```

Where `S` is the total count of sessions in `state: stale` (across both attributed and orphaned), `O` is the count of `orphanedAiSessions`, `Xs` is seconds until the next snapshot cycle, and `Ym` is minutes until the next Step 6 analysis (show `now` on the first cycle).

If `--once` was passed as the argument, stop here.

Otherwise, run:
```powershell
Start-Sleep -Seconds <intervalSeconds>
```

**Go back to Step 2** and repeat — both the static git collection (Step 2) and the intelligent session detection (Step 3) run every cycle. The loop continues until the user ends the session or presses Ctrl+C.

**Step 6 cadence**: Track the timestamp of the last Step 6 run (start with `$lastIntelligentReport = $null`). After each `Start-Sleep`, before going back to Step 2, check:
- If `$lastIntelligentReport` is null (first cycle) OR elapsed time since last run ≥ `intelligentReportIntervalSeconds` → run Step 6, then update `$lastIntelligentReport` to now.

Include the next Step 6 run time in the status line:
```
[HH:MM:SS] OK N repos | B branches | L live sessions (S stale, O orphaned) | C repos w/ changes -> <syncPath> | next snapshot Xs | next analysis Ym
```
Where `Ym` is the minutes until the next Step 6 run (or `now` on the first cycle).

Suppress full summaries on subsequent iterations — only print the one-line status each cycle to avoid flooding the conversation. If any repo that previously had no errors now has one (or vice versa), or if a session transitions live→stale, note that change on the next cycle.

## Step 6 — Optional Intelligent Companion Report

The mechanical snapshot in Step 4 captures structured data well, but it does NOT capture *what each live session is actually doing*. That requires reading session checkpoints, recent turns, and on-disk plan/event artifacts — work that is the agent's strength, not a script's.

When the user asks for a session-level report (or proactively, after Step 4 if it's been > N hours since the last one), the agent SHOULD additionally:

1. For each `state: "live"` session in the just-written snapshot:
   - Read the latest file under `~/.copilot/session-state/<uuid>/checkpoints/` (highest-numbered `NNN-*.md`) for `title`, `overview`, and `next_steps`.
   - If a global Copilot session_store is available (typically `~/.copilot/session-store.db` SQLite), query the most recent `turns` row for that session to get the last user message and assistant response.
   - Read `plan.md` and `events.jsonl` mtime as activity signals.
2. Synthesize a per-session narrative covering: what the session is doing, last activity / how long it's been idle, the latest checkpoint title and its `next_steps`, and any blockers (e.g. "waiting on user decision", "watching CI for PR #X").
3. Identify cross-cutting observations (e.g. "two sessions blocked on the same flake", "session X is parked on a deleted branch").
4. List stale `inuse.*.lock` files and recommend cleanup.
5. Write the report to `<syncPath>/<hostname>-sessions-latest.md` (overwrite each time) and optionally an archived copy `<hostname>-sessions-<ISO-timestamp>.md`.

This step is **part of the timer loop**, running automatically on a slower cadence than the snapshot loop. It runs for the first time after the first snapshot cycle completes (after the first `Start-Sleep`, when `$lastIntelligentReport` is null), then every `intelligentReportIntervalSeconds` thereafter (default: 3600 = 1 hour). This ordering ensures Step 6 always has a fresh snapshot to read. The cadence exists to limit token cost, not to make this on-demand — both loops run forever.
