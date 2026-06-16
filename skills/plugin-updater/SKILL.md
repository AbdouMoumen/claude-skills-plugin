---
name: plugin-updater
description: Detect installed plugins across Claude Code and Copilot CLI, update them, and keep a self-updating platform playbook for plugin list/update flows. Use when asked to list plugins, update plugins, refresh plugin installs, or handle plugin API changes.
allowed-tools: Bash, Read, Write, Edit, Grep, Glob
---

# Plugin Updater

Maintain plugin health across Claude Code and Copilot CLI by doing three things in one flow:
1. inventory installed plugins,
2. update what can be updated,
3. keep this skill's platform playbook current when command surfaces drift.

Reference: [reference/platform-playbook.md](reference/platform-playbook.md)

## Scope

**In scope**
- Detect available plugin runtimes (Claude Code and Copilot CLI).
- List installed plugins per runtime.
- Run plugin updates (bulk or per-plugin, based on runtime capabilities).
- Learn API/CLI changes and persist them to the reference playbook.

**Out of scope**
- Installing brand-new plugins the user did not ask for.
- Editing unrelated machine configuration.
- Hiding failures behind success-like summaries.

## Workflow

### Step 1: Load and validate the playbook

Read `reference/platform-playbook.md` and verify each platform section contains:
- runtime detection intent
- list strategy
- update strategy
- discovery fallback
- parse hints
- `last_verified`

If any field is missing, fill it from currently observable runtime behavior before continuing.

### Step 2: Detect available runtimes

Detect whether Claude Code and/or Copilot CLI is available in the current environment.

For each detected runtime, capture:
- runtime identity (name + version when available)
- plugin command namespace availability
- bulk update capability (yes/no/unknown)

### Step 3: Build normalized inventory

Use the playbook list strategy per runtime and normalize records to:
- `platform`
- `plugin_id`
- `source` (marketplace or local source when available)
- `installed_version` (if available)
- `state` (`enabled`, `disabled`, `unknown`)
- `inventory_source` (`native` or `fallback`)

If the primary list strategy fails, run the playbook discovery fallback and retry.

### Step 4: Update plugins

Run updates using playbook strategy:
- prefer bulk update when runtime supports it
- otherwise run per-plugin updates

For each plugin, record:
- `result` (`updated`, `already-current`, `failed`, `unsupported`, `skipped`)
- `from_version` and `to_version` when available
- `error` when failed

### Step 5: Self-learning playbook update

If list/update behavior differs from the playbook (command renamed, output shape changed, flags changed):
1. discover the current behavior using runtime help and command introspection,
2. update `reference/platform-playbook.md` in place,
3. append a dated entry to the playbook `Learning Log`,
4. refresh `last_verified`.

Do not keep stale instructions as primary behavior. Keep old behavior only under compatibility notes when still useful as fallback.

### Step 6: Return structured output

Always emit:

```text
PLUGIN_UPDATE_RESULT: success | partial | failed
PLAYBOOK_UPDATED: yes | no

RUNTIMES:
  - platform: <claude-code|copilot-cli>
    detected: yes|no
    version: <string|unknown>
    supports_bulk_update: yes|no|unknown

INVENTORY:
  - platform: <...>
    plugin_id: <...>
    source: <...>
    installed_version: <...>
    state: <enabled|disabled|unknown>
    inventory_source: <native|fallback>

UPDATES:
  - platform: <...>
    plugin_id: <...>
    result: <updated|already-current|failed|unsupported|skipped>
    from_version: <...>
    to_version: <...>
    error: <...>

PLAYBOOK_DELTAS:
  - platform: <...>
    changed_field: <list_strategy|update_strategy|parse_hints|fallback|other>
    previous: <short text>
    current: <short text>
    detected_at: <ISO-8601>
```

## Behavior Rules

- Prefer platform-native plugin APIs over filesystem guessing.
- Surface unsupported capabilities explicitly as `unsupported`.
- If no plugin runtime is detected, return `PLUGIN_UPDATE_RESULT: failed` with a clear runtime detection section.
- Keep outputs data-first and concise.
