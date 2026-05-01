---
name: fresh-start
description: "Post-PR cleanup: verify PR is completed, switch to master/main, delete merged branch, pull latest, and install deps. Use when asked to 'fresh start', 'start fresh', 'clean up branch', 'next task', or 'reset to master'."
allowed-tools: Bash, Read, Write
---

# Fresh Start

Automate the post-PR cleanup workflow: verify completed PR → switch to default branch → delete merged branch → pull latest → install dependencies.

## Steps

Execute these steps sequentially. Stop and report if any step fails.

### 1. Get current branch

```bash
git branch --show-current
```

- If already on `master` or `main` → skip to **Step 6** (pull latest).
- Save the branch name as `$BRANCH` for later steps.

### 2. Check for uncommitted changes

```bash
git status --porcelain
```

- If output is non-empty → **stop** and tell the user:
  _"You have uncommitted changes. Please commit or stash them first."_
- Do **not** proceed.

### 3. Check PR status

**You must positively confirm the PR was completed.** Never delete a branch based on assumptions.

Detect the repo hosting platform from the remote URL:

```bash
git remote get-url origin
```

#### GitHub repos (remote contains `github.com`)

```bash
gh pr list --head "$BRANCH" --state merged --json number,title --jq '.[0]'
```

- If a result is returned → PR is **merged** ✅
- If empty → PR was **not merged**

#### Azure DevOps repos (remote contains `visualstudio.com` or `dev.azure.com`)

Try the ADO MCP tools if available:
- Search for PRs with source branch `refs/heads/$BRANCH` and status `Completed`
- Or run: `az repos pr list --source-branch "$BRANCH" --status completed --top 1`

#### If unable to determine

- **Interactive mode**: Ask the user: _"I couldn't verify the PR status for branch `$BRANCH`. Was the PR completed? (yes/no)"_
- **Autopilot mode**: Report that PR status couldn't be verified and **skip branch deletion**. Continue with the remaining steps.

Save the result as `$PR_COMPLETED` (true/false).

### 4. Determine default branch

Try `master` first:

```bash
git rev-parse --verify master 2>/dev/null
```

If that fails, try `main`. Use whichever exists as `$DEFAULT`.

### 5. Switch to default branch

```bash
git checkout $DEFAULT
```

### 6. Delete old branch (conditional)

**Only** if `$PR_COMPLETED` is true:

```bash
git branch -D $BRANCH
```

Report: _"Deleted branch `$BRANCH` (PR was completed)."_

If `$PR_COMPLETED` is false, report: _"Kept branch `$BRANCH` (no completed PR confirmed)."_

### 7. Pull latest

```bash
git pull
```

### 8. Install dependencies (conditional)

Check if `rush.json` exists in the repo root:

```bash
test -f rush.json && echo "rush"
```

- If rush repo → run `rush install`
- Otherwise → skip

### Summary

After all steps, print a concise summary:

```
✅ Fresh start complete
   Branch: $BRANCH → $DEFAULT
   PR: merged / not confirmed
   Deleted: yes / no
   Pulled: latest
   Deps: rush install / skipped
```
