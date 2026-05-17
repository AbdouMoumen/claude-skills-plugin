# Markdown Slide Tooling Research Report (Marp / Slidev + alternatives)

Date: 2026-05-17

## Goal

Evaluate tools for generating slide decks from markdown with a strong focus on static HTML output, plus practical export and maintenance tradeoffs.

## Shortlist

1. **Marp (marp-cli)**
2. **Slidev**
3. **Reveal.js (markdown support)**
4. **Pandoc + revealjs writer**

## Findings

### 1) Marp (marp-cli)

- Designed specifically for markdown slide conversion.
- Directly supports conversion to **HTML, PDF, PPTX, and images**.
- Good fit for low-friction, static-first workflows.
- Supports theme override/custom themes and watch/server modes.

### 2) Slidev

- Markdown-first, but with a richer app model (Vue components, interactive features).
- Supports exporting to **PDF, PPTX, PNG, and compiled markdown output**.
- Supports `slidev build` to produce a static SPA for hosting.
- Better for interactive/dev-centric presentations; more moving parts than Marp.

### 3) Reveal.js

- Very mature HTML presentation framework with markdown support, speaker notes, PDF export, and extensive API/plugin flexibility.
- Powerful but not as markdown-opinionated as Marp for quick authoring.

### 4) Pandoc + revealjs

- Strong for CLI automation and reproducible pipelines.
- Can generate HTML/JS slide shows (`-t revealjs`) and also PPTX outputs.
- More configuration-heavy than Marp for day-to-day authoring.

## Maintenance / ecosystem signal (snapshot)

- Slidev repo: very active updates and recent release activity.
- Marp CLI repo: active maintenance and recent release activity.
- reveal.js and pandoc: large, long-lived, actively maintained ecosystems.

## Recommendation

Use a **two-tier strategy** for this skill:

1. **Default engine: Marp**
   - Best default for simplified markdown → static HTML/PDF/PPTX.
   - Lowest setup and cognitive overhead.
2. **Escalation path: Slidev**
   - Use only when interactivity/component-based slides are required.
   - Use `slidev build` when hosted interactive output is needed.

This gives a stable default while preserving a path for advanced use cases.

## Why this recommendation

- The issue asks for simplified markdown and static output support; Marp is the most direct fit.
- Slidev is excellent but broader and heavier; better as an opt-in advanced mode.
- Reveal.js/Pandoc remain useful alternatives, but introduce extra configuration surface for this specific goal.

## Sources

- Marp CLI README (formats, commands, watch/server, theming):  
  https://github.com/marp-team/marp-cli
- Slidev syntax/export/build-hosting docs:  
  https://github.com/slidevjs/slidev/blob/main/docs/guide/syntax.md  
  https://github.com/slidevjs/slidev/blob/main/docs/guide/exporting.md  
  https://github.com/slidevjs/slidev/blob/main/docs/guide/hosting.md
- Reveal.js README (markdown support, PDF export, feature set):  
  https://github.com/hakimel/reveal.js/blob/master/README.md
- Pandoc manual (slide outputs including revealjs/pptx):  
  https://github.com/jgm/pandoc/blob/main/MANUAL.txt
- GitHub repository and release metadata snapshot (activity and latest releases):  
  marp-team/marp-cli, slidevjs/slidev, hakimel/reveal.js, jgm/pandoc
