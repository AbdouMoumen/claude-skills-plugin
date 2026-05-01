---
name: mcp-toggle
description: Toggle MCP servers on/off in .mcp.json and manage git skip-worktree. Use when asked to enable/disable MCP servers, toggle MCP config, or manage .mcp.json ignore state.
allowed-tools: powershell, view, edit, ask_user, grep, glob
---

# MCP Toggle

Toggle MCP servers on/off in the repo's `.mcp.json` and manage `git skip-worktree` so local changes stay ignored.

---

## Workflow

### Step 1: Locate and read `.mcp.json`

Find `.mcp.json` at the git repo root:

```
view(<repo-root>/.mcp.json)
```

Parse the JSON structure. Servers live in two sections:
- `mcpServers` — **enabled** servers (active)
- `_disabled` — **disabled** servers (inactive, preserved for re-enabling)

### Step 2: Check current git ignore state

```bash
git ls-files -v .mcp.json
```

- `S` prefix = skip-worktree is SET (local changes ignored) ✅
- `H` prefix = skip-worktree is NOT set (changes will show in git status) ⚠️

### Step 3: Prompt the user

Use `ask_user` to present the current state and let the user choose what to toggle.

Build the form dynamically from the JSON:
- List each server from `mcpServers` as **✅ Enabled**
- List each server from `_disabled` as **❌ Disabled**
- Use a **multi-select array** field so the user can pick which servers should be **enabled**
- Servers NOT selected will be disabled
- Also include a boolean field for skip-worktree management

**Example `ask_user` call:**

```
ask_user({
  message: "Select which MCP servers should be ENABLED. Unselected servers will be disabled.\n\nCurrent skip-worktree: [SET/NOT SET]",
  requestedSchema: {
    properties: {
      enabledServers: {
        type: "array",
        title: "Enabled MCP Servers",
        description: "Check the servers you want enabled. Uncheck to disable.",
        items: {
          type: "string",
          enum: ["server1", "server2", "server3"]  // all servers from both sections
        },
        default: ["server1", "server2"]  // currently enabled ones
      },
      skipWorktree: {
        type: "boolean",
        title: "Ignore .mcp.json in git (skip-worktree)",
        description: "When enabled, local changes to .mcp.json won't appear in git status or get committed.",
        default: true
      }
    },
    required: ["enabledServers"]
  }
})
```

### Step 4: Apply changes

Based on user selections, rebuild the `.mcp.json`:

1. **Collect all server configs** from both `mcpServers` and `_disabled` sections
2. **Split by selection**: selected servers go to `mcpServers`, unselected go to `_disabled`
3. **Write the file** using `edit` tool — replace the entire file content
4. If `_disabled` would be empty, omit it entirely

**Target JSON structure:**

```json
{
  "mcpServers": {
    "serverA": { ... },
    "serverB": { ... }
  },
  "_disabled": {
    "serverC": { ... }
  }
}
```

### Step 5: Manage skip-worktree

Based on the user's `skipWorktree` selection:

```bash
# To ignore local changes (default after toggling):
git update-index --skip-worktree .mcp.json

# To stop ignoring (if user explicitly unchecks):
git update-index --no-skip-worktree .mcp.json
```

### Step 6: Report results

Summarize what changed:

```
MCP Toggle complete:
  ✅ Enabled: serverA, serverB
  ❌ Disabled: serverC
  🔒 skip-worktree: SET

Note: Restart your Copilot CLI session or run /clear to pick up MCP server changes.
```

---

## Edge Cases

- **No `.mcp.json` found**: Tell the user and offer to create one
- **No `_disabled` section**: All servers are currently enabled — that's fine
- **No `mcpServers` section**: All servers are disabled — warn the user
- **File not tracked by git**: Skip the skip-worktree step (it only works on tracked files)
- **User declines the form**: Do nothing, report "No changes made"

---

## Important Notes

- The `.mcp.json` file must be valid JSON — use `edit` carefully to replace the full content
- After toggling, the user needs to restart their CLI session or run `/clear` for MCP changes to take effect
- The `_disabled` key is a convention used by this skill only — it's not part of the MCP spec
- Always preserve the full server configuration when moving between sections (don't lose any fields)
