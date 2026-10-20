---
name: html-canvas
description: Show rich or interactive HTML (mockups, explainers, diagrams, charts, comparisons, small widgets) in the HTML Canvas panel of the GitHub Copilot app, and handle messages that pages send back. Use when a visual would explain something better than chat text, when the user asks to "show", "mock up", "visualize", or "render" something, or when a message starting with "[HTML Canvas ·" arrives.
---

# HTML Canvas

Render HTML straight into a panel. Don't write HTML files or start a server for this.

## Showing content
- **Panel:** reuse an open HTML Canvas panel's instanceId from canvas context. Otherwise `open_canvas` with canvasId `html-canvas`, a short descriptive instanceId, and `{ html, title }`.
- **Updates:** `invoke_canvas_action` `render` adds a new history page; the user can step back to earlier versions. Pass `replace: true` only for small fixes to the page that's showing. Use `list` / `go` to revisit pages.
- **Separate panels** only for things the user wants side by side.
- **Style:** prefer an HTML fragment; it's wrapped in a page that already uses the app theme. In full documents, use the theme variables (`--background-color-default`, `--text-color-default`, `--text-color-muted`, `--border-color-default`, `--font-sans`, `--font-mono`, `--true-color-blue`, …) so the page follows light/dark mode.
- **Libraries:** CDN scripts, fonts, and images load fine (Chart.js, Mermaid, Tailwind, …). Keep pages self-contained otherwise; there's no local server to fetch from.
- After rendering, reply in a line or two; don't repeat the page's content in chat.

## Interactive pages
When you need the user's choice or input, give the page controls that call `copilot.send(text, data?)`: a readable `text` sentence plus optional JSON `data`. It reaches you immediately as a chat message.

## Incoming messages
A message like `[HTML Canvas · "<title>" (page n), panel <instanceId>] <text>` plus an optional `Data:` block was sent by the user from a page. Treat it as the user's answer or request in that page's context and act on it. If the next step is visual, render the update into the same panel.
