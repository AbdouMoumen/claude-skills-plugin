# Schema reference

The judgment evidence store is **always split** across two JSONL files joined by `id`. This document specifies every field, where it lives, and how anonymization affects it.

## Files

| File | Default location | Purpose |
|---|---|---|
| Main store | `~/.agents/judgment-evidence.jsonl` (or `JUDGMENT_EVIDENCE_PATH` env > `store_path` in config) | Shareable: paraphrased prose, no machine-local fields |
| Sidecar | `~/.agents-local/judgment-evidence.local.jsonl` (or `local_path` in config) | Machine-local: verbatim text + cwd / branch / session id. Lives in a **separate directory** from the main store so it can't be accidentally synced when the user backs `~/.agents/` with a private repo or cloud-sync folder. |
| Config | next to the resolved main store, named `judgment-evidence.config.json` | `store_path`, `local_path`, `skip_repos`, `anonymize` rules |

Expand `~` to the platform home directory before any file operation. Never write to a literal `~` directory. If the resolved sidecar path is in the same directory tree as the resolved main store, refuse to write — the no-sync guarantee depends on directory separation.

## Main store entry shape

One JSON object per line:

```json
{
  "id": "2026-06-11T17-13-44Z-a3f2",
  "captured_at": "2026-06-11T17:13:44-05:00",
  "kind": "confirmed",
  "category": "course-correction",
  "summary": "User vetoed a proposed refactor of an auth module, flagging it as load-bearing for a legacy webhook path.",
  "user_signal": "User pushed back on the refactor proposal and named the specific downstream consumer that would break.",
  "agent_context": "Agent had drafted a multi-file refactor and was about to apply it.",
  "why_it_was_good": "Prevented a regression in a downstream integration the agent had no visibility into.",
  "project": { "repo": "owner/repo-name" },
  "session": { "platform": "claude-code" },
  "anonymized": false
}
```

The example above shows an entry the user has explicitly promoted to plain capture during a previous review (full repo name, `anonymized: false`). A freshly-captured entry from a repo with no matching rule looks like the anonymized variant below.

Anonymized variant — same shape, with these differences:

```json
{
  "...": "...",
  "summary": "User vetoed a proposed refactor citing a load-bearing dependency the agent could not see.",
  "user_signal": "User pushed back on a refactor proposal and named a specific downstream consumer that would break.",
  "agent_context": "Agent had drafted a multi-file refactor and was about to apply it.",
  "project": { "repo": "repo:7a3f1c2e" },
  "anonymized": true
}
```

## Sidecar entry shape

One JSON object per line, joined to the main store by `id`:

```json
{
  "id": "2026-06-11T17-13-44Z-a3f2",
  "project": {
    "repo": "owner/repo-name",
    "branch": "feat/something",
    "cwd": "D:\\src\\..."
  },
  "session": { "id": "<session-id-if-available>" },
  "user_signal_verbatim": "<exact user message>",
  "agent_context_verbatim": "<exact agent action or plan text>"
}
```

A sidecar entry is written for **every** capture — plain or anonymized — so the local picture is always full-fidelity.

## Field-by-field split

| Field | Main | Sidecar | Anonymized treatment |
|---|---|---|---|
| `id` | ✓ | ✓ | unchanged |
| `captured_at` | ✓ | — | unchanged |
| `kind` | ✓ | — | `"confirmed"` (write automatically) or `"candidate"` (surface for review only) |
| `category` | ✓ | — | unchanged |
| `summary` | ✓ | — | paraphrased; stricter rules — no proper nouns, no identifying terms |
| `why_it_was_good` | ✓ | — | paraphrased same as summary; if it can't be stated concretely without leaking, drop the field (and consider dropping the entry) |
| `user_signal` | ✓ | — | paraphrased; stricter rules when anonymized |
| `agent_context` | ✓ | — | paraphrased; stricter rules when anonymized |
| `user_signal_verbatim` | — | ✓ | unchanged |
| `agent_context_verbatim` | — | ✓ | unchanged |
| `project.repo` | ✓ | ✓ | main: `repo:<sha256(repo)[:8]>`; sidecar: full repo |
| `project.branch` | — | ✓ | unchanged |
| `project.cwd` | — | ✓ | unchanged |
| `session.platform` | ✓ | — | unchanged |
| `session.id` | — | ✓ | unchanged |
| `anonymized` | ✓ | — | `true` when a `skip`/`anonymize` rule matched OR the repo had no matching rule (anonymized-by-default). `false` only when the user explicitly promoted the entry to plain during a review. |

If a paraphrased field would be empty or fabricated, **omit it from the main store entry**. Do not write neutral filler.

## ID format

`<UTC ISO timestamp with colons replaced by hyphens, second resolution>-<4 hex chars random>`

Example: `2026-06-11T17-13-44Z-a3f2`

Timestamp first, so a `sort` on the file yields chronological order. Random suffix guards against same-second collisions when two sessions write simultaneously.

## Category enum

| Category | Meaning |
|---|---|
| `course-correction` | User stopped the agent from doing something wrong |
| `proactive-design` | User made a strong original architectural or tradeoff call |
| `bug-catch` | User spotted a bug or edge case the agent missed |
| `scope-discipline` | User held a line on scope, size, or focus |
| `domain-insight` | User contributed knowledge the agent couldn't derive |
| `other` | Candidate that doesn't fit cleanly above |

## Config file shape

```jsonc
{
  // Optional. Env var JUDGMENT_EVIDENCE_PATH overrides this.
  "store_path": "~/.agents/judgment-evidence.jsonl",

  // Optional. Path to the machine-local sidecar. Must be in a different
  // directory tree from store_path; the skill refuses to write if colocated.
  "local_path": "~/.agents-local/judgment-evidence.local.jsonl",

  // Capture nothing from these repos. Glob patterns allowed.
  "skip_repos": ["acme/super-secret"],

  "anonymize": {
    // Glob patterns on owner/repo. Match triggers anonymization.
    "repos": ["myorg/*", "microsoft/internal-*"],
    // String prefix matches on cwd. Match triggers anonymization.
    "cwd_prefixes": ["D:\\src\\work\\", "/work/"]
  }
}
```

**Resolution order per capture:** `skip` rule match → no capture; `anonymize` rule match → anonymized capture; **no rule match → anonymized-by-default**. A capture matches if **either** the repo OR a cwd prefix matches. There is no persistent "plain capture" rule type — plain entries (`anonymized: false`) exist only after a user explicitly promotes an anonymized entry during end-of-session review; future captures from the same repo still default to anonymized unless a separate rule is added.


## Safe rewrites

Hard-delete, promote-to-plain, and config updates all rewrite an existing file. They must be atomic and detect concurrent writers (another worktree or session running end-of-session review at the same time):

1. Read the file; remember its size and mtime.
2. Build the new content in memory.
3. Re-check size / mtime. If either changed since step 1, **abort** and tell the user another session may be writing.
4. Write the new content to a temp file in the **same directory** as the target.
5. Atomically rename the temp file over the target.

Never edit a store file in place. Append-only writes to the main store and sidecar do not need this protocol  a plain append is atomic enough for line-oriented JSONL.
