---
name: walk-me-through
description: "Step through multi-item findings or reports one at a time with short analysis and actionable recommendations. Use when the user says 'walk me through', 'step through findings', 'go through these one by one', 'go through these one at a time', or has a list of items to review individually."
---

# Walk Me Through

Present findings, report items, or review results **one at a time**. For each item, give a short explanation, then surface options and recommendations for anything actionable.

## Flow

1. **Gather** — Collect all items from the source (analysis results, report, audit, list, etc.). Number them and tell the user the total count.

2. **Step** — For each item, present:

   ```
   **[N/total] <title or summary>**

   <2–3 sentence explanation of what this finding means and why it matters>

   <if actionable>
   Options: <list concrete alternatives if more than one path exists>
   💡 Recommendation: <which option and why>
   </if>
   ```

   Wait for the user before moving to the next item.

3. **Wrap up** — After the last item, give a one-paragraph summary of key takeaways and any unresolved action items.
