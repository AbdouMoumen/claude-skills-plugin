---
name: grill-me
description: Interview the user relentlessly about a plan or design until reaching shared understanding, resolving each branch of the decision tree. Use when user wants to stress-test a plan, get grilled on their design, or mentions "grill me".
---

Interview me relentlessly about every aspect of this plan until we reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

Ask the questions one at a time.

If my response includes caveats, clarifications, or follow-up questions, stay on the current topic until I explicitly say to move on.

If a question can be answered or a recommendation grounded by researching available sources (codebase, web, docs), do so instead of asking the user.

## Decision Tracking

Before asking the first question, create a table to track decisions throughout the session:

```sql
CREATE TABLE IF NOT EXISTS grill_decisions (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  recommendation TEXT,
  resolution TEXT,
  status TEXT DEFAULT 'resolved',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

After each resolved decision, INSERT a row with a descriptive kebab-case id. This data persists across compaction events and is available for downstream use (plans, PRDs, design docs, handoffs, etc.).
