# Volcengine Speech Delegation Matrix

## Purpose

This matrix records which legacy speech modules already reuse the unified
`volcengine-speech` foundation, which areas intentionally remain local, and
which future work should not be done as a breaking replacement.

## Current Delegation

| Legacy area | Delegated foundation | Kept local | Status |
| --- | --- | --- | --- |
| `volcengine-tts` HTTP request | auth headers, endpoint/timeout/retry validation, retry executor, HTTP error normalization, log id header reader | NDJSON stream reduction, TOS upload result mapping, legacy `TtsResultDto` shape | Delegated with smoke coverage |
| `openspeech` file ASR | WebSocket codec for streaming provider, shared header names by convention | Existing AUC/SAUC provider request shape, task polling compatibility, legacy provider factory | Partial delegation; keep compatibility |
| `streaming-asr` | No direct runtime delegation yet | Existing session lifecycle and service API | Candidate for future delegation after compatibility tests |
| Simultaneous interpretation 2.0 | Shared WebSocket codec/session, request option validation, endpoint config, package exports | Real vendor validation and product-specific event semantics beyond generic callbacks | Dedicated client implemented with local smoke |
| `volcengine-speech` unified client | protocol, headers, retry, errors, task result helpers | Business-specific request/response mapping per capability group | Primary path for new integrations |

## Rules For Future Migration

- New Volcengine speech integrations should start in `volcengine-speech`.
- Legacy public method signatures must remain stable unless a breaking change is
  explicitly planned.
- Each delegated boundary needs no-secret smoke coverage before old code is
  removed or rewritten.
- Real API findings should first be captured in
  `real-api-checklist.md`, then translated into a focused implementation loop.

## Next Candidates

### Streaming ASR

- Candidate delegation: shared WebSocket codec, request option validation,
  header generation, error normalization.
- Required protection before migration: existing service API smoke and closed
  session behavior checks.

### Openspeech File ASR

- Candidate delegation: task result helper and header status parsing where it
  matches AUC v3 behavior.
- Required protection before migration: standard/fast/off-peak task compatibility
  checks using fake provider responses.

### Voice And Memo

- Candidate delegation: shared task result helper for any new asynchronous task
  endpoints.
- Required protection before migration: ensure `raw` response remains available
  and current status/error semantics do not change.

### Simultaneous Interpretation 2.0

- Current implementation: `VolcengineInterpretationClient` exposes
  `client.interpretation.connect` and reuses the shared WebSocket session.
- Remaining protection: real API checklist execution with valid credentials,
  plus product-specific event fixtures if the official response schema requires
  stronger typed normalization later.
