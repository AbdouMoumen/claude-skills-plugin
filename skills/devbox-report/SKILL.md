---
name: devbox-report
description: 'Read devbox status snapshots from the sync path and either generate a self-contained dark-mode HTML report, or answer a natural-language query about repo and agent state across machines.'
argument-hint: '[query] e.g. "which repos have uncommitted changes?" — omit to generate/auto-refresh HTML report'
---

# DevBox Report

> ⚠ **This skill runs forever in Mode A.** It regenerates the report on a schedule indefinitely. The `--once` flag is the only way to run a single pass. Do not stop after the first report.

Reads all `*-latest.json` snapshot files produced by `devbox-monitor` and synthesizes them into a report or answers a query.

## Step 1 — Locate Snapshots and Config

Read the devbox-monitor config file to get `syncPath` and `intervalSeconds`. The config is stored in a machine-local location chosen by the agent at setup time — check these paths in order and use the first one found:
- `~/.copilot/devbox-monitor-config.json`
- `~/.claude/devbox-monitor-config.json`
- `~/.config/devbox-monitor/config.json`

If no config is found, ask the user for the sync path directly. Use `intervalSeconds` from config as the refresh interval; if absent, default to 300 seconds.

Glob for all files matching `<syncPath>/*-latest.json` and read each into memory.
Parse each as JSON per the [data schema](../_shared/data-schema.md).

Also glob for `<syncPath>/*-sessions-latest.md` (the optional intelligent companion files written by the agent — see devbox-monitor SKILL.md Step 6). Read each as text and associate it with its hostname (filename prefix). These are surfaced in both Mode A and Mode B below.

If no snapshot files are found, tell the user and suggest running `/devbox-monitor` first.

## Step 2 — Branch on Invocation Mode

### Mode A: No argument → HTML Report

Generate a fully self-contained HTML file (no CDN dependencies, all CSS/JS inline).

Save to `<syncPath>/report.html` and open it for the user if possible. Inform the user of the path regardless.

#### Step 2a — Fetch Live PR Data

Before generating the HTML, query open PRs for the authenticated user across all detected providers.

**Detect providers** from `prSource` fields across all loaded repo snapshots.

**GitHub** (if any repo has `prSource: "github"`):
```
gh pr list --author @me --state open --json number,title,state,isDraft,headRefName,url --limit 50
```
If the command fails or `gh` is not installed, note it gracefully — show an auth hint in the PR tab.

**Azure DevOps** (if any repo has `prSource: "ado"`):
- Parse distinct orgs from `git.remoteUrl` fields (pattern: `dev.azure.com/{org}/` or `{org}.visualstudio.com/`)
- Skip repos where `git.remoteUrl` is null or doesn't match either pattern, even if `prSource` is `"ado"` — this can happen when the provider was set via config fallback. Log no warning; just skip silently.
- For each distinct org extracted, run:
  ```
  az repos pr list --creator @me --status active --output json --org https://dev.azure.com/{org}
  ```
- If `az` is not installed or not authenticated, note gracefully.

**Cross-reference**: for each PR, extract the branch name and match it against `git.branch` across all repo snapshots to find the machine/repo/branch location. A PR may appear on multiple machines if the same branch is checked out in multiple places.

Branch name extraction per provider:
- **GitHub**: use `headRefName` directly (e.g. `"my-feature-branch"`)
- **ADO**: use `sourceRefName`, stripping the `refs/heads/` prefix (e.g. `"refs/heads/my-feature-branch"` → `"my-feature-branch"`)

Store the merged PR list (with location rows) for use in the PR view section of the HTML.

#### Step 2b — Generate HTML

Use the CSS and JS from the reference template at `./references/template-shell.html` verbatim — do not invent new styles or restructure the layout. Fill in data sections as specified below.

The generated HTML must be fully self-contained (all CSS and JS inline, no external dependencies).

---

##### Topbar

```html
<div class="topbar">
  <h1>📦 DevBox Status</h1>
  <div class="filters">
    <!-- Machine <select>: one <option> per distinct hostname across all snapshots -->
    <!-- Repo <select>: one <option> per distinct repo name across all snapshots -->
    <!-- Branch <input> and Session/PR# <input>: always present -->
    <!-- ⚠ Needs Attention toggle button -->
    <!-- ✕ Clear button -->
  </div>
  <div class="topbar-meta">{day} {date} · {time} {tz} · {N} machines · next refresh {intervalSeconds}s</div>
</div>
```

##### Summary Strip

Counts computed from all loaded snapshots:

| Card | Value | Color |
|---|---|---|
| Machines | distinct hostnames | blue |
| Repos | total repos across all machines | blue |
| Live Sessions | `aiSessions` where `state !== "stale"` (or all if no `state` field) | green |
| Needs Attention | repo cards that will receive an attention badge | yellow |
| Ad-hoc Sessions | total `orphanedAiSessions` across all machines | muted |
| Stale Machines | computed by JS at runtime from `capturedAt` — start hidden | red (hidden until JS runs) |

##### Stale Alert Bar

Rendered hidden (`display:none`). JS (`computeStaleness`) shows it when any machine's `capturedAt` is >30 minutes old.

##### View Switcher

Two tabs: `🖥 Machines` (default active) and `⤴ Pull Requests`.

---

##### Machine Sections

For each snapshot file (one per machine), emit:

```html
<details class="machine" data-machine="{hostname}" data-captured-at="{capturedAt}" open>
  <summary>
    <span class="ch">▶</span>
    <span class="m-name">🖥 {hostname}</span>
    <span class="m-meta">{N} repos · {M} sessions</span>
    <!-- if any child repo has an attention condition: -->
    <span class="m-attn">⚠ {K} needs attention</span>
    <span class="m-snap"><span class="snap-pill snap-ok" id="snap-{hostname}">✓ just now</span></span>
  </summary>
  <div class="repos-grid">
    <!-- repo cards -->
  </div>
  <!-- ad-hoc section — only if orphanedAiSessions present for this machine -->
</details>
```

The `snap-pill` class and text are updated at runtime by `computeStaleness()` — set initial values to `snap-ok` / `✓ just now`.

---

##### Repo Cards

For each repo in the machine's snapshot:

```html
<div class="repo-card {has-attn?}" data-repo="{name}" data-branch="{git.branch}"
     data-searchtext="{name} {git.branch} {session descriptions} {hostname}">
```

**Header row** (`rc-hdr`):
- Repo name (`rc-name`)
- Branch pill (`branch-pill`) — truncate at 240px with title tooltip
- PR badge (`pr-badge`) — if a live PR from Step 2a matches this repo's branch; show `#number` + title (truncated); omit if no match
- Attention badge (`attn-badge`) — see Attention Detection below; omit if no condition

**Git row** (`rc-git`):
- Commit hash (`hash`) — `hashShort`
- Commit message (`cmsg`) — truncate, full text in `title` attribute
- Relative age (`cage`)
- Change pills — only if non-zero: staged (`p-st`), unstaged (`p-un`), untracked (`p-ut`)
- Stash pill if `stashCount > 0`
- Ahead/behind — `↑N ↓N` or `remote unknown` if unavailable; show `✓ clean` if all changes are zero

**Branches section** (`details.branches`) — only if `git.branches[]` is present:
```html
<details class="branches">
  <summary><span class="bch">▶</span> <span>{N} local branches</span></summary>
  <div class="branch-list">
    <!-- for each branch: cur-dot (green) if isCurrent, no-dot otherwise -->
    <!-- br-name, br-age, br-msg from BranchInfo.lastCommit -->
  </div>
</details>
```
Omit this section entirely if `git.branches` is absent or empty.

**Sessions section** (`rc-sessions`) — only if `aiSessions` is non-empty:
```html
<div class="rc-sessions">
  <div class="sess-lbl">{N} active session{s}</div>
  <!-- sess-item per session -->
</div>
```

Each session item (`sess-item`):
- Name: `description` → fallback `processName` → fallback `"Unnamed Session"`
- Elapsed badge (`el`): computed from `startTime` to now — `el-g` <30m, `el-a` 30m–2h, `el-r` >2h; omit if no `startTime`
- Stall class `si-stall` if `state === "stale"` or `lockTime` is >30min old
- Todo bar: striped `repeating-linear-gradient` with label `"no plan.md — unstructured"` (the monitor doesn't write todo data; this is always the unstructured style unless the AI can read it directly)
- Session ID row (`si-id`) with copy button — omit if `sessionId` absent
- AI annotation (`div.ai-note`) — see AI Annotations below

**Ad-hoc section** (`adhoc-section`) — only if this machine has `orphanedAiSessions`:
```html
<div class="adhoc-section">
  <div class="adhoc-hdr">🔹 Ad-hoc Sessions <span>({N})</span></div>
  <div class="adhoc-grid">
    <!-- adhoc-item per orphaned session: name, workingDir, session ID + copy button -->
  </div>
</div>
```

---

##### PR View (`#view-prs`)

Populated from the live PR data fetched in Step 2a. Rendered hidden by default; shown when user clicks the Pull Requests tab.

For each PR:
```html
<div class="pr-card">
  <div class="pr-card-hdr">
    <span class="pr-number">#{number}</span>
    <span class="pr-title">{title}</span>
    <span class="pr-state {open|draft|review}">{state label}</span>
  </div>
  <div class="pr-locs">
    <!-- one pr-loc row per machine/repo location where this PR's branch is checked out -->
    <!-- clicking a row calls navigateToRepo(machine, repo) -->
  </div>
</div>
```

If no PRs were fetched (all providers failed or unauthenticated), show:
```html
<div class="no-results">
  No PR data available.
  <!-- per-provider auth hints based on prSource values found in snapshots -->
  <!-- GitHub: "run gh auth login" -->
  <!-- ADO: "run az login" -->
</div>
```

---

##### Attention Detection

Add `has-attn` class to repo card and an `attn-badge` in the header when **any** of these conditions apply:

| Condition | Badge text |
|---|---|
| A session has `state === "stale"` OR `lockTime` >30min old | `⚠ stalled Xm` (use `.warn` class for red) |
| Session elapsed >2h and no stall detected (long-running without apparent progress) | `⚠ long-running` |

> Note: "All todos done" detection is not yet supported — the monitor does not write todo state. The AI may use elapsed time and absence of lock activity as a proxy signal.

The AI may also add attention badges based on its own observations (see below).

---

##### AI Annotations

The AI may add a `div.ai-note` element inside any `sess-item` or `repo-card`. Style:
```css
/* already in template */
.ai-note { font-style:italic; color:var(--mu); font-size:11px; padding:4px 0 0; }
.ai-note::before { content: "✦ "; color:var(--dim); }
```

Use sparingly — only surface genuinely notable observations:
- Session stalled for an unusually long time with no progress signal
- Same branch checked out on multiple machines simultaneously
- Repo has no commits in an unusually long time but sessions are active
- Other cross-machine or cross-repo anomalies

Do **not** annotate normal, expected states.

---

#### Refresh Loop (Mode A)

After saving `report.html`, print a one-liner:
```
[HH:MM:SS] ✓ report written · N machines · M repos · next refresh in Xs
```

If `--once` was passed, stop here.

Otherwise, run:
```powershell
Start-Sleep -Seconds <intervalSeconds>
```

**Go back to Step 1** (re-read all `*-latest.json` files + re-fetch live PR data) and regenerate. Repeat indefinitely. Suppress verbose output on subsequent iterations — only the one-liner each cycle.

---

### Mode B: Argument provided → Natural-Language Query

Load all snapshot data (both the structured `*-latest.json` and the intelligent `*-sessions-latest.md` companions) into context. Answer the user's question conversationally, citing specific machine names, repo names, session UUIDs, and data values. When the answer is best supported by the narrative companion file, quote it directly.

Handle queries like:
- "What are my agents working on?" (lean on the `*-sessions-latest.md` files)
- "Which machines have uncommitted changes?"
- "Which repos are behind their remote?"
- "Show the most recently active repo"
- "Which machines haven't been snapshotted in the last 2 hours?"
- "Are there any stashes I should know about?"
- "Which branches have open PRs?"
- "What branches has Abdou-DevBox1 committed to in the last week?" (uses the new `branches[]` field)
- "Are there any stale `inuse` locks I should clean up?"
- "Which sessions are live but idle for more than an hour?"
