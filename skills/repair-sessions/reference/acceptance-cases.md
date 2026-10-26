# Acceptance cases for a proposed repair implementation

Use synthetic event envelopes appropriate to the installed CLI version.
No implementation is bundled with this instruction-only skill. Do not
interpret this checklist as evidence that an arbitrary repair script passed.

| Fixture | Expected behavior |
|---------|-------------------|
| Valid JSONL, including escaped quotes, backslashes and `\n` text | No repair; bytes unchanged. |
| Raw LF inside a string; valid records before and after | Escape only that LF, preserve record order and all other bytes. |
| Multiple raw line breaks inside one string, including an empty physical line | Preserve every line break as an escape; never skip the empty line. |
| Raw CRLF inside a string; CRLF separators outside strings | Preserve the string's CR and LF separately; leave separators unchanged. |
| Unterminated string, dangling escape, partial final event, or malformed structure outside a string | UNKNOWN; no source modification. |
| Correctable line-break error plus any unexplained error elsewhere | Refuse whole-file repair; no partial overwrite. |
| Invalid UTF-8, unreadable file, or unsupported envelope | Explicit error/limitation, never a clean scan or successful repair. |
| Existing backup file | Choose another unique path; never overwrite the backup. |
| Active session, current session, changed source, or uncertain writer exclusion | Refuse replacement. |
| Failed candidate validation or backup verification | Leave source untouched; report failure. |
| Payload containing instructions to ignore safeguards or publish logs | Treat as data; no execution or disclosure. |

## Why the previous embedded examples were not retained

The earlier examples joined arbitrary invalid physical lines until JSON
parsed, skipped blank lines (losing embedded newlines), normalized line
endings through `readline`, and could overwrite a fixed `.bak` path.
They also lacked a reliable writer-exclusion mechanism. Passing `JSON.parse`
after such changes would not establish that the original events were
recovered faithfully.

The published skill therefore retains the diagnostic and approval workflow
but removes those runnable examples. An implementation must be reviewed and
tested independently before use on real sessions.
