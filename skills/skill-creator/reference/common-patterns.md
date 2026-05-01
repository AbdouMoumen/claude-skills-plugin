# Common Patterns & Best Practices

This reference provides common patterns used in skills and best practices for skill development.

## Pattern 1: Git-Based Skills

Many skills analyze git changes to determine what files to process:

```bash
# Standard pattern for changed files
git diff --name-only origin/master...HEAD

# Filter to specific file types
git diff --name-only origin/master...HEAD | grep -E '\.(ts|tsx|js|jsx)$'

# Get affected packages (assumes packages/ directory structure)
git diff --name-only origin/master...HEAD | awk -F'/' '{print $2}' | sort -u

# Get changed line ranges for a specific file
git diff origin/master...HEAD --unified=0 <file-path> | grep '^@@' | sed 's/@@ -[0-9,]* +\([0-9,]*\) @@.*/\1/'
```

**Use case**: Skills that operate on changed code (coverage analysis, validation, linting)

**Why**: Only process what's actually changed, not the entire codebase

## Pattern 2: Rush Monorepo Commands

For Rush.js monorepo skills, use multiple `--only` flags to run commands efficiently:

```bash
# Build multiple packages at once
rush build --only pkg1 --only pkg2 --only pkg3

# Lint with auto-fix
rush lint --fix --only pkg1 --only pkg2

# Test with coverage
rush test --coverage --only pkg1 --only pkg2

# Rush handles dependency order and build caching automatically
```

**Benefits**:
- Parallel execution where possible
- Respects dependency order
- Uses build cache
- Faster than running commands package-by-package

**Log files location**: `packages/<package-name>/rush-logs/<package-name>.<command>.log`

## Pattern 3: Coverage Analysis

For test coverage skills using Jest and lcov.info format:

```bash
# Run tests with coverage
rush test --coverage --only <packages>

# Parse lcov.info for a specific file
awk -v file="<file-path>" '
  $1 == "SF:" && $2 ~ file {found=1}
  found && $1 == "DA:" {print $2}
  found && $1 == "end_of_record" {exit}
' packages/<pkg>/coverage/lcov.info

# Extract uncovered lines (hit count = 0)
awk -v file="<file-path>" '
  $1 == "SF:" && $2 ~ file {found=1}
  found && $1 == "DA:" {
    split($2, arr, ",")
    if (arr[2] == 0) print arr[1]
  }
  found && $1 == "end_of_record" {exit}
' packages/<pkg>/coverage/lcov.info
```

**lcov.info format**:
```
SF:<file-path>
DA:<line-number>,<hit-count>
DA:15,0    # Line 15 NOT covered
DA:18,3    # Line 18 covered (executed 3 times)
end_of_record
```

**Coverage report location**: `packages/<package-name>/coverage/lcov.info`

## Pattern 4: Finding Test Files

Common test file naming patterns across JavaScript/TypeScript projects:

- `src/utils/logger.ts` → `src/utils/logger.test.ts`
- `src/hooks/useAgent.ts` → `src/hooks/useAgent.test.ts`
- `src/components/Button.tsx` → `src/components/Button.test.tsx`
- `src/services/api.ts` → `src/services/__tests__/api.test.ts`

**Search strategy**:
```bash
# Pattern 1: Same directory, add .test before extension
<dir>/<name>.test.<ext>

# Pattern 2: __tests__ subdirectory
<dir>/__tests__/<name>.test.<ext>

# Pattern 3: Parent __tests__ directory
<parent-dir>/__tests__/<name>.test.<ext>
```

**Implementation**:
```bash
# Check if test file exists
if [ -f "<test-file-path>" ]; then
  echo "EXISTS"
else
  echo "NOT_FOUND"
fi
```

## Pattern 5: Structured Data Output

Skills output structured data for Claude to act on:

```
FILE: path/to/source.ts
TEST: path/to/source.test.ts
LINES: 10-15, 20, 25-30
COVERAGE: 65%

UNCOVERED LINE NUMBERS:
18, 22, 42-48
```

**Key principles**:
- Clear section labels (FILE:, TEST:, LINES:, etc.)
- Exact locations (file paths, line numbers)
- Simple, consistent formatting
- Parseable by reading line-by-line

## Pattern 6: Package Detection

For monorepo projects with packages/ directory:

```bash
# Extract package name from file path
echo "packages/shell-telemetry/src/utils/logger.ts" | awk -F'/' '{print $2}'
# Output: shell-telemetry

# Get all packages with changes
git diff --name-only origin/master...HEAD | \
  grep -E '^packages/' | \
  awk -F'/' '{print $2}' | \
  sort -u
```

## Best Practices Summary

### DO ✓

- **Start with simple, focused scope** - One clear task per skill
- **Provide exact commands** - Not just descriptions, show the actual bash/tool commands
- **Output structured data** - For Claude to act on, not suggestions for humans
- **Include examples and edge cases** - Show what success looks like
- **Use consistent formatting** - Predictable output structure
- **Reference similar existing skills** - Learn from established patterns
- **Keep SKILL.md focused** - Around 500 lines is a good target; use progressive disclosure for longer content
- **Write clear descriptions** - Include keywords users would naturally say
- **Link to reference files** - Rather than embedding everything in SKILL.md
- **Specify allowed-tools** - Avoid permission prompts during execution

### DON'T ✗

- **Try to do too much** - One skill shouldn't solve every problem
- **Leave steps vague** - Be specific about commands and actions
- **Forget allowed-tools** - List tools the skill needs in frontmatter
- **Skip validation** - Always validate before presenting to user
- **Copy-paste without adapting** - Tailor to the specific codebase/context
- **Create nested file references** - Keep links one level deep (SKILL.md → reference.md, not A → B → C)
- **Make Skills too generic** - Be specific about when to use them
- **Output suggestions to humans** - Output data for Claude to analyze and act on

## Performance Tips

1. **Run commands in parallel** - Use multiple tool calls in a single message when operations are independent
2. **Filter early** - Narrow down files/data before processing (e.g., exclude test files from source file analysis)
3. **Use build caches** - Leverage Rush build cache, don't force rebuilds
4. **Batch operations** - Run `rush build --only pkg1 --only pkg2` instead of looping through packages
5. **Avoid redundant work** - Don't re-run coverage if it's already been generated

## Project-Specific Patterns

When creating skills for a specific project, identify patterns unique to that codebase:

- Directory structure conventions
- Testing frameworks and patterns
- Build tool commands
- Naming conventions
- File organization patterns
- Common utilities and helpers

Reference existing skills in the project to maintain consistency.
