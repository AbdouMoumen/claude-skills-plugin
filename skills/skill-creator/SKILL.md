---
name: skill-creator
description: Guides the AI agent through creating new skills by following a 5-phase structured process (discovery, scope, design, implement, validate). Use when the user asks to create, build, or make a new skill.
allowed-tools: Bash, Read, Grep, Glob, Write
---

# Skill Creator (AI Agent Guide)

This skill guides the AI agent through creating new skills by following a structured, phase-based process. It ensures skills are well-designed, properly scoped, and follow consistent patterns.

**IMPORTANT**: All skills created using this process are for **Claude (AI agent) to use**, not for humans. Skills should output structured data that Claude can act on, not suggestions or guidance for humans to follow manually.

## When to Use This Skill

Use this skill when:
- User explicitly asks: "Create a new skill for X"
- User says: "Let's make a skill that does Y"
- User requests: "I need a skill to help with Z"

## Important: This is a Process Guide

Unlike other skills that perform technical tasks, this skill is a **meta-process** that guides the AI agent through skill creation. Follow each phase sequentially and don't skip steps.

---

## Key Insight: Skills are Model-Invoked

Skills are **model-invoked**: Claude automatically decides which Skills to use based on your request. The `description` field is critical - Claude uses it to decide when to apply the Skill automatically.

---

## Phase 1: Discovery (Understand Requirements)

### First: Is a Skill the Right Approach?

Before creating a skill, evaluate if another Claude Code feature would be better:

**Consider alternatives when:**
- **User wants a reusable prompt they invoke manually** → Suggest: Slash command (e.g., `/deploy staging`)
- **User wants project-wide behavior for every conversation** → Suggest: CLAUDE.md (e.g., "always use TypeScript strict mode")
- **User wants to run scripts on specific events** → Suggest: Hooks (e.g., lint on file save)
- **User wants to connect Claude to external tools/data** → Suggest: MCP server (e.g., database access)
- **User wants isolated execution with different tools** → Suggest: Subagent (separate context)

**Create a Skill when:**
- Claude needs specialized knowledge or workflow (e.g., "review PRs using our standards")
- You want Claude to automatically apply it when relevant (model-invoked)
- It involves multi-step processes with specific commands and structured output

**Action**: If not a skill, explain the better alternative and stop. Only continue if a skill is appropriate.

### Decide Where the Skill Should Live

**Skill locations**:
- **Personal** (`~/.claude/skills/`): Your workflow across all projects
- **Project** (`.claude/skills/`): Team workflows in this repository
- **Enterprise**: Organization-wide (admin-configured)
- **Plugin**: Bundled for distribution

**Default**: Use Project for team skills, Personal for individual preferences. Ask if unclear.

### Questions to Ask the User

Ask these questions to understand what they want:

1. **"What should this skill do?"**
   - Get a clear, one-sentence description
   - Example: "Validate code changes before creating a PR"

2. **"What's the expected input?"**
   - What triggers this skill?
   - What data/context is needed?
   - Example: "Current git changes vs master"

3. **"What's the expected output?"**
   - Structured data that I (Claude) can act on
   - Examples:
     - File paths and line numbers for me to read and analyze
     - List of packages to run commands on
     - Specific error locations for me to fix
     - Coverage gaps with exact line ranges
   - **NOT**: Suggestions, recommendations, or guidance
   - **Instead**: Raw data that lets me make decisions

4. **"Are there similar existing skills to reference?"**
   - Check: `.claude/skills/` or `~/.claude/skills/` directories
   - Learn: Patterns from existing skills

**CRITICAL INSIGHT**: All skills created with this process are for ME (Claude, the AI agent) to use. The output should be structured data I can process, not guidance to follow manually.

### Actions to Take

- List all existing skills:
  ```bash
  ls -la .claude/skills/
  ls -la ~/.claude/skills/
  ```

- If similar skills exist, read them for patterns:
  ```bash
  # Read frontmatter and workflow sections
  ```

### Output of This Phase

Document your understanding:
```
SKILL PURPOSE: <one-sentence description>
TARGET USER: AI agent (Claude)
INPUT: <what triggers this>
OUTPUT: <structured data for Claude to act on>
SIMILAR SKILLS: <list any similar skills>
```

---

## Phase 2: Scope Definition (What's In/Out)

### Define Scope Boundaries

Work with the user to define:

**What's IN scope:**
- ✅ Core functionality
- ✅ Primary use case
- ✅ Essential edge cases

**What's OUT of scope:**
- ❌ Advanced features for later
- ❌ Edge cases too complex
- ❌ Related but separate concerns

### Key Question to Ask

**"Should this skill be simple (focused) or comprehensive?"**
- Simple: Single, well-defined task
- Comprehensive: Multiple related tasks

**Best practice**: Start simple, can always expand later.

### Example Scope Definitions

**Good scope (validate-changes)**:
- ✅ Run lint, build, test on changed packages
- ❌ Don't create the PR (separate concern)
- ❌ Don't deploy to environments

**Good scope (test-coverage)**:
- ✅ Identify uncovered lines in changed code
- ❌ Don't generate test code (AI agent will do that)
- ❌ Don't analyze integration tests

### Actions to Take

Discuss with user:
1. Core functionality (must-have)
2. Optional features (nice-to-have)
3. Explicit exclusions (will NOT do)

### Output of This Phase

Document scope clearly:
```
IN SCOPE:
- <feature 1>
- <feature 2>
- <feature 3>

OUT OF SCOPE:
- <exclusion 1>
- <exclusion 2>
- <exclusion 3>

MVP: <simplest viable version>
```

---

## Phase 3: Workflow Design (How It Works)

### Design the Step-by-Step Workflow

Break down the skill into sequential steps:
1. Input processing - What data to gather
2. Analysis - What to compute
3. Action - What commands to run
4. Output formatting - How to present results

Document each step: Purpose, Input, Processing, Output, Commands

### Identify Required Tools

Based on the workflow, determine which tools are needed:

**Available tools**:
- `Bash` - Run commands (git, rush, npm, file operations)
- `Read` - Read file contents
- `Write` - Create/overwrite files
- `Edit` - Modify files (exact string replacement)
- `Grep` - Search file contents
- `Glob` - Find files by pattern

**Tool selection guidelines**:
- Need to run commands? → `Bash`
- Need to read files? → `Read`
- Need to create new files? → `Write`
- Need to search for patterns? → `Grep` or `Glob`

### Design Output Format

Skills created with this process output **structured, parseable data** for Claude (AI agent) to act on:

```
Output: Structured, parseable data
Format: Simple text with clear sections
Example:
  FILE: path/to/file.ts
  LINES: 10-15, 20, 25-30
  COVERAGE: 65%
```

**Key principles**:
- Provide **data**, not suggestions or guidance
- Use clear sections and labels (FILE:, LINES:, etc.)
- Include exact locations (file paths, line numbers)
- Keep formatting simple and consistent
- Let Claude read the source and make decisions based on the data

### Consider Performance

- Can steps run in parallel? (use multiple tool calls)
- Are there expensive operations? (cache results)
- Can we filter early? (reduce data processing)

### Actions to Take

1. Write out each step in order
2. For each step, specify:
   - What data goes in
   - What processing happens
   - What data comes out
   - What commands to run

3. List all required tools
4. Design the output format
5. Identify optimization opportunities

### Output of This Phase

Document the workflow:
```
WORKFLOW:

Step 1: <name>
  - Purpose: ...
  - Commands: ...

Step 2: <name>
  - Purpose: ...
  - Commands: ...

[etc.]

REQUIRED TOOLS: Bash, Read, Grep, Glob

OUTPUT FORMAT:
<show example output>
```

---

## Phase 4: Implementation (Write the Skill)

### Create Directory Structure

```bash
mkdir -p .claude/skills/<skill-name>/
# OR for personal skills:
mkdir -p ~/.claude/skills/<skill-name>/
```

**Naming convention**:
- Use kebab-case: `validate-changes`, `test-coverage`, `skill-creator`
- Be descriptive: Skill name should indicate purpose
- Keep it concise: 1-3 words usually

### Write SKILL.md File

Basic structure:
```markdown
---
name: skill-name
description: What it does - how it works. When to use it.
allowed-tools: Bash, Read, Grep
---

# Skill Title

Introduction (1-2 paragraphs).

## Workflow

### Step 1: Name
Instructions and commands.

### Step 2: Name
Instructions and commands.

## Output Format
Example of structured output.
```

### Frontmatter Fields

**Required fields**:
- `name`: Skill name (lowercase, hyphens, max 64 chars)
- `description`: What it does and when to use it (max 1024 chars)

**Optional fields**:
- `allowed-tools`: Tools Claude can use without asking
- `model`: Specific model to use for this Skill
- `context`: Set to `fork` to run in isolated context
- `agent`: Agent type when using `context: fork`
- `hooks`: Skill-scoped hooks
- `user-invocable`: Show in slash menu (default: true)

**For complete frontmatter field reference, see [reference/frontmatter-fields.md](reference/frontmatter-fields.md)**

### Description Formula

Good descriptions follow this pattern:
```
<What it does> - <how it works>. <When to use it>.
```

Examples:
- "Pre-PR validation for Rush monorepo - runs lint, build, and tests on affected packages. Use before creating PRs."
- "Analyzes test coverage for changed code and provides structured data about gaps. Returns file paths and uncovered line numbers for the AI agent."

**Important**: Descriptions should include keywords users would naturally say. Since Skills are model-invoked (Claude decides when to use them), the description is critical for automatic discovery.

### Writing Guidelines

**Essential**:
- Provide exact commands, not descriptions
- Output structured data for Claude to act on
- Use code blocks and examples
- Keep SKILL.md focused (around 500 lines - use progressive disclosure for longer content)

### Actions to Take

1. Create the directory:
   ```bash
   mkdir -p .claude/skills/<skill-name>/
   ```

2. Write SKILL.md using the template above

3. Include:
   - Proper frontmatter
   - Clear workflow steps
   - Detailed commands
   - Examples and edge cases

### Output of This Phase

- Directory: `.claude/skills/<skill-name>/`
- File: `.claude/skills/<skill-name>/SKILL.md`
- Content: Complete skill documentation

---

## Phase 4.5: Multi-File Skills (Progressive Disclosure)

**When to use**: If SKILL.md grows significantly (around 500+ lines) or has detailed reference material that's not always needed.

### Structure Example

```
my-skill/
├── SKILL.md (core workflow)
├── reference/ (detailed docs - loaded when needed)
└── scripts/ (utility scripts - executed, not loaded)
```

Link to reference files in SKILL.md:
```markdown
## Additional Resources
- See [reference/details.md](reference/details.md) for complete API reference
```

**Scripts**: Tell Claude to execute them, not read them:
```markdown
Run: `python scripts/helper.py input.txt`
```

**Keep it simple**: Only split when necessary. Single-file skills are easier to maintain.

---

## Phase 5: Validation (Review & Iterate)

### Validation Checklist

**Frontmatter**: name, description, allowed-tools
**Content**: Title, workflow with commands, output format
**Quality**: Focused and concise (around 500 lines), description with natural keywords, correct commands

### Read Back and Present

```bash
cat .claude/skills/<skill-name>/SKILL.md
```

Present to user:
- Location and description
- Workflow summary
- Ask if adjustments needed

### Iterate

Update based on feedback, re-validate, and present again until approved.

---

## Additional Resources

For more details on skill development, see the reference files:

- **[Frontmatter Fields Reference](reference/frontmatter-fields.md)** - Complete guide to all frontmatter fields with examples
- **[Common Patterns](reference/common-patterns.md)** - Git patterns, Rush commands, coverage analysis, and best practices
- **[Examples](reference/examples.md)** - Detailed walkthrough of creating a "list-todos" skill from start to finish

---

## Quick Reference: Skill Creation Checklist

Use this checklist when creating a skill:

### Discovery Phase
- [ ] Evaluated: Is a Skill the right approach? (vs slash command, CLAUDE.md, hooks, MCP, subagent)
- [ ] Asked: What should this skill do?
- [ ] Asked: What's the expected input?
- [ ] Asked: What structured output should Claude receive?
- [ ] Checked: Are there similar existing skills?
- [ ] Documented: Purpose, input, output (structured data for Claude)

### Scope Phase
- [ ] Defined: What's IN scope
- [ ] Defined: What's OUT of scope
- [ ] Decided: Simple or comprehensive?
- [ ] Documented: Scope boundaries

### Design Phase
- [ ] Designed: Step-by-step workflow
- [ ] Identified: Required tools
- [ ] Designed: Output format
- [ ] Considered: Performance optimizations
- [ ] Documented: Complete workflow

### Implementation Phase
- [ ] Created: Directory `.claude/skills/<skill-name>/`
- [ ] Wrote: SKILL.md file
- [ ] Added: Frontmatter (name, description, allowed-tools)
- [ ] Added: Title and introduction
- [ ] Added: Workflow steps with commands
- [ ] Added: Examples and edge cases
- [ ] Verified: Formatting and structure

### Validation Phase
- [ ] Checked: Frontmatter complete
- [ ] Checked: Workflow is clear
- [ ] Checked: Commands are correct
- [ ] Checked: Examples provided
- [ ] Checked: SKILL.md is focused (around 500 lines - use progressive disclosure if needed)
- [ ] Checked: Description includes keywords users would naturally say
- [ ] Presented: To user for review
- [ ] Iterated: Based on feedback
- [ ] Confirmed: User approval

---

## Meta Note: This Skill is Self-Referential

This skill was created using the process it describes! It demonstrates the 5-phase approach and serves as a living example of progressive disclosure (SKILL.md ~500 lines + reference files for detailed content).

---

## Summary

Creating a skill is a structured process:

1. **Discover** - Understand requirements
2. **Scope** - Define boundaries
3. **Design** - Plan workflow and tools
4. **Implement** - Write SKILL.md
5. **Validate** - Review and iterate

Follow this process, use the checklist, and reference existing skills for patterns. The result will be a well-designed, useful skill that follows project conventions.

**Remember**: Skills output structured data for Claude to act on, not suggestions for humans to follow.
