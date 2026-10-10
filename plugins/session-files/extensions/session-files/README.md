# 🗂️ Session Files

A canvas for the GitHub Copilot app that browses and previews the files in the current session's folder (`~/.copilot/session-state/<session>/`). That's where the agent writes plans, notes, research, and checkpoints.

Ask "show the session files" or "open session files" to open it.

## Panel
- **Tree** (left): the session folder, with `files/` (artifacts) first. Files get a colored icon by type (Markdown, code, JSON, data, images, PDFs, config, shell scripts, archives, databases, locks), and folders show open or closed; `files/`, `research/`, `checkpoints/`, and `extensions/` each have their own folder color. It hides the session's own top-level bookkeeping files (`events.jsonl`, `session.db`, locks); tick **internal** to show them. Each file shows its age, and a blue dot means it changed after the panel opened. Type in the filter box to search by path. ↑ / ↓ moves between files.
- **Preview** (right):
  - Markdown is rendered (headings, lists, task lists, tables, code, links, images). Relative links to other session files open in the panel.
  - HTML is shown in a sandboxed frame. Images and PDFs are shown inline. JSON is pretty-printed.
  - Other text is shown as-is. Binary files have no preview; use **Open** or **Show in folder**.
  - **Source** switches Markdown, HTML, and JSON to the raw text, and **Copy path** copies the absolute path. Text previews stop at 1 MB.
- **Open on your computer**: **Open** (or double-clicking a file in the tree) opens the file in its default app. **Show in folder** selects it in Explorer or Finder. Hover a folder and click ↗ to open it; the ↗ in the header opens the whole session folder. File types that would run code when opened (`.exe`, `.bat`, `.ps1`, `.js`, `.py`, `.sh`, shortcuts, …) are shown in their folder instead of opened.
- **Live**: the tree and the open preview refresh when files change.

## Agent actions
| Action | Purpose |
|---|---|
| `list` | List the files (relative path, size, modified time). Pass `internal: true` to include the bookkeeping files. |
| `reveal` | Select and preview a file in the open panel. `open_canvas` also accepts `{ "path": ... }` to open on a file. |

Paths are relative to the session folder (absolute paths inside it work too). The panel never modifies, renames, or deletes anything.

## Security
- The server listens only on `127.0.0.1`, under a random per-run URL token, and rejects requests whose `Host` header doesn't match.
- Every path is resolved with symlinks followed and must stay inside the session folder.
- HTML and SVG files are served with a sandboxing CSP, so their scripts can't reach the panel or its API.
- The open endpoint only accepts `POST` with a JSON body (which forces a CORS preflight that's never approved), and it never runs executable file types.

## Files
- `extension.mjs`: wiring (canvas and actions)
- `server.mjs`: loopback HTTP server, folder walk, file serving, file watcher with SSE live updates
- `ui.html` / `ui.css` / `ui.js`: panel UI (plain JS with a small built-in Markdown renderer; uses the app's theme tokens)
- `icons.js`: built-in file and folder icon set (inline SVG, mapped by extension)
- `copilot-extension.json`: manifest required for sharing via gist

## Install
```bash
copilot plugin marketplace add AbdouMoumen/claude-skills-plugin
copilot plugin install session-files@claude-skills
```
Then ask Copilot to "reload extensions" (or start a new session) and approve `session-files` when the app asks. To install without the plugin, copy this folder to `~/.copilot/extensions/session-files/`.
