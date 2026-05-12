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

### 2. Detect State

Gather information about the current session — **read only**, do not invoke any skills yet.

#### a. Check for a completed or merged PR

Determine whether a PR was completed or merged for the current branch. Follow the same platform-detection approach used by `fresh-start`:
- Check the git remote URL to detect the hosting platform (GitHub, Azure DevOps, etc.)
- Query the platform for merged/completed PRs on the current branch
- If the platform cannot be determined, ask the user

#### b. Check for unfinished work

Determine whether there is unfinished work that a future session should pick up. Signals include:
- Pending or blocked todos in the session
- Explicit user statements about remaining work
- Partial implementations or known follow-ups discussed but not started

Present the assessment to the user:

```
📊 Session state:
  • Merged PR: Yes — PR #42 merged on 'feature/auth'
  • Unfinished work: Yes — 2 pending todos (implement caching, add retry logic)
```

### 3. Fresh Start (conditional)

If a completed PR was found, ask the user if they'd like to clean up:
- **Yes** → invoke the **`fresh-start`** skill. This switches to the default branch, deletes the merged branch, and pulls latest.
- **No** → skip

This runs **before** session-reflect so that learnings are written to the long-lived default branch, not a feature branch about to be deleted.

### 4. Invoke Session Reflect

Always invoke the **`session-reflect`** skill — no parameters needed, it analyzes the full session context automatically. Session-reflect mines conversation context, not git state, so it works correctly even after fresh-start has switched branches.

Wait for `session-reflect` to complete (all proposals resolved or clean session confirmed) before continuing.

### 5. Handoff (conditional)

If unfinished work was detected in step 2, tell the user what you found and ask if they'd like to create a handoff:
- **Yes** → invoke the **`handoff`** skill. The handoff document is transient and should **not** be committed.
- **No** → skip

Handoff runs last because it captures the most complete picture — including which learnings were applied by session-reflect.

### 6. Closing

```
✅ Session wrapped up. Anything else before we close?
```

If the user says no (or equivalent), end the session.
