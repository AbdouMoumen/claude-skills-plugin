---
name: slide-deck
description: "Create presentation slide decks from simplified Markdown, then export or host them using Marp or Slidev. Use when the user asks for slides, decks, presentations, Marp, or Slidev."
allowed-tools: Bash, Read, Write, Edit, Grep, Glob
---

# Slide Deck

Create a slide deck from simplified markdown and choose the best engine (`Marp` or `Slidev`) based on delivery needs.

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

Default to **Marp** when the user wants:
- Fast authoring in near-plain Markdown
- Static HTML/PDF/PPTX export
- Minimal tooling and predictable output

Use **Slidev** when the user wants:
- Interactive slides (Vue components, live demos)
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

#### Marp path

```bash
npx @marp-team/marp-cli@latest slides.md -o slides.html
npx @marp-team/marp-cli@latest slides.md --pdf -o slides.pdf
npx @marp-team/marp-cli@latest slides.md --pptx -o slides.pptx
```

#### Slidev path

```bash
npm init slidev@latest
slidev build
slidev export --format pdf
slidev export --format pptx
```

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
