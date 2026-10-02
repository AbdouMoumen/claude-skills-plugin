---
name: parking-lot
description: List, open, add to, or work items from the Parking Lot (a per-session backlog canvas in the GitHub Copilot app). Use for `/parking-lot`, "show the parking lot", "what's next in the parking lot", "park this", or "work on Parking Lot #n".
argument-hint: "[list | next | work <n> | ask <n> | open | <idea>]"
---

# Parking Lot

| Command | Natural-language equivalents | Do |
|---|---|---|
| `list` | "what's in there", "show me the items" | `parking_list`, then show the open items numbered, in order. |
| `next` | "what's next", "grab the next one" | Show the topmost open item and ask whether to start it. Don't start it automatically. |
| `work <n>` | "do #3", "work on Parking Lot #n", or `/parking-lot work <n> — <text>` sent by the panel's ▶ Queue / ⚡ Send now actions (it arrives as plain text, not an expanded slash command; a trailing `📎N` means the item has attachments) | Find the item with `parking_list` (include done items) and read any attachment paths it lists; set it `in_progress` if it isn't already; do the work; then mark it `done` with `parking_update` and a one-line completion note. If the item is a question or a decision, answer it and ask the user before marking it done. |
| `ask <n>` | "what do you think about #3", "tell me about #n", or `/parking-lot ask <n> — <text>` sent by the panel's Ask action | Find the item with `parking_list` (include done items) and read any attachments. Answer or discuss it without doing the work or changing its status. Offer to work it or mark it done; do either only if the user agrees. || `open`, or no args | "open canvas", "show", "show the parking lot" | `open_canvas` with canvasId `parking-lot`. Reuse the instanceId of an already open Parking Lot panel (from canvas context); otherwise use `parking-lot`. |
| `<text>` | "park this: …" | `parking_add`, then confirm in one line. |

**Intent rule:** match the commands above and their natural-language equivalents before treating the text as a new item. Add an item only when the text reads like an idea or task to capture. If you're unsure, ask in one line instead of adding it.

Only act on parked items when asked to.
