# Prompting Techniques — Deep Reference

> Load this file for detailed technique guidance beyond the inline heuristic in SKILL.md.

## Foundational Techniques

### Zero-Shot Prompting

Direct instruction without examples. Works when:
- Task is simple and well-understood
- Model has strong prior knowledge of the domain
- Format requirements are basic

**Example:**
```
Translate this sentence to French: "The quick brown fox jumps over the lazy dog."
```

**When to upgrade:** If results are inconsistent or format is wrong, add examples (few-shot).

---

### Few-Shot Prompting

Provide 1-5 examples to teach format, style, or reasoning pattern.

**Guidelines:**
- Use 1-3 examples for simple patterns
- Use 3-5 examples for complex formats
- Ensure examples are representative and diverse
- Order examples from simple to complex

**Example:**
```
Classify the sentiment of movie reviews.

Review: "This movie was fantastic! The acting was superb."
Sentiment: Positive

Review: "Terrible waste of time. The plot made no sense."
Sentiment: Negative

Review: "It was okay, nothing special but not bad either."
Sentiment: Neutral

Review: "{user_review}"
Sentiment:
```

**Pro tip:** Include edge cases in your examples to guide handling of ambiguous inputs.

---

### Role Prompting

Assign a specific identity/expertise to shape response quality.

**Effective roles specify:**
- Expertise level (senior, expert, specialist)
- Domain (security, frontend, data science)
- Perspective (reviewer, teacher, analyst)

**Example:**
```
You are a senior security engineer with 15 years of experience in web application security.
Analyze this code for vulnerabilities and explain the risks in terms a junior developer would understand.
```

**Combine with constraints:**
```
You are a technical writer who explains complex topics simply.
- Use analogies from everyday life
- Avoid jargon unless necessary; always define it when you use it
- Aim for 8th grade reading level
```

---

### Chain-of-Thought (CoT)

Elicit step-by-step reasoning before the final answer.

**Simple trigger:**
```
Think through this step by step before giving your answer.
```

**Structured CoT:**
```
Before answering:
1. Identify the key constraints
2. Consider at least 3 possible approaches
3. Evaluate trade-offs for each
4. Select the best approach
5. Provide your recommendation
```

**When to use:** Complex reasoning, math, logic puzzles, architecture decisions.
**When NOT to use:** Simple factual queries (adds noise without value).

---

### Self-Consistency

Generate multiple independent solutions and select the most consistent one.

**Use for:** High-stakes decisions, error-prone reasoning tasks.

**Prompt pattern:**
```
Solve this problem three different ways, then identify which solution is most reliable and explain why.
```

---

## Advanced Techniques

### ReAct (Reasoning + Acting)

Interleave reasoning and tool use in explicit steps.

**Structure:**
```
Thought: [reasoning about what to do]
Action: [tool or action to take]
Observation: [result of the action]
Thought: [reasoning about the observation]
... repeat until done ...
Final Answer: [conclusion]
```

**Good for:** Multi-step tasks where each step informs the next.

---

### Decomposition

Break complex tasks into smaller, verifiable sub-tasks.

**Top-down decomposition:**
```
Decompose this task into 3-5 independent subtasks.
For each subtask:
- State what needs to be done
- Identify any dependencies on other subtasks
- Note the expected output
```

**Validation hook:**
```
After completing each subtask, verify:
- Does the output match what was specified?
- Are there any edge cases that weren't handled?
- Can the next subtask proceed with this output?
```

---

### Tree of Thought

Explore multiple reasoning paths simultaneously, pruning dead ends.

**Use for:** Creative problem-solving, exploring design alternatives.

**Prompt:**
```
Imagine 3 expert engineers are each solving this independently.
For each engineer:
- State their approach
- Walk through their reasoning
- Identify the strengths and weaknesses
Then: synthesize the best elements from all three approaches.
```

---

### Constrained Output

Explicitly constrain format, length, and style.

**Format constraints:**
```
Respond ONLY with a JSON object. No explanation, no markdown, no preamble.
Schema:
{
  "result": string,
  "confidence": "high" | "medium" | "low",
  "reasoning": string[]
}
```

**Length constraints:**
```
Your response must be:
- Exactly 3 bullet points
- Each bullet: 1 sentence max
- No introduction, no conclusion
```

**Style constraints:**
```
Write in the style of:
- Active voice only
- Present tense
- No hedging language ("might", "could", "perhaps")
- Technical audience assumes familiarity with distributed systems
```

---

## Meta-Prompting Patterns

### Self-Critique

Have the model critique its own output before finalizing.

```
[Generate initial response]

Now critique your response:
- What assumptions did you make that might be wrong?
- What edge cases did you not address?
- What would a skeptical expert object to?

Revise based on your critique.
```

---

### Adversarial Testing

Have the model try to break its own solution.

```
You have just written this solution: [solution]

Now act as a hostile code reviewer trying to find flaws:
- Security vulnerabilities
- Edge cases that cause failures
- Performance problems at scale
- Missing error handling

For each flaw found, provide a fix.
```

---

### Persona Switching

Have the model evaluate from multiple viewpoints.

```
Evaluate this architecture from three perspectives:
1. **Security Engineer**: Focus on attack surface, data exposure, auth flows
2. **Performance Engineer**: Focus on bottlenecks, scaling limits, latency
3. **Junior Developer**: Focus on clarity, maintainability, onboarding friction

For each perspective, provide: top concern, severity (high/medium/low), suggested fix.
```

---

## Common Anti-Patterns

| Anti-Pattern | Problem | Fix |
|---|---|---|
| "Be helpful" | No scope, no constraints | Define domain, tasks, refusal patterns |
| Vague output format | Model chooses format ad hoc | Specify exact schema, examples |
| "Think step by step" without structure | Produces verbose rambling | Provide numbered steps with stopping criteria |
| Overly long system prompt | Dilutes key instructions | Prioritize: most important first, trim the rest |
| No error handling | Model halts on unexpected input | Specify fallback behavior explicitly |
| Asking multiple questions | Model addresses one, skips rest | One question per prompt turn |
| Contradictory instructions | Model picks one, ignores other | Audit for conflicts before deploying |
