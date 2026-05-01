---
name: plugin-creator
description: Guides through creating Claude Code plugins with slash commands, Skills, agents, hooks, and MCP servers. Use when creating distributable plugin packages.
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

# Plugin Creator

This skill guides you through creating Claude Code plugins - distributable packages that can include slash commands, Skills, agents, hooks, and MCP/LSP servers. Plugins are shareable via marketplaces and use namespaced commands to prevent conflicts.

## When to Use This Skill

Use this skill when the user asks to:
- "Create a plugin"
- "Make a new plugin for X"
- "Build a plugin that does Y"
- "Package my configurations as a plugin"

## Plugin vs Standalone Configuration

**Use a Plugin when:**
- Sharing with teammates or community
- Need same functionality across multiple projects
- Want versioned releases and easy updates
- Distributing through marketplaces
- Okay with namespaced slash commands (`/plugin-name:command`)

**Use Standalone .claude/ when:**
- Personal, project-specific customizations
- Quick experiments
- Want short command names (`/hello` vs `/plugin:hello`)

## Plugin Components

Plugins can include:
- **Slash commands** - Markdown files in `commands/`
- **Skills** - SKILL.md files in `skills/` subdirectories
- **Agents** - Custom agent definitions in `agents/`
- **Hooks** - Event handlers in `hooks/hooks.json`
- **MCP servers** - Configuration in `.mcp.json`
- **LSP servers** - Configuration in `.lsp.json`

## Phase 1: Discovery

### Ask the User

Ask these questions to understand requirements:

1. **"What should this plugin do?"**
   - Get a clear description of the plugin's purpose
   - Example: "Validate code changes before PRs"

2. **"What components should it include?"**
   - Slash commands? What commands and what do they do?
   - Skills? What capabilities should Claude have?
   - Hooks? What events should trigger actions?
   - MCP/LSP servers? What integrations needed?

3. **"What should we name it?"**
   - Use kebab-case: `code-reviewer`, `test-helper`
   - This becomes the namespace: `/code-reviewer:check`
   - Keep it concise and descriptive (1-3 words)

4. **"Where should we create it?"**
   - Current directory?
   - Specific path?

5. **"Will this be shared?"**
   - Personal use only?
   - Team/organization?
   - Public distribution?

### Check for Similar Plugins

Look for existing plugins or .claude/ configurations to reference:

```bash
ls -la .claude/commands/ 2>/dev/null
ls -la .claude/skills/ 2>/dev/null
ls -la ~/.claude/skills/ 2>/dev/null
```

### Output of This Phase

Document your understanding:
```
PLUGIN NAME: <kebab-case-name>
PURPOSE: <one-sentence description>
COMPONENTS:
  - [ ] Slash commands: <list>
  - [ ] Skills: <list>
  - [ ] Hooks: <list>
  - [ ] MCP/LSP: <list>
LOCATION: <path>
AUDIENCE: <personal/team/public>
```

## Phase 2: Create Plugin Structure

### Create Directory Structure

Create the plugin root and manifest directory:

```bash
mkdir -p <plugin-name>/.claude-plugin
```

**CRITICAL**: All component directories go at the plugin root, NOT inside `.claude-plugin/`:

```
plugin-name/
├── .claude-plugin/
│   └── plugin.json          (manifest - ONLY FILE HERE)
├── commands/                 (at root level)
├── skills/                   (at root level)
├── agents/                   (at root level)
├── hooks/                    (at root level)
│   └── hooks.json
├── .mcp.json                (at root level)
└── .lsp.json                (at root level)
```

### Create the Manifest

Create `.claude-plugin/plugin.json` with metadata:

```json
{
  "name": "plugin-name",
  "description": "What the plugin does and when to use it",
  "version": "1.0.0",
  "author": {
    "name": "Author Name"
  }
}
```

**Required fields:**
- `name`: Unique identifier (kebab-case, becomes namespace)
- `description`: Shown in plugin manager
- `version`: Semantic versioning (MAJOR.MINOR.PATCH)

**Optional fields:**
- `author.name`: Creator attribution
- `author.email`: Contact info
- `homepage`: Documentation URL
- `repository`: Source code URL
- `license`: License identifier (MIT, Apache-2.0, etc.)

## Phase 3: Add Components

### Add Slash Commands

Create `commands/` directory and add Markdown files:

```bash
mkdir -p <plugin-name>/commands
```

Each command is a `.md` file with frontmatter:

```markdown
---
description: What this command does
---

# Command Name

Instructions for Claude on how to respond.

Use $ARGUMENTS to capture user input.
Use $1, $2, $3 for individual positional arguments.
```

**Example command** (`commands/greet.md`):
```markdown
---
description: Greet the user warmly
---

# Greet Command

Greet the user named "$ARGUMENTS" warmly and ask how you can help them today.
```

**Command naming:**
- Filename becomes command name: `greet.md` → `/plugin-name:greet`
- Use lowercase, hyphens for multi-word: `code-review.md`

### Add Skills

Create `skills/` directory with skill subdirectories:

```bash
mkdir -p <plugin-name>/skills/<skill-name>
```

Each skill needs a `SKILL.md` file with frontmatter:

```markdown
---
name: skill-name
description: What the skill does - how it works. When to use it.
allowed-tools: Bash, Read, Grep, Glob
---

# Skill Title

Instructions for Claude with step-by-step workflow.

## Workflow

### Step 1: Name
Detailed instructions and commands.

### Step 2: Name
More instructions.

## Output Format
How to structure the output.
```

**Key points:**
- Skills are model-invoked (Claude uses them automatically)
- Description must include keywords users would naturally say
- Output structured data, not suggestions
- Use progressive disclosure for complex skills

### Add Hooks

Create `hooks/` directory and `hooks.json`:

```bash
mkdir -p <plugin-name>/hooks
```

Create `hooks/hooks.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "npm run lint:fix $FILE"
          }
        ]
      }
    ]
  }
}
```

**Available hook types:**
- `PreToolUse`: Before tool execution
- `PostToolUse`: After tool execution
- `UserPromptSubmit`: After user sends message

**Matchers:**
- Tool names: `Write`, `Edit`, `Read`
- Regex patterns: `Write|Edit`

### Add MCP Servers

Create `.mcp.json` at plugin root:

```json
{
  "mcpServers": {
    "server-name": {
      "command": "node",
      "args": ["path/to/server.js"]
    }
  }
}
```

### Add LSP Servers

Create `.lsp.json` at plugin root:

```json
{
  "language-id": {
    "command": "language-server-binary",
    "args": ["--stdio"],
    "extensionToLanguage": {
      ".ext": "language-id"
    }
  }
}
```

## Phase 4: Add Documentation

### Create README.md

Every plugin should have a README:

```markdown
# Plugin Name

Brief description of what the plugin does.

## Installation

From a marketplace:
```bash
claude --plugin-dir /path/to/plugin
```

Or install via marketplace URL.

## Components

### Slash Commands
- `/plugin-name:command` - Description

### Skills
- skill-name - Description

### Hooks
- Description of automated behaviors

## Usage Examples

Show common use cases.

## Configuration

Any settings or requirements.

## License

License information.
```

## Phase 5: Test the Plugin

### Local Testing

Test the plugin with `--plugin-dir`:

```bash
claude --plugin-dir /path/to/<plugin-name>
```

### Validation Checklist

- [ ] Manifest exists at `.claude-plugin/plugin.json`
- [ ] All required fields in manifest (name, description, version)
- [ ] Commands have proper frontmatter
- [ ] Skills have proper frontmatter and workflow
- [ ] Hooks use correct syntax
- [ ] README.md exists with usage instructions
- [ ] All directories are at plugin root (not in .claude-plugin/)

### Test Each Component

**Slash commands:**
```bash
/plugin-name:command-name [args]
```

**Skills:**
- Restart Claude Code to load skills
- Trigger skill by asking relevant question
- Verify skill activates automatically

**Hooks:**
- Perform action that triggers hook
- Verify command executes

## Phase 6: Present to User

### Show Plugin Structure

Display the created structure:

```bash
find <plugin-name> -type f
cat <plugin-name>/.claude-plugin/plugin.json
```

### Summary

Present a summary:

```
✓ Created plugin: <plugin-name>
✓ Location: <path>
✓ Components:
  - X slash commands
  - X skills
  - X hooks

To test:
  claude --plugin-dir /path/to/<plugin-name>

Commands available:
  /plugin-name:command1
  /plugin-name:command2
```

### Next Steps

Suggest next steps:
- Test locally with `--plugin-dir`
- Create marketplace for distribution
- Add to team repository
- Share with community

## Common Patterns

### Simple Command Plugin

Just slash commands, no other components:
```
my-plugin/
├── .claude-plugin/
│   └── plugin.json
├── commands/
│   ├── hello.md
│   └── goodbye.md
└── README.md
```

### Skill-Focused Plugin

Primarily Skills with supporting commands:
```
my-plugin/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   ├── code-review/
│   │   └── SKILL.md
│   └── test-coverage/
│       └── SKILL.md
├── commands/
│   └── review.md
└── README.md
```

### Automation Plugin

Hooks and commands working together:
```
my-plugin/
├── .claude-plugin/
│   └── plugin.json
├── hooks/
│   └── hooks.json
├── commands/
│   ├── setup.md
│   └── check.md
└── README.md
```

## Migration from .claude/

If converting existing .claude/ configuration:

1. **Create plugin structure** with manifest
2. **Copy directories** to plugin root:
   ```bash
   cp -r .claude/commands <plugin-name>/
   cp -r .claude/skills <plugin-name>/
   ```
3. **Extract hooks** from settings.json to hooks/hooks.json
4. **Test** with `--plugin-dir`
5. **Remove** originals from .claude/ to avoid duplicates

## Important Reminders

**Directory structure:**
- ONLY `plugin.json` goes in `.claude-plugin/`
- ALL other files/folders at plugin root

**Naming:**
- Plugin name becomes namespace
- Commands: `filename.md` → `/plugin-name:filename`
- Use kebab-case for consistency

**Skills:**
- Model-invoked (automatic activation)
- Description is critical for discovery
- Output structured data for Claude

**Testing:**
- Always test with `--plugin-dir` first
- Restart Claude Code after changes
- Verify all components work

**Versioning:**
- Use semantic versioning (1.0.0)
- Update version when making changes
- Document changes in README

## Summary

Creating a plugin involves:

1. **Discovery** - Understand requirements and components
2. **Structure** - Create directories and manifest
3. **Components** - Add commands, skills, hooks, etc.
4. **Documentation** - Write README with usage
5. **Testing** - Validate with `--plugin-dir`
6. **Distribution** - Share via marketplace

Follow this workflow, use the checklist, and reference the documentation at https://code.claude.com/docs/en/plugins.md for complete specifications.
