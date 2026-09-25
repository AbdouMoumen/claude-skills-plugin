---
name: skill-distill
description: Make an agent skill substantially leaner while preserving required outcomes. Use when asked to trim, simplify, distill, or remove instruction bloat from an existing skill. Compare real behavior and loaded context, not compliance with the old format.
argument-hint: "[skill name or path]"
---

# Skill distillation

Reduce the instructions needed for reliable outcomes. Shorter text is not a
win if the agent compensates with worse decisions, repeated searches, or questions.

## Establish the contract

Read the skill and its references. Separate user-required outcomes, authority
boundaries, real machine-readable interfaces, and non-obvious domain knowledge
from author-invented procedure. The old skill is a comparator, not the specification.
Resolve material ambiguity with the user before deleting a requirement.

Preserve an exact baseline outside the target skill. Measure the whole tree;
identify operational data separately so deleting history cannot masquerade as
instruction reduction.

## Subtract

Write a substantially smaller candidate from that contract, rather than
compressing every old paragraph. Remove duplicated scope-wide rules, ordinary
engineering steps, unused output schemas, and unnecessary prescriptions.
Keep useful discovery anchors and surprising gotchas. Moving bulk into
references is not distillation.

## Compare behavior

Use `skill-eval` for user-approved, isolated comparisons rather than building
another evaluator. Compare a representative case on both versions and reserve
an untuned holdout. Score outcomes and permitted actions, not old headings.
Inspect the loaded version and actual artifacts; preserve failed runs.

Separate invocation/setup failures from behavior after loading. A no-op or
unloaded skill is not a pass, and does not justify adding workflow instructions.
A coached continuation is not a cold result.

## Retain only justified detail

Return to authoring for revisions. Restore specificity only for a demonstrated
contract failure; prefer clarifying an existing boundary to adding a checklist.
Do not transfer earlier passes to a later edit.

Deliver the revised skill and a concise comparison: total and actually loaded
instruction burden, compensating work, behavioral outcomes, version identities,
and unproven scope. Label word/token metrics accurately. Stop when the useful
contract is compact; do not turn the distillation process into another framework.
