---
name: wrap-up
description: "End-of-session orchestrator: summarize the session, extract learnings via session-reflect, then optionally hand off unfinished work or clean up after a merged PR. Use when the user says 'wrap up', 'end session', 'let's close out', or 'we're done'."
allowed-tools: Bash, Read, Grep, Glob
---

# Wrap Up

Thin orchestrator for end-of-session cleanup. Runs other skills in sequence — contains no unique logic beyond a brief summary and state detection.

---

## Flow

Execute these steps in order:

### 1. Session Summary

Write a brief summary of what was accomplished this session (3–5 bullet points). Keep it factual — what changed, what was decided, what was delivered.

### 2. Invoke Session Reflect

Always invoke the **`session-reflect`** skill at this point — no parameters needed, it analyzes the full session context automatically. It must run while full session context is still available.

Wait for `session-reflect` to complete (all proposals resolved or clean session confirmed) before continuing.

### 3. Detect State and Invoke Downstream Skills

Assess the current session state and present your assessment to the user for confirmation. Both conditions can be true simultaneously.

Example assessment:
```
📊 Session state:
  • Unfinished work: Yes — 2 pending todos (implement caching, add retry logic)
  • Merged PR: No — branch 'feature/auth' has no completed PR
```

#### a. Check for unfinished work

Determine whether there is unfinished work that a future session should pick up. Signals include:
- Pending or blocked todos in the session
- Explicit user statements about remaining work
- Partial implementations or known follow-ups discussed but not started

If unfinished work exists, tell the user what you found and ask if they'd like to create a handoff:
- **Yes** → invoke the **`handoff`** skill
- **No** → skip

#### b. Check for a completed or merged PR

Determine whether a PR was completed or merged for the current branch. Follow the same platform-detection approach used by `fresh-start`:
- Check the git remote URL to detect the hosting platform (GitHub, Azure DevOps, etc.)
- Query the platform for merged/completed PRs on the current branch
- If the platform cannot be determined, ask the user

If a completed PR is found, ask the user if they'd like to clean up:
- **Yes** → invoke the **`fresh-start`** skill
- **No** → skip

#### c. Neither or both

- If neither condition applies, skip to closing
- If both apply, run them in order: `handoff` first, then `fresh-start`
- **Important**: If session-reflect or handoff created new files (CLAUDE.md edits, handoff.md, scripts, etc.), those are uncommitted changes. Before invoking `fresh-start`, commit them with message `"chore: apply session learnings and handoff"` or ask the user to commit/stash — otherwise `fresh-start` will block on uncommitted changes and refuse to proceed.

### 4. Closing

```
✅ Session wrapped up. Anything else before we close?
```

If the user says no (or equivalent), end the session.
