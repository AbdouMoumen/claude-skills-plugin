---
name: parking-lot
description: Open, add to, or work items from the Parking Lot (a per-session backlog canvas in the GitHub Copilot app). Use for `/parking-lot`, "show the parking lot", "park this", or "work on Parking Lot #n".
---

# Parking Lot

Pick the mode from the arguments:

- **No args**: open the canvas with `open_canvas`, canvasId `parking-lot`. If a Parking Lot panel is already open, reuse its instanceId from the canvas context; otherwise use instanceId `parking-lot`.
- **`work <n>`**, or "work on Parking Lot #n" (what the panel's ▶ / ⚡ buttons send):
  1. Find item `n` with `parking_list` (include done items). If it isn't `in_progress`, set it with `parking_update`.
  2. Do the work.
  3. Mark it `done` with `parking_update` and a one-line completion note. If the item is a question or a decision, answer it and ask the user before marking it done.
- **Any other text**: add it with `parking_add`, then confirm in one line (e.g. "Parked #7.").

Only act on parked items when asked to.
