# Dotfiles Repo Location Strategies

The `dotfiles-sync` skill must work from any project, so it cannot assume the current working directory is the dotfiles repository.

## Recommended Strategy: Hybrid Auto-Detect + Saved Pointer

Use a deterministic resolution order:

1. Current git repository root.
2. Existing symlink back-references.
3. Environment variables.
4. Machine-local pointer file.
5. Common-path search.
6. User-provided path.

This provides fast operation after setup while still bootstrapping clean machines.

## Candidate Validation

Accept a path only when it contains the expected repository markers:

- `SETUP.md`
- `CLAUDE.md`
- `copilot/prompts/`

Do not accept a path only because it is named `dotfiles`.

## Strategy Details

### Current repository

Best when the agent is already opened in the dotfiles repo. It is immediate and needs no machine state.

### Symlink back-reference

Best after initial setup. Existing links such as VS Code `User/prompts` or `~/.copilot/mcp-config.json` can be resolved back to the repository.

Limit: cannot bootstrap a brand-new machine before links exist.

### Environment variable

Examples:

- `DOTFILES_REPO`
- `DOTFILES_DIR`

Benefits:

- Explicit.
- Scriptable.
- Easy to override per machine.

Limits:

- Requires shell/profile setup on each machine.
- May not be visible to every terminal or app launch context.

### Machine-local pointer file

Recommended pointer file:

```json
{
  "repoPath": "/absolute/path/to/dotfiles"
}
```

Recommended locations:

- `~/.claude/dotfiles-sync.json` (Claude Code)
- `~/.copilot/dotfiles-sync.json` (Copilot CLI)

Benefits:

- Works globally from any project.
- Avoids hard-coding public paths in the repo.
- Easy to update if the repo moves.

Rules:

- This file is machine-local and must not be committed.
- Always validate the stored path before using it.
- If invalid, ignore it and continue resolution.

### Common-path search

Useful fallback locations:

- `~/dotfiles`
- `~/src/github/dotfiles`
- `~/github/dotfiles`
- `~/repos/dotfiles`
- Windows equivalents under `%USERPROFILE%`.

Limits:

- Can be ambiguous if multiple clones exist.
- Should be bounded to avoid slow full-disk searches.

### Hard-coded path

Use only as a non-authoritative hint supplied by the user or by local context. Do not bake a personal path into the skill as the only source of truth.

## Recommended Persistence Flow

When a user-provided or common-path candidate is validated:

1. Ask whether to save it as the machine-local pointer.
2. Create `~/.claude/` or `~/.copilot/` if it does not exist.
3. Write the pointer file with the absolute repo path.
4. On future runs, still validate before use.
