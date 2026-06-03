# `skill-review` skill — design

Design for a generic skill-review skill that lives in this plugin alongside `forge`. Reviews other skills (own or others') against a 9-axis rubric and emits conversational, severity-tagged findings with mandatory suggested fixes.

The design was derived from the experience of running an ad-hoc review on the `pr-watch` skill in `bic/app-studio`. The full grilling that produced this design is preserved as an appendix at the end of this document.

## Purpose

Surface issues that make a skill misleading, unclear, inconsistent, bloated, unsafe, or otherwise unfit for an LLM agent to consume. The tone is conversational — not a compliance audit. Findings carry priority and actionable fixes.

## The 9 axes

| # | Axis | Always-on? | Trigger signal (if conditional) |
|---|---|---|---|
| 1 | Discoverability — frontmatter triggers correctly | Always | — |
| 2 | Clarity — agent can act without guessing | Always | — |
| 3 | Correctness — claims match reality (commands work, APIs exist) | Always | — |
| 4 | Internal consistency — no self-contradictions or prose↔script drift | Always | — |
| 5 | To-the-point / necessity at every level — sentences, sections, scripts, modes, files all earn their existence (broadened to absorb KISS) | Always | — |
| 6 | Safety — destructive ops guarded | Conditional | Scripts contain `rm`, `git push`, `--force`, `gh pr ...`, `DELETE` (HTTP), OR destructive intent in prose |
| 7 | Untrusted-input boundary — external content treated as data, not instructions | Conditional | SKILL.md or scripts mention PR comments, issue bodies, web fetch, curl, gh api response bodies, file content from outside skill dir |
| 8 | Cross-skill fit — no overlap or conflict with siblings | Conditional | More than one skill in same install location with overlapping name patterns or domain words |
| 9 | Design coherence — modes, signals, state transitions form a deliberate model (not ad-hoc accretion) | Conditional | `scripts/` has multiple files OR SKILL.md mentions modes / state / signals / wake sources OR daemon-like behavior |

**Per-axis specification:** each axis = single guiding question + 2-3 concrete failure examples drawn from real skill content. Examples anchor judgment without forcing yes/no checklists.

**Conditional axes use soft triggers:** the mechanical signals fire the axis by default; the reviewer can suppress (false positive) or escalate (signal missed) by writing a one-line reason for auditability.

## Self-improving example bank

Each axis carries 2-3 examples. The bank is bounded (16-24 total) and replacements are proposed in the review output (not auto-applied).

- **Cap:** 2-3 per axis. Adding requires demoting one — forces curation pressure.
- **Replacement criterion:** new example must (a) come from a skill actually reviewed this session (not synthetic, not from memory), AND (b) illustrate the failure more sharply than the incumbent. Agent must write *why* the replacement is better.
- **Anti-churn:** incumbent wins ties. Default is stability.
- **Scope:** examples are skill-file content only — never PR bodies, runtime captures, or secrets.
- **Initial seed:** drawn from the `pr-watch` review artifacts that prompted this design.

## Workflow modes

The skill adapts to the complexity of the target skill:

| Mode | Trigger | Architecture |
|---|---|---|
| **Light** (default) | Zero conditional axes triggered AND no `scripts/` dir AND SKILL.md ≤ ~200 lines | 1 sync subagent (general-purpose) with rubric + skill dir path; main agent only orchestrates and formats findings |
| **Thorough** (escalated) | Any of: 2+ conditional axes triggered, scripts present, SKILL.md > ~200 lines, design-coherence trigger fired | 3 sync subagents in parallel — general-purpose (rubric), rubber-duck (rubric, skeptical lens), forge (prompt-craft lens, no rubric); main agent merges with provenance tags |

**Why subagent-driven:** keeps the main agent's context lean. Source files are read inside subagents; findings come back compact. User can iterate on fixes ("apply finding 2 and 4") without dragging the skill's source files into the main context.

**Grilling:** up to 3 mid-review questions when ambiguity affects (a) whether a finding fires at all, or (b) the recommended fix. One question at a time, each carrying its impact ("answer affects whether finding X fires"). If 3 questions wouldn't be enough, the skill bails: *"this skill is too unclear to review — needs author input first."*

## Invocation

User passes either a skill name (`"review the onboard skill"`) or a path. The agent resolves the location using its own knowledge of where skills live — the skill does not enumerate search paths.

## Output

Two destinations, both populated:

1. **Chat** — immediate visibility, drives iteration.
2. **File in session's persistent scratch directory** — persistence across checkpoints.

**Structure:**

- **Short opener** (2-3 sentences): skill name, mode used, axes triggered, axes suppressed and why.
- **Findings**, sorted by severity (no per-axis verdict grid).
- **Candidate example updates** (only if applicable): proposals to swap an incumbent example for a sharper one from the just-reviewed skill, with "why better" justification.

**Per-finding shape (4 lines):**

```
[severity] [axis] location
  what's wrong (1 sentence)
  why it matters (1 sentence)
  suggested fix (1 sentence; multi-line allowed when concrete)
```

**Severity:**

| Symbol | Label | Meaning |
|---|---|---|
| 🔴 | issue | Misleads the agent into a wrong action (broken command, missing safety guardrail, false claim). Fix before next use. |
| 🟠 | concern | Leaves the agent guessing where it shouldn't, or violates the skill's own convention. Likely worth fixing. |
| 🟡 | nit | Wordiness, structure-could-be-better. Optional. |

**Merge rules (thorough mode only):**

- Convergent findings (2+ sources agreed) → one entry tagged with all sources (e.g., `[gp + rd]`).
- Singleton findings → tagged with originating source (`[gp]`, `[rd]`, or `[forge]`).
- Severity disagreement → take the higher severity; add a one-line reconciliation note.
- Forge findings that don't map cleanly to the 9 axes → tag and place anyway, in the severity-sorted list.

## Fix proposal vs application

- **Propose:** yes — every finding includes a mandatory suggested-fix line.
- **Apply:** no — the skill stops at the review. If the user wants fixes applied, they ask the agent normally ("apply finding 2 and 4") and the agent uses standard editing tools.

Mandating a suggested fix per finding raises the bar: if you can't suggest a fix, the finding probably isn't sharp enough.

## Post-shipping follow-up

After this skill ships, revisit `forge` to:

1. Make it first-class as a standalone skill-crafting / reviewing skill (currently positioned as a general prompt-craft skill).
2. Tune it as a deliberate companion to `skill-review` (it's the prompt-craft lens in thorough mode).

---

## Appendix: full grilling record

The design above was produced through a 14-decision grilling session. Each decision is recorded below with the question asked, the recommendation, the resolution, and notes.

### 1. failure-modes-in-scope

**Question:** Which failure modes is the skill review trying to catch?

**Recommendation:** D — always-on (1 discoverability, 2 clarity, 3 correctness, 4 internal consistency, 5 not-to-the-point) plus conditional (6 safety only if destructive ops present, 7 untrusted-input only if skill wakes on external content, 8 cross-skill fit only when sibling overlap is plausible)

**Resolution:** Agreed (D)

**Notes:** User confirmed "agreed". This sets the failure-mode taxonomy that every later decision builds on. Conditional axes prevent n/a-noise on prose-only skills like onboard or react-best-practices.


### 2. artifact-scope

**Question:** What files does the reviewer load for a review?

**Recommendation:** C as always-on (whole skill directory: SKILL.md + scripts/ + reference files + supporting docs) + D conditional (sibling skills only when cross-skill-fit axis fires) + E conditional (CLAUDE.md and instructions/*.md loaded explicitly when checking a claim against a convention)

**Resolution:** Agreed (C always-on, D/E conditional)

**Notes:** Whole .claude/skills/<name>/ directory is the natural review unit. Conditional loading prevents wasteful sibling-pull on every review.


### 3. axis-specificity

**Question:** How specific is each axis check?

**Recommendation:** B — single guiding question + 2-3 concrete failure examples per axis. Anchors judgment without forcing yes/no checkboxes; examples double as calibration corpus.

**Resolution:** Agreed (B). User clarified "not too strict" means avoiding compliance-rubric feel, not reducing rigor.

**Notes:** Example source resolved in follow-up Q3b — see self-improvement decision.


### 4. self-improvement-mechanism

**Question:** How does the example bank self-improve?

**Recommendation:** B — propose-in-output. Reviews include a "candidate example updates" section ONLY when a finding would beat an existing example. Cap 2-3 per axis (16-24 total). Replacements must come from skills actually reviewed this session, must be sharper than the incumbent, and require a written "why better". Anti-churn bias: incumbent wins ties. Scope rule: examples are skill-file content only — no PR bodies, no runtime captures, no secrets.

**Resolution:** Agreed (B with all guardrails). User defers fine-tuning to later iteration.

**Notes:** Initial seed comes from pr-watch review artifacts.


### 5. distribution-and-audience

**Question:** Where does the skill live and who uses it?

**Recommendation:** N/A — informational

**Resolution:** Lives in user personal plugin at https://github.com/AbdouMoumen/claude-skills-plugin/ . User is primary/only operator for now.

**Notes:** Implications: portable across repos (no hard-coded paths); single-user tolerates fewer guardrails; user can iterate without external review process.


### 6. axis-set-completeness

**Question:** Is the 8-axis set complete, or are we missing failure modes?

**Recommendation:** B — add axis 9 "design coherence" as conditional. Fires when skill has more than one interacting part (prose + scripts, multiple modes, daemon, state machine, multiple wake/signal sources). Final set: 5 always-on (discoverability, clarity, correctness, internal-consistency, to-the-point) + 4 conditional (safety, untrusted-input, cross-skill-fit, design-coherence).

**Resolution:** Agreed (B)

**Notes:** Trust-the-agent / lifecycle / error-recovery / observability all fold into existing axes. Design coherence is the only genuinely-missing concern, and it matches the recap's open question #4.


### 7. conditional-axis-triggers

**Question:** How do conditional axes (6/7/8/9) get triggered?

**Recommendation:** C — hybrid: mechanical signals fire by default, reviewer can suppress (false positive) or escalate (signal missed). Signals: axis 6 fires on rm/push/--force/gh-pr/DELETE in scripts or destructive prose; axis 7 fires on PR comments/issue bodies/web-fetch/curl/external file reads; axis 8 fires on >1 sibling skill with overlapping name/domain; axis 9 fires on multi-file scripts OR mode/state/signal/wake language OR daemon behavior. Each suppression/escalation requires a one-line written reason for auditability.

**Resolution:** Agreed (C)

**Notes:** Soft triggers, not hard gates. Provenance line keeps trigger logic auditable across runs.


### 8. workflow-shape

**Question:** How does the review actually run?

**Recommendation:** C — adaptive. Light mode (default): single-pass review with up to 3 grilling questions if qualifying ambiguity surfaces. Thorough mode (escalated when 2+ conditional axes triggered OR scripts present OR SKILL.md > ~200 lines): forge subagent in parallel with inline review, merged with provenance tags, same 3-question grill budget. KISS lens absorbed into broadened axis 5 (necessity at every level — sentences, sections, scripts, modes, files). Grill bar: only when ambiguity would change (a) whether a finding fires, or (b) the recommended fix; cap 3 questions, one at a time, each with stated impact. No KISS sibling-comparison pass, no templated tiered-fix-plan, no upfront grill-scoping.

**Resolution:** Confirmed (A for KISS placement, confirmed grill mechanics)

**Notes:** Adaptive escalation matches conditional-axis pattern. Grilling cap of 3 enforces "if you need more, skill is too unclear to review — bail". (Note: this decision was later refined by the thorough-mode-architecture decision — the inline pass was replaced with subagents.)


### 9. output-structure

**Question:** How is the review output structured?

**Recommendation:** B + short opener: 2-3 sentence narrative opener (skill name, mode used, axes triggered, axes suppressed with reasons) followed by severity-sorted findings list. No per-axis verdict grid. Per-finding shape: severity-tag + axis-tag + location, then 3 single-sentence lines (what / why / fix). Candidate example updates section appears at bottom only when self-improvement mechanism fires.

**Resolution:** Agreed

**Notes:** Lighter than pr-watch grid. Opener carries the provenance/suppression info instead of a "Solid/Acceptable" matrix.


### 10. severity-scheme

**Question:** What severity language and visual treatment?

**Recommendation:** ii — keep 🔴🟠🟡 symbols, soften labels to "issue / concern / nit". 🔴 issue = misleads agent into wrong action; 🟠 concern = leaves agent guessing or violates skill's own convention; 🟡 nit = polish/wordiness.

**Resolution:** Agreed

**Notes:** Symbols preserve scan-ability; conversational labels avoid the audit-compliance feel. Mirrors pr-readiness three-level intent without inheriting CRITICAL/IMPORTANT/SUGGESTION formality.


### 11. invocation

**Question:** How does the user invoke the skill?

**Recommendation:** C — either path or name. Skill does not enumerate search locations; agent uses its own knowledge of where skills live. Disambiguation only when ambiguous.

**Resolution:** Agreed (C, but drop the search-location enumeration — trust the agent)

**Notes:** Original framing over-specified search paths, violating the CLAUDE.md trust-the-agent rule. User caught it. The skill should just say "find the named skill" and let the agent resolve.


### 12. output-destination

**Question:** Where does the review go?

**Recommendation:** Both: chat output for immediate visibility + file written to the session's persistent scratch directory (e.g., the session files dir in the agent's environment). Agent figures out the right path for its environment.

**Resolution:** Agreed (both, file in session files)

**Notes:** Session-files persists across checkpoints and is environment-agnostic — works for both Copilot CLI and Claude Code without hard-coded paths.


### 13. thorough-mode-architecture

**Question:** What subagents does thorough mode use, and how do they merge?

**Recommendation:** Subagent-driven architecture. Light mode: 1 sync subagent (general-purpose) with rubric + skill dir. Thorough mode: 3 sync subagents in parallel — general-purpose (rubric), rubber-duck (rubric, skeptical lens), forge (prompt-craft lens, no rubric needed). Main agent only orchestrates and merges, keeping its context lean for follow-up discussion. Merge: convergent findings get one entry tagged with all sources (e.g., [gp + rd]); singletons keep their source tag; severity disagreements take the higher with a one-line reconciliation note; forge findings tag-and-place even if they don't map cleanly to the 9 axes.

**Resolution:** Agreed (subagent-driven, both gp + rd in thorough, plus forge since same plugin)

**Notes:** Follow-up: after skill-review ships, revisit forge to (a) make it first-class as a standalone skill-crafting/reviewing skill and (b) tune it as a companion to skill-review (prompt-craft lens in thorough mode). User noted this is post-shipping work.


### 14. fix-proposal-vs-application

**Question:** Does the skill propose fixes, apply fixes, both, or neither?

**Recommendation:** Propose: yes — every finding includes a suggested-fix line (mandatory third line of the per-finding shape). Default 1 sentence; multi-line allowed when concrete (e.g., quoted replacement prose). Apply: no — skill stops at the review. User asks the agent to apply specific findings via normal conversation; agent uses normal editing tools. Avoids auto-fix risk (recap Layer 3) while keeping suggested fixes high-signal and actionable.

**Resolution:** Agreed (B for shape, propose-but-don't-apply for scope)

**Notes:** Mandating a suggested fix per finding raises the bar — if you can't suggest a fix, the finding probably isn't sharp enough. Brevity bias via calibration examples (most show 1-line fixes).
