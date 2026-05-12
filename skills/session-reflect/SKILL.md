---
name: session-reflect
description: "Self-improvement skill that extracts learnings from the current session and routes them to typed destinations (CLAUDE.md, scripts, docs, agents, permissions). Use when the user says 'reflect', 'session reflect', 'what did we learn', or 'extract learnings'."
allowed-tools: Bash, Read, Write, Edit, Grep, Glob
---

# Session Reflect

Mine the current session for learnings and route approved proposals to the right destinations. Two phases: gather & classify, then apply with user approval.

**Anti-fabrication rule**: LLMs have a strong output bias — they tend to produce findings even when none exist. Explicitly counteract this. If no strong or medium findings exist, say _"Clean session — no improvements to propose"_ and stop. Do NOT invent learnings to fill space.

---

## Phase 1: Gather & Classify

Review the entire session context in a single pass. Look for these four signal sources:

### Signal Sources

1. **User corrections** — times the user said "no, do it this way", corrected your approach, or expressed a preference
2. **Repeated patterns** — multi-step workflows the user or you performed manually more than once
3. **Tool/command failures** — commands that failed and required workarounds or alternative approaches
4. **Structured session data** — todos, decisions (e.g., decision-tracking tables), checkpoint summaries. Query checkpoint or summary data if the platform provides it — checkpoints survive context compaction and preserve information that may have been trimmed from the conversation

### Classify into Destination Buckets

Each finding maps to exactly one bucket:

| Bucket | Destination | Signal |
|--------|-------------|--------|
| `feedback` | `CLAUDE.md` or `.github/copilot-instructions.md` | User corrections, preferences, "always/never" rules |
| `doc` | Project docs, READMEs | Knowledge the agent had to search or ask for repeatedly |
| `script` | `.claude/scripts/` | Multi-step sequence invoked 2+ times in the session |
| `skill` | Delegate to `skill-creator` | Recurring workflow that should be a reusable skill |
| `agent` | `.claude/agents/` | Tasks that should have been delegated to a subagent |
| `permission` | `.claude/settings.json`, allowlists | Repeated permission prompts that slowed the session |

### Classify Scope

Each finding also has a **scope** — this determines where files are written:

| Scope | Path prefix | Criteria |
|-------|-------------|----------|
| **Repo** | `./.claude/`, `./.github/`, project root | Learning is specific to this project's codebase, tech stack, conventions, or domain |
| **Global** | `~/.claude/`, `~/.github/`, user home | Learning applies across all projects — general workflow preferences, tool usage patterns, or universal coding practices |

**Default to repo scope.** Only classify as global when the learning is clearly project-independent (e.g., "always use feature branches" or "prefer structured logging"). When uncertain, ask the user.

### Severity Gating

Rate every finding by severity. This determines what the user sees:

| Severity | Criteria | Action |
|----------|----------|--------|
| **Strong** | ANY of: user stated explicitly; recurred 3+ times; used "always/never" framing | Full proposal card |
| **Medium** | One clear instance, could be codified | One-liner in "Also noticed" section |
| **Weak** | Noticed once, ambiguous generality | **Suppress entirely** — do not show |

### Generalization Discipline

Every proposal must be a **category-level rule**, not a session-specific instruction.

Use **When / Do** format. If the `When` field can't be broader than the specific session event, do not propose it.

**Bad**: _"When creating figure 3, use log scale"_
**Good**: _"When data spans orders of magnitude, suggest log scale"_

### Deduplication

Before proposing any finding (strong or medium):

1. Read the target destination file's current content
2. Include that content as context when generating the proposal
3. If an equivalent rule already exists, either **skip** the proposal or propose **strengthening** the existing entry with new evidence

---

## Phase 2: Present & Apply

### Strong Findings — Full Proposal Cards

Present each strong finding as a proposal card:

```
---
📋 **Proposal 1/N** · strong · `<bucket> → <destination file>` · <scope>

**When:** <generalized condition>
**Do:** <generalized action>

**Evidence:**
- <specific turn/event from session>
- <additional evidence if available>

**Pattern:** <why this is a pattern, not a one-off>

**Apply?** (yes / no / edit / approve all / skip remaining)

---
```

Present proposals **one at a time**. Wait for user response before showing the next.

- **yes** → apply immediately (see Apply Approved Proposals below)
- **no** → skip, move to next proposal
- **edit** → let user modify the When/Do text, then apply the edited version
- **approve all** → apply this and all remaining proposals without further prompts
- **skip remaining** → skip this and all remaining proposals, move to medium findings

### Medium Findings — One-Liner List

After all strong proposals are resolved, show medium findings as a single block:

```
📝 Also noticed (informational):
  • <one-liner summary> (seen once, turn N)
  • <one-liner summary> (noticed in turn N)
```

The user can promote any medium finding by saying something like _"apply that one about camelCase"_. If promoted, present it as a full proposal card and follow the same approval flow.

### Apply Approved Proposals

When the user approves a proposal (yes or edited), apply it immediately. Use the finding's **scope** to determine the target path — repo-scoped findings write to project-local paths (`./.claude/`, `./.github/`), global findings write to user-level paths (`~/.claude/`, `~/.github/`).

- **`feedback` bucket** → Determine the target file: if only one of `CLAUDE.md` or `.github/copilot-instructions.md` exists at the appropriate scope, use that one. If both exist, ask the user which to update. If neither exists, create `CLAUDE.md` at the appropriate scope (`./.claude/CLAUDE.md` for repo, `~/.claude/CLAUDE.md` for global). Read the target file, find the matching section, and insert the When/Do rule there. If multiple sections could match, present the candidates and ask the user where to insert. If no matching section exists, create one.

- **`doc` bucket** → Read the target doc file. Find the relevant section and insert the content. Create the file or section if needed.

- **`script` bucket** → Ensure the scripts directory exists at the appropriate scope (`./.claude/scripts/` for repo, `~/.claude/scripts/` for global). Create a new script file there. Include a comment header explaining purpose and usage.

- **`skill` bucket** → Do NOT write the skill yourself. If running standalone, invoke the **`skill-creator`** skill and pass it the When/Do description as context for the new skill's purpose. If running as part of `wrap-up`, do NOT invoke `skill-creator` inline — instead, note it as a follow-up task and suggest the user run `skill-creator` in a fresh session. The multi-phase `skill-creator` process would derail end-of-session cleanup.

- **`agent` bucket** → Ensure the agents directory exists at the appropriate scope (`./.claude/agents/` for repo, `~/.claude/agents/` for global). Create or update an agent definition there with the task description and appropriate context.

- **`permission` bucket** → Ensure the config directory exists at the appropriate scope. Read the settings file (`./.claude/settings.json` for repo, `~/.claude/settings.json` for global). Add the relevant tool or command to the appropriate allowlist. Create the file with correct structure if it doesn't exist.

After each apply, confirm to the user what was written and where.

---

## Clean Session

If after scanning all four signal sources there are zero strong or medium findings:

```
✅ Clean session — no improvements to propose.
```

Stop here. Do not fabricate learnings.

---

## Standalone vs Orchestrated

This skill can run:
- **Standalone** — user invokes "session reflect" directly
- **Orchestrated** — invoked as part of the `wrap-up` skill's flow

Behavior is identical in both cases.
