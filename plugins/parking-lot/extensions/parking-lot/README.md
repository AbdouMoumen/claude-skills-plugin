# 🅿️ Parking Lot

A per-session backlog canvas for the GitHub Copilot app. Use it to park ideas you want to explore later. The agent sees them each turn but never acts on them unless you ask, and it can cross off items its current work happened to complete.

## Agent tools
| Tool | Purpose |
|---|---|
| `parking_list` | Read open items (optionally include done ones), with full attachment paths. |
| `parking_add` | Add an item, optionally with `attachments` (absolute file paths). Only used when you ask. |
| `parking_update` | Set `open` / `in_progress` / `done`, and/or add `attachments`. A completion note is required for `done`. `status` can be omitted to only attach files. |

The agent has no tool for deleting or rewording items or removing attachments; you do that in the panel. On each prompt, a hook gives the agent up to 10 open items, labeled "do NOT act unless asked". Items with attachments show only a `📎N` marker there; the agent calls `parking_list` for the paths.

Say "show the parking lot" or run `/parking-lot` (or `/parking-lot open`) to open the panel. `/parking-lot list` shows open items, `/parking-lot next` shows the topmost one and asks before starting it, `/parking-lot work <n>` works an item, and `/parking-lot <text>` parks a new one. Natural phrasing works too: "what's next", "do #3". The plugin's `parking-lot` skill (`plugins/parking-lot/skills/parking-lot/SKILL.md`) handles all of these. It treats text as a new item only when it reads like an idea or task, and asks if it's unsure.

Each open item in the panel has two send buttons. **▶ Queue** sends `/parking-lot work <n> — <item text>` to the agent after its current work finishes (followed by `📎N` if the item has attachments), with `Notes: …` on the next line if the item has notes. **⚡ Now** steers the agent immediately. Both mark the item `in_progress`. With the skill, the agent marks the item `done` with a completion note when it finishes. For questions or decisions, it checks with you before marking them done. Extension-sent prompts deliver slash commands as plain text, so the agent picks up the skill from its description rather than from slash-command expansion. To edit an item's text or notes, hover the row and click **✎ Edit**, or double-click the text.

Each row shows a small relative time: `added 3d ago` for open items, `done 2h ago` for done ones. Hover it for the full local date and time. Done items are listed most recently completed first; open items keep your drag order.

### Notes and attachments
- **Notes**: in the add box, press **Shift+Enter** to open a notes field; **Enter** adds the item with its notes. Notes are plain text with line breaks kept and `http(s)` links clickable. In the list they're clamped to two lines; click to expand or collapse.
- **Pasting files**: paste screenshots or files into the add-box notes field or the ✎ edit form. Each is copied to `<session workspace>/files/parking-lot/` (images as `<uuid>-clipboard.<ext>`, other files as `<uuid>-<name>`), up to 25 MB each. Pasted text still pastes as text.
- **Agent references**: the agent can attach existing files by absolute path. These are linked, never copied or deleted.
- **Chips**: attachments show as 📎 chips under the notes. Copied images get a thumbnail; click it to enlarge. Hover a chip for its full path. Referenced files that no longer exist are dimmed with ⚠. Remove an attachment with its × in the ✎ edit form; removing a copy deletes its file.
- **Cleanup**: marking an item done keeps everything. Deleting an item or **Clear done** deletes its copied files (the confirm says how many); referenced files are never touched.

## Data
Stored in `<session workspace>/files/parking-lot.json`, with pasted attachments in `<session workspace>/files/parking-lot/`: one list per session, removed along with the session.

## Files
- `extension.mjs`: wiring (canvas, tools, prompt hook)
- `store.mjs`: JSON persistence with serialized, atomic writes
- `server.mjs`: loopback HTTP server, JSON API, SSE live updates, attachment upload and serving (by item + attachment id only)
- `ui.html` / `ui.css` / `ui.js`: panel UI (plain JS, uses the app's theme tokens)
- `copilot-extension.json`: manifest required for sharing via gist

## Setup

**Requirements:** the GitHub Copilot app (canvas support). Nothing to install separately: the app provides Node and the Copilot SDK, so there's no `npm install`.

### 1. Install
Choose one:
- **As the `parking-lot` plugin** (recommended): install the plugin, then ask Copilot to "reload extensions" or start a new session.
  ```bash
  copilot plugin marketplace add AbdouMoumen/claude-skills-plugin
  copilot plugin install parking-lot@claude-skills
  # later: copilot plugin update parking-lot
  ```
  It loads as a plugin extension. The plugin is Copilot-only; Claude Code's marketplace doesn't list it.

  > **Upgrading from `claude-skills` 1.4.0?** Parking Lot used to ship inside `claude-skills`. After `copilot plugin update claude-skills`, run `copilot plugin install parking-lot@claude-skills` to keep it.
- **From GitHub**: in any Copilot chat, ask:
  > Install the extension from `https://github.com/AbdouMoumen/claude-skills-plugin/tree/main/plugins/parking-lot/extensions/parking-lot` with user scope
- **From a gist**: Command palette → **Install extension from gist…**, paste the gist URL, and choose **User** scope.
- **Manually**: copy this folder to `~/.copilot/extensions/parking-lot/` (Windows: `%USERPROFILE%\.copilot\extensions\parking-lot\`), then ask Copilot to "reload extensions".

For the non-plugin options, use **user** scope so it's available in every session. Each session still gets its own list.

> **Installed both ways?** If you also have a user-level copy in `~/.copilot/extensions/parking-lot/`, delete it. Two copies register the same tool names (`parking_add`, `parking_list`, `parking_update`) and conflict.

### 2. Approve
The first time it loads, the app asks you to allow `parking-lot`. Approve it. If you dismissed the prompt, ask Copilot to "reload extensions" to get it again.

### 3. Verify
- Ask "show the parking lot" and the panel should open on the right.
- Type an idea in the panel and press Enter. On your next message the agent will know about it, and asking "what's in my parking lot?" will list it.

### Update / uninstall
- **Update**: plugin install: `copilot plugin update parking-lot`. Other installs: reinstall from the same URL (or `git pull` in the folder). Then "reload extensions".
- **Uninstall**: plugin install: `copilot plugin uninstall parking-lot`. Manual install: delete `~/.copilot/extensions/parking-lot/`. Then "reload extensions".

### Troubleshooting
- **Panel or tools missing**: ask Copilot to "inspect the parking-lot extension". It reports the extension's status and the end of its log file.
- **"denied permission access" in the log**: the approval prompt was dismissed. Reload extensions and approve it.
- **Blank panel after a reload**: ask "show the parking lot" again so the panel points at the extension's new local address.

## Sharing
- **GitHub repo** (versioned; best for multiple machines): push this folder and share the folder URL from step 1.
- **Gist** (quick): Command palette → **Share extension as gist…**. `copilot-extension.json` is the manifest this requires.
