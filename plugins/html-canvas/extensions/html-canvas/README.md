# 🖼️ HTML Canvas

A canvas for the GitHub Copilot app that lets the agent render HTML straight into a side panel, for things like mockups, explainers, diagrams, and small interactive widgets. The agent doesn't need to write a file by hand or start a local server.

Ask "show me a mockup of …" or "render that as HTML" to use it.

## Panel
- **Toolbar**: ‹ / › move through the panel's history. The dropdown lists every page by title, with `n/m` showing your position. ↻ reloads the current page.
- **Page**: the rendered HTML, in a sandboxed frame. Scripts and external resources (CDN libraries, web fonts, remote images) are allowed.
- **Theme**: the app's theme tokens are forwarded into the page, so `var(--text-color-default)`, `var(--background-color-default)`, `var(--border-color-default)`, `var(--font-sans)`, and the others work there too, and they follow light/dark switches. HTML fragments (no `<html>`/`<!doctype>`) are wrapped in a page that already uses them.

## Talking back to the agent
Pages can call `copilot.send(text, data?)`, for example from a button or a form. The message goes to the agent right away as a chat message tagged with the page and panel:

```html
<button onclick="copilot.send('User picked option B', { option: 'B' })">Choose B</button>
```

`data` is optional and must be JSON-serializable. Each panel can send at most one message per second. A toast confirms each send.

## Agent actions
| Action | Purpose |
|---|---|
| `render` | Render `html` (with an optional `title`) as a new history page. Pass `replace: true` to overwrite the current page instead. `open_canvas` also accepts `{ html, title }`. |
| `list` | List the history pages (title, time, saved file) and which one is shown. |
| `go` | Show history page `page` (1-based). |

## Storage
Each panel's history is saved in the session folder under `files/html-canvas/<instanceId>/`: one `.html` file per page plus `index.json`. Re-opening the same `instanceId` restores it, even after a reload or app restart, and the pages also show up in Session Files. History keeps the 50 most recent pages. Rendering after going back drops the pages ahead of it, the way a browser does.

## Security
- The server listens only on `127.0.0.1`, under a random per-run URL token, and rejects requests whose `Host` header doesn't match.
- Pages are served with a `sandbox` CSP and iframe sandbox and no `allow-same-origin`, so they get an opaque origin. They can't read the panel, its API, or the app.
- The panel's endpoints only accept `POST` JSON from the panel's own origin, so a rendered page can only reach the agent through `copilot.send`, which the panel relays.

## Files
- `extension.mjs`: wiring (canvas, actions, sending page messages to the agent)
- `server.mjs`: loopback HTTP server, history storage, page serving with the injected `copilot` bridge, SSE live updates
- `ui.html` / `ui.css` / `ui.js`: panel UI (toolbar, sandboxed frame, theme and message relay)
- `copilot-extension.json`: manifest required for sharing via gist

The plugin also ships the `html-canvas` skill (`plugins/html-canvas/skills/html-canvas/SKILL.md`). It tells the agent when to reach for the panel, how to keep pages themed and interactive, and how to handle `[HTML Canvas · …]` messages.

## Install
```bash
copilot plugin marketplace add AbdouMoumen/claude-skills-plugin
copilot plugin install html-canvas@claude-skills
```
Then ask Copilot to "reload extensions" (or start a new session) and approve `html-canvas` when the app asks. To install without the plugin, copy this folder to `~/.copilot/extensions/html-canvas/`.
