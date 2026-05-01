# Skill Creation Examples

Detailed examples showing the 5-phase skill creation process in action.

## Example 1: Creating a "list-todos" Skill

This walkthrough demonstrates creating a simple skill that finds TODO comments in changed code.

### Phase 1: Discovery

**Q**: What should this skill do?
**A**: List all TODO comments in changed code

**Q**: What's the expected input?
**A**: Changed files from current branch vs master

**Q**: What structured output should Claude receive?
**A**: List of TODOs with exact file paths and line numbers, so Claude can read them and decide what to do

**Q**: Are there similar existing skills?
**A**: Check `.claude/skills/` for any code analysis skills

**Documentation**:
```
SKILL PURPOSE: List TODO comments in changed code
TARGET USER: AI agent (Claude)
INPUT: Changed files from git diff
OUTPUT: Structured list with file paths and line numbers
SIMILAR SKILLS: test-coverage (both analyze changed code)
```

### Phase 2: Scope

**In scope**:
- ✅ Find TODO/FIXME/HACK comments in changed files
- ✅ Return file paths and line numbers
- ✅ Support TypeScript, JavaScript, and other common file types

**Out of scope**:
- ❌ Don't categorize or prioritize TODOs (Claude will decide)
- ❌ Don't suggest fixes (Claude will analyze and act)
- ❌ Don't analyze TODO content for urgency
- ❌ Don't track historical TODO changes

**MVP**: Find TODO/FIXME/HACK in changed files, output file:line format

### Phase 3: Design

**Workflow**:

**Step 1: Get Changed Files**
- Purpose: Identify which files to search
- Commands:
  ```bash
  git diff --name-only origin/master...HEAD
  ```

**Step 2: Search for TODO Patterns**
- Purpose: Find TODO/FIXME/HACK comments
- Commands:
  ```bash
  grep -Hn -E '(TODO|FIXME|HACK):' <file-path>
  ```

**Step 3: Format Output**
- Purpose: Present data in structured format
- Format: `FILE: path:line` then `COMMENT: text`

**Required Tools**: Bash, Grep

**Output format**:
```
FILE: path/to/file.ts:42
TODO: Refactor this function

FILE: path/to/file.ts:56
FIXME: Handle edge case
```
