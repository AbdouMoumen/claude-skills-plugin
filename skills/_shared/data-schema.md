# DevBox Status Snapshot — Data Schema

This schema is shared by `devbox-monitor` (writer) and `devbox-report` (reader).

## Top-Level Structure

```json
{
  "schemaVersion": "1.1",
  "hostname": "string",
  "capturedAt": "ISO 8601 timestamp",
  "repos": [ /* RepoSnapshot[] */ ],
  "orphanedAiSessions": [ /* AiSession[] — sessions whose gitRoot/workingDir didn't match any configured repo */ ]
}
```

`orphanedAiSessions` is optional — omit if none detected. Never null.

## RepoSnapshot

```json
{
  "name": "string",
  "path": "string (absolute)",
  "error": "string | null",
  "prSource": "github | ado | unknown",

  "git": {
    "branch": "string",
    "remoteUrl": "string | null",
    "lastCommit": {
      "hashFull": "string",
      "hashShort": "string",
      "message": "string",
      "author": "string",
      "relativeAge": "string (e.g. '2 hours ago')",
      "timestamp": "ISO 8601"
    },
    "remote": {
      "ahead": "number",
      "behind": "number"
    },
    "changes": {
      "staged": "number",
      "unstaged": "number",
      "untracked": "number"
    },
    "stashCount": "number",
    "mostRecentlyModifiedFile": {
      "path": "string | null",
      "lastModified": "ISO 8601 | null"
    },
    "branches": [ /* BranchInfo[] — optional, omit if unavailable */ ]
  },

  "aiSessions": [ /* AiSession[] */ ]
}
```

### BranchInfo (optional)

```json
{
  "name": "string",
  "isCurrent": "boolean",
  "hashFull": "string",
  "hashShort": "string",
  "committed": "ISO 8601",
  "relativeAge": "string",
  "author": "string",
  "subject": "string"
}
```

## AiSession

```json
{
  "source": "inuse-lock",
  "state": "live | stale",
  "processName": "string | null",
  "pid": "number | null",
  "startTime": "ISO 8601 | null",
  "lockTime": "ISO 8601 | null (last lock file write)",
  "sessionId": "string | null (UUID of the Copilot/Claude session folder)",
  "sessionStateDir": "string | null (absolute path to ~/.copilot/session-state/<uuid>)",
  "workingDir": "string | null (cwd from workspace.yaml)",
  "gitRoot": "string | null (git_root from workspace.yaml)",
  "branch": "string | null (branch from workspace.yaml)",
  "repository": "string | null (repository from workspace.yaml)",
  "description": "string | null (summary from workspace.yaml)"
}
```

`state`, `lockTime`, `gitRoot`, `repository`, `branch`, and `sessionId` are optional — emit when detectable, omit otherwise.

### Session-snapshot file (intelligent companion, written by the agent — not the script)

In addition to the mechanical `<hostname>-latest.json`, the agent may write:
- `<hostname>-sessions-latest.md` — narrative report of what each LIVE session is actually doing, derived from the agent reading checkpoints, turn history, and on-disk plan/event artifacts. See `devbox-monitor` SKILL.md Step 6.

## Config File (`machine-local path chosen by the agent (see SKILL.md Step 1)`)

```json
{
  "syncPath": "string (absolute path)",
  "repos": ["string (absolute path)", "..."],
  "hostname": "string",
  "intervalSeconds": "number (default 300 — snapshot cadence)",
  "intelligentReportIntervalSeconds": "number (default 3600 — Step 6 analysis cadence)",
  "repoProviders": {
    "<absolute-repo-path>": "github | ado | unknown"
  }
}
```

`repoProviders` is optional. Used as a fallback when the provider cannot be auto-detected from the remote URL.

## Field Notes

- `error`: if a repo path doesn't exist or isn't a git repo, set this field and leave other fields null.
- `aiSessions`: may be empty array if no sessions detected; never null. Sessions in this array are correlated to the repo via `gitRoot` (preferred) or `workingDir`. Matching requires an exact path equality or that the session path lives under the repo path with a path separator (i.e. `C:\repo10` does NOT match `C:\repo1`).
- `orphanedAiSessions` (top-level): live or stale sessions whose `gitRoot`/`workingDir` did not match any configured repo. Surfaced so consumers can still see and clean up leaked locks for unconfigured repos.
- `prSource`: always set — tells the report which CLI to use for PR cross-referencing and what auth hint to show if PRs are unavailable. Detected from `git.remoteUrl`; falls back to `repoProviders` config entry; defaults to `"unknown"`.
- `git.branches[]`: optional — omit entirely if the monitor cannot enumerate branches cheaply. Sort by `committed` descending. Implementations may cap the list (e.g. top 50) for very busy repos.
- All timestamps in ISO 8601 / UTC.
- **Live vs stale sessions**: a session with `state: "stale"` has a leaked `inuse.<pid>.lock` whose PID is no longer running. Consumers (e.g. devbox-report) should distinguish these visually and offer cleanup hints.

## Removed Fields (schema v1.0 → v1.1)

- `pullRequests[]` — removed. PR data is now fetched live by `devbox-report` at report-generation time using `gh pr list --author @me` (GitHub) or `az repos pr list --creator @me` (ADO). The `prSource` field on each repo tells the report which provider to use.
