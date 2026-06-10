# Scenario Format

Scenarios describe what to test and how to judge the results. Keep them simple — natural language, not rigid schema.

## Anatomy of a scenario

A scenario has five parts:

1. **Name** — short label (e.g., "Bootstrap unversioned project", "Delete version with shared components")
2. **Starting state** — what the worktree looks like before the agent starts. Describe the filesystem, key file contents, and any relevant context. Can be prose ("a React/Vite project with 3 versions") or explicit file listings — whatever communicates the state clearly.
3. **Prompt** — what the simulated designer says to the agent. For single-turn scenarios, this is one message. For multi-turn scenarios, this is an ordered list of messages delivered sequentially as the agent goes idle between turns.
4. **Simulated responses** — pre-defined answers to expected interaction points. When the skill instructs the agent to ask the user something, these are the answers. Map each expected question to its response.
5. **Acceptance criteria** — natural-language statements describing what should be true after the agent finishes. Each criterion is independently judgeable against the worktree state.

## Example: versioning skill scenarios

These are adapted from real scenarios used to iterate the `versioning` skill.

---

### Scenario: Bootstrap unversioned project

**Starting state:**
An existing React/Vite project with no versioning infrastructure. `src/App.tsx` renders a full page directly. `FluentProvider` wraps the content. No `src/versions/` directory, no `versions.json`. Has `vite.config.ts` and `react` in package.json.

**Prompt:**
"I want to start versioning this project."

**Simulated responses:**
None — the skill says bootstrap should use "Initial prototype" as default name without prompting.

**Acceptance criteria:**
- Agent detects React/Vite project type without asking
- Creates `src/versions/V1/index.tsx` with page content moved from App.tsx
- App.tsx retains providers (FluentProvider, theme wrappers) but delegates page rendering to the version router
- Styles that belonged to page content move with the component to V1
- `versions.json` created with a single V1 entry
- Agent confirms completion in one step, not multiple intermediate approvals

---

### Scenario: Component variation decision

**Starting state:**
React/Vite project with V1-V3. `src/components/PromptInput.tsx` is shared across all three versions. V3 is current.

**Prompt (multi-step):**
1. "In V3, try a more compact version of the prompt input — smaller height, single line, subtle border."

**Simulated responses:**
- When asked "modify in place or create a new variant?": "new variant"
- When asked "update V3 in place or create V4?": "update V3"

**Acceptance criteria:**
- Agent recognizes PromptInput is shared and asks before modifying
- Creates `PromptInputV2.tsx` in `src/components/` (not inside V3's folder)
- Original `PromptInput.tsx` is unchanged
- Only V3's import changes to use the new variant
- V1 and V2 continue using the original component

---

### Scenario: Conversational skill — one question at a time

This example shows that eval applies to conversational/orchestration skills, not just code-modifying ones.

**Starting state:**
Any project with a design document or plan available for discussion.

**Prompt:**
"Grill me on this deployment plan."

**Simulated responses:**
- When asked about rollback strategy: "We'll use blue-green deploys"
- When asked about monitoring: "Datadog with PagerDuty alerts"

**Acceptance criteria:**
- Agent asks questions one at a time, not in batches
- Agent waits for a response before asking the next question
- Agent tracks decisions (e.g., creates a decision-tracking table)
- Agent follows up on the current topic before moving to a new one
- Agent provides a recommended answer with each question

---

## Writing adversarial scenarios

The highest-value scenarios test **ambiguity** — places where a cold-start agent could reasonably interpret the skill's instructions in multiple ways.

Look for:
- **Underspecified decisions** — the skill says "create the file" but doesn't say where, what to name it, or what format to use
- **Implicit conventions** — the skill author assumes PascalCase or a specific directory structure but never states it
- **Competing principles** — two rules in the skill could apply and lead to different actions (e.g., "minimize changes" vs "keep sources in sync")
- **Edge cases at boundaries** — what happens with zero versions? One version? The first version being deleted? Non-standard project structures?

A good adversarial scenario:
- Describes a plausible real-world situation
- Has a prompt a real designer would say
- Triggers the ambiguous part of the skill's instructions
- Has acceptance criteria that would fail if the agent makes the "wrong" reasonable choice

A bad adversarial scenario:
- Tests something the skill explicitly doesn't cover
- Uses a trick prompt no real user would say
- Has acceptance criteria so vague that any behavior passes
