# Agent & System Prompt Design

Guidance for designing agent system prompts. These differ from standard prompts in that they define persistent identity, behavior boundaries, and interaction patterns across multiple turns.

## Identity & Persona Boundaries

Define who the agent is — and who it is not.

**Specify:**
- **Expertise**: Domain, skill level, perspective. "Senior backend engineer specializing in distributed systems" not "helpful assistant."
- **Knowledge boundaries**: What the agent knows vs. what it should admit it doesn't know. "You have expertise in Python and Go. For other languages, recommend the user consult language-specific resources."
- **Personality scope**: Enough to shape tone, not so much it becomes a character. Professional, concise, and direct is usually sufficient.
- **Refusal patterns**: What the agent will not do, stated clearly. "You do not provide legal, medical, or financial advice. If asked, direct the user to a qualified professional."

**Anti-pattern:** Defining personality without defining boundaries. An agent that is "friendly and helpful" with no scope limits will attempt anything, including tasks it cannot do well.

## Tool Use Orchestration

When the agent has access to tools, specify when and how to use them.

**Tool selection logic:**
```
When the user asks about [topic]:
1. If the answer requires current data → use [search tool]
2. If the answer requires calculation → use [calculator tool]
3. If the answer is within your training knowledge → respond directly
4. If uncertain whether data is current → use [search tool] to verify
```

**Error handling:**
- Define fallback behavior when tools fail: "If [tool] returns an error, inform the user and suggest an alternative approach. Do not retry more than once."
- Define behavior when tool output is unexpected: "If [tool] returns results that seem incorrect or incomplete, flag this to the user rather than presenting uncertain data as fact."

**Confirmation patterns:**
- Destructive actions: "Before deleting, modifying, or sending anything, summarize what you plan to do and ask for confirmation."
- Ambiguous requests: "If a request could be interpreted multiple ways, ask for clarification before invoking any tool."
- High-stakes operations: "For operations affecting production systems, always confirm with the user even if the instruction seems clear."

**Anti-pattern:** Listing available tools without specifying selection logic. The agent needs to know _when_ to use each tool, not just _that_ it can.

## Conversation Flow Design

For multi-turn agents, design how the agent manages state and conversation progression.

**Context tracking:**
- What information should the agent remember across turns? "Track the user's project name, preferred language, and any constraints mentioned in previous messages."
- What information should it re-verify? "If more than 5 turns have passed since the user stated their goal, confirm the goal is still the same before proceeding."

**Clarification patterns:**
- When to ask vs. when to assume: "If the user's request is missing [critical field], ask before proceeding. If [optional field] is missing, use [default value] and note the assumption."
- How many questions at once: "Ask at most 2 clarifying questions per turn. Prioritize the most blocking unknowns."

**Escalation triggers:**
- Define when the agent should stop and involve a human: "If the user expresses frustration, if you are uncertain about a critical decision, or if the task falls outside your defined scope, offer to escalate."
- Define the handoff format: "When escalating, provide a summary of the conversation, the user's goal, what has been attempted, and what remains unresolved."
