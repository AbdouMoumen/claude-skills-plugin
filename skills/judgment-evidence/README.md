# judgment-evidence

A Claude Code skill that captures moments of good user judgment to a personal store that travels with you across projects and accumulates over time.

## What it does

Most agent workflows discard the best signal in a session: the moments where *you* — not the agent — made the call that saved the work. A pushback with a rationale, a bug catch, a scope cut, a design instinct the agent hadn't proposed. This skill quietly logs those moments to a personal store at `~/.agents/` so you can review, search, or share patterns of your own judgment over time.

It does **not** capture chit-chat, agent suggestions you accepted, or anything the agent itself produced. Only user-authored moments with concrete rationale.

## How it activates

- **Silently mid-session** when a qualifying moment is detected (pushback with rationale, bug catch, scope cut, etc.). One line printed: `📌 Captured judgment: <summary>`.
- **At end of session** when invoked by the `wrap-up` skill, or directly via "capture judgment" / "judgment review".

End-of-session always presents a unified review (live captures + swept candidates) before anything sensitive is finalized.

## Where things live

- `~/.agents/judgment-evidence.jsonl` — the main store. Paraphrased, no paths, no verbatim text. Safe to back with a private git repo or cloud sync.
- `~/.agents-local/judgment-evidence.sidecar.jsonl` — machine-local sidecar. Full-fidelity verbatim text, cwd, branch, session id. **Intentionally in a separate directory** so it can't be accidentally synced when you back the main store with a remote.
- `~/.agents/judgment-evidence.config.json` — per-repo `skip` and `anonymize` rules.

Override the main-store location with `JUDGMENT_EVIDENCE_DIR`. The sidecar follows separately via config.

## Privacy posture

- **Unknown repos default to anonymized.** Verbatim repo names only land in the main store if you explicitly promote that repo during a review.
- **Two-directory split is the safety boundary**, not paraphrasing rules. The main store never contains paths, session ids, or verbatim user text — by structure, not by hope.
- First run asks once before creating anything. Decline writes a tombstone and the skill self-deactivates.

## Files

- [`SKILL.md`](SKILL.md) — agent-facing instructions (loaded by Claude Code)
- [`reference/schema.md`](reference/schema.md) — full field shapes, paths, config schema, anonymization rules

## Integration

`wrap-up` invokes this skill as step 5 of its end-of-session orchestration. It also runs standalone any time you ask.
