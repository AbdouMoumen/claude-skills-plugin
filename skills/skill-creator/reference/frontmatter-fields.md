# Frontmatter Fields Reference

Complete reference for SKILL.md frontmatter fields based on official Anthropic specification.

## Required Fields

### `name`
- **Type**: String
- **Required**: Yes
- **Format**: Lowercase letters, numbers, and hyphens only (max 64 characters)
- **Description**: Skill name. Should match the directory name.
- **Example**: `validate-changes`, `test-coverage`, `skill-creator`

### `description`
- **Type**: String
- **Required**: Yes
- **Max length**: 1024 characters
- **Description**: What the Skill does and when to use it. Claude uses this to decide when to apply the Skill automatically.
- **Pattern**: `<What it does> - <how it works>. <When to use it>.`
- **Example**: "Pre-PR validation for Rush monorepo - runs lint, build, and tests on affected packages. Use before creating PRs."

**Important**: Descriptions should include keywords users would naturally say. Since Skills are model-invoked (Claude decides when to use them), the description is critical for automatic discovery.

## Optional Fields

### `allowed-tools`
- **Type**: String (comma-separated) or Array (YAML list)
- **Required**: No
- **Description**: Tools Claude can use without asking permission when this Skill is active.
- **Available tools**: Bash, Read, Write, Edit, Grep, Glob, and others

**Examples**:
```yaml
# Comma-separated
allowed-tools: Bash, Read, Grep, Glob

# YAML-style list
allowed-tools:
  - Read
  - Grep
  - Glob
```

### `model`
- **Type**: String
- **Required**: No
- **Description**: Model to use when this Skill is active. Defaults to conversation's model.
- **Example**: `claude-sonnet-4-20250514`, `claude-opus-4-5-20251101`

### `context`
- **Type**: String
- **Required**: No
- **Values**: `fork`
- **Description**: Set to `fork` to run the Skill in a forked sub-agent context with its own conversation history.
- **Use case**: Complex multi-step operations that shouldn't clutter the main conversation

### `agent`
- **Type**: String
- **Required**: No (only applicable with `context: fork`)
- **Description**: Specify which agent type to use when `context: fork` is set
- **Values**: `Explore`, `Plan`, `general-purpose`, or custom agent name from `.claude/agents/`
- **Default**: `general-purpose`

### `hooks`
- **Type**: Object
- **Required**: No
- **Description**: Define hooks scoped to this Skill's lifecycle
- **Supported events**: `PreToolUse`, `PostToolUse`, `Stop`
- **Example**:
```yaml
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/security-check.sh $TOOL_INPUT"
          once: true
```

### `user-invocable`
- **Type**: Boolean
- **Required**: No
- **Default**: `true`
- **Description**: Controls whether the Skill appears in the slash command menu. Does not affect programmatic invocation or automatic discovery.
- **Use case**: Set to `false` to hide Skills that Claude should use but users shouldn't invoke manually

### `disable-model-invocation`
- **Type**: Boolean
- **Required**: No
- **Default**: `false`
- **Description**: Set to `true` to block programmatic invocation via the `Skill` tool while keeping it in the slash menu.
- **Use case**: Skills that users should invoke manually but Claude shouldn't call programmatically

## Controlling Skill Visibility

Skills can be invoked in three ways:
1. **Manual invocation**: User types `/skill-name` in the prompt
2. **Programmatic invocation**: Claude calls it via the `Skill` tool
3. **Automatic discovery**: Claude reads the description and loads it when relevant

Use these frontmatter fields to control visibility:

| Setting | Slash menu | `Skill` tool | Auto-discovery | Use case |
|---------|------------|--------------|----------------|----------|
| `user-invocable: true` (default) | Visible | Allowed | Yes | Skills users can invoke directly |
| `user-invocable: false` | Hidden | Allowed | Yes | Skills Claude can use but users shouldn't invoke manually |
| `disable-model-invocation: true` | Visible | Blocked | Yes | Skills users invoke but not Claude programmatically |

## Complete Examples

### Basic Skill
```yaml
---
name: validate-changes
description: Pre-PR validation for Rush monorepo - runs lint, build, and tests on affected packages. Use before creating PRs.
allowed-tools: Bash, Read, Grep, Glob
---
```

### Skill with All Optional Fields
```yaml
---
name: code-analysis
description: Analyze code quality and generate detailed reports. Use when reviewing code or checking quality.
allowed-tools:
  - Read
  - Grep
  - Glob
context: fork
agent: general-purpose
model: claude-sonnet-4-20250514
user-invocable: false
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/security-check.sh $TOOL_INPUT"
          once: true
---
```

### Model-Only Skill (Hidden from Slash Menu)
```yaml
---
name: internal-review-standards
description: Apply internal code review standards when reviewing pull requests
allowed-tools: Read, Grep, Glob
user-invocable: false
---
```

With `user-invocable: false`, users won't see the Skill in the `/` menu, but Claude can still invoke it or discover it automatically.

## Best Practices

1. **Keep descriptions specific**: Include keywords users would naturally say
2. **Match directory name**: The `name` field should match the skill directory name
3. **Start simple**: Begin with required fields only, add optional fields as needed
4. **Test discoverability**: Check if Claude finds your Skill when you use natural language that matches the description
5. **Use allowed-tools**: Specify tools to avoid permission prompts during Skill execution
