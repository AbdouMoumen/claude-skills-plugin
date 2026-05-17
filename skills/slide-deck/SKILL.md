---
name: slide-deck
description: "Create presentation slide decks from simplified Markdown, then export or host them with an appropriate markdown slide engine. Use when the user asks for slides, decks, presentations, or markdown-to-slide conversion."
allowed-tools: Bash, Read, Write, Edit, Grep, Glob
---

# Slide Deck

Create a slide deck from simplified markdown and choose the best slide engine based on delivery needs.

Use the research summary in `reference/research-report.md` when the user asks for tradeoffs, recommendations, or tooling decisions.

---

## Workflow

### 1) Gather requirements first

Confirm:
- Audience, duration, and tone
- Output format(s): static HTML, PDF, PPTX, images
- Interactivity needs (live demos, components, animations)
- Delivery mode: single-file artifact vs hosted interactive site

If unknown, ask clarifying questions before generating files.

### 2) Pick engine with a clear rule

Default to a **lightweight static-slide engine** when the user wants:
- Fast authoring in near-plain Markdown
- Static HTML/PDF/PPTX export
- Minimal tooling and predictable output

Use an **interactive slide framework** when the user wants:
- Interactive slides (components, live demos)
- Rich presenter/developer features
- Hosted interactive SPA output

### 3) Convert simplified markdown into slide markdown

Normalize content into:
- Headmatter/frontmatter (title/theme/options)
- `---` separators for slides
- Consistent heading hierarchy
- Speaker notes in tool-supported form

Keep source concise: one idea per slide.

### 4) Generate artifacts

Use the selected toolchain's native commands to generate required outputs:
- Static HTML
- PDF
- PPTX (if requested)
- Hosted bundle (if requested)

If the user explicitly names a tool, honor it unless constraints make it non-viable.

### 5) Return structured output

Always return:
- Chosen engine + reason
- Generated source file path(s)
- Export/build command(s)
- Produced artifact path(s)
- Any limitations (for example: interactivity not preserved in static exports)

---

## Constraints

- Prefer the smallest setup that satisfies requirements.
- Do not force interactivity when static output is enough.
- If the user requests a tool comparison or recommendation, summarize from `reference/research-report.md` first.
