# Diagnostic Framework

Structured process for evaluating prompt quality. Use this instead of ad-hoc analysis.

## Quality Dimensions

Assess each dimension independently. A prompt can score well on some and poorly on others.

| Dimension                | What to check                                                             | Signs of issues                                                                                   |
| ------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Clarity**              | Can the task be misunderstood? Are instructions ambiguous?                | Multiple valid interpretations, model asks clarifying questions, inconsistent outputs across runs |
| **Specificity**          | Are instructions precise? Are vague terms replaced with concrete ones?    | "Good", "appropriate", "relevant" without definition; no quantified targets                       |
| **Completeness**         | Is anything critical missing? (role, context, constraints, output format) | Model fills gaps with assumptions, invents format, adds unrequested content                       |
| **Constraint placement** | Are boundaries stated early and prominently?                              | Constraints in the middle or end of the prompt; model ignores limits                             |
| **Output format**        | Is the expected structure explicit?                                       | Inconsistent formatting across runs, model guesses at structure                                   |
| **Length efficiency**    | Is the prompt concise or bloated? Redundant instructions?                 | Repeated instructions in different words, unnecessary explanations of obvious things              |

## Root Cause Analysis

When a dimension has issues, look for root causes. Issues often interact — fixing one root cause can resolve multiple symptoms.

**Common root causes and their downstream effects:**

| Root Cause          | Dimensions Affected                     | Typical Symptoms                                                         |
| ------------------- | --------------------------------------- | ------------------------------------------------------------------------ |
| Under-specification | Clarity, Specificity, Completeness      | Inconsistent results, model makes assumptions, output varies across runs |
| Structural disorder | Constraint placement, Length efficiency | Constraints ignored, prompt feels bloated, key instructions buried       |
| Missing examples    | Output format, Specificity              | Format misunderstood, model guesses at structure, style inconsistency    |
| Scope ambiguity     | Clarity, Completeness                   | Off-topic responses, scope creep, model addresses unrelated concerns     |
| Generic role        | Specificity, Output format              | Generic tone, surface-level analysis, no domain expertise in output      |

**Interaction patterns:** When you find issues in 2+ dimensions, check whether they share a root cause before proposing separate fixes. A single structural fix often resolves multiple symptoms.

## Worked Examples

### Example 1: Compound failure from structural disorder

**Prompt:**

```
You are a helpful assistant. Summarize the following document. Be concise.
Make sure to include all key points. The summary should be in bullet points.
Do not include opinions. Focus on facts only. Keep it under 200 words.
```

**Symptoms:** Constraint violations (exceeds 200 words), inconsistent format (sometimes bullets, sometimes prose), includes opinions.

**Diagnosis:** Six dimensions checked. Issues in constraint placement (limits buried at end), output format (bullet requirement mixed with prose instructions), and length efficiency (redundant "be concise" + "under 200 words"). Root cause: structural disorder. Constraints, format spec, and task are interleaved rather than separated.

**Fix:** Restructure into clear sections — Task first, then Constraints (with word limit prominent), then Output Format (bullets specified).

### Example 2: Compound failure from under-specification

**Prompt:**

```
Analyze this code and give me feedback.
```

**Symptoms:** Feedback is surface-level, inconsistent focus (sometimes style, sometimes bugs, sometimes performance), no actionable items.

**Diagnosis:** Issues in clarity (what kind of feedback?), specificity (no criteria for analysis), completeness (no role, no output format), output format (unstructured). Root cause: under-specification. The prompt provides almost no guidance.

**Fix:** Add role (senior code reviewer), specify analysis dimensions (bugs, performance, readability, security), define output format (findings table with severity), add constraints (focus on actionable issues only).

## Prioritization Framework

When multiple issues are found, fix in this order:

1. **Safety issues** — Injection vulnerabilities, data leakage, harmful output potential. Always fix first.
2. **Correctness issues** — Task misinterpretation, missing constraints, scope ambiguity. The prompt must do the right thing.
3. **Format issues** — Output structure, examples, length. The output must be usable.
4. **Style issues** — Role refinement, tone, length efficiency. Polish comes last.

Within each tier, prioritize issues that share a root cause with other issues — fixing them has the highest impact-to-effort ratio.

---

_Back to [main skill](../SKILL.md)_
