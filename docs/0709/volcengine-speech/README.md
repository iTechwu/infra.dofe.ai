# Volcengine Speech Workstream

This directory tracks the July 9 Volcengine speech implementation workstream.
It is scoped to `packages/shared-services/src/volcengine-speech` and related
legacy compatibility boundaries.

## Documents

- `next-execution-plan.md`: ordered execution plan with target, scope, non-goals,
  benefits, status, and checkpoints.
- `implementation-log.md`: loop-by-loop implementation log. Each loop records
  reviewed pending work, implementation, document marking, and verification.
- `delegation-matrix.md`: current legacy delegation boundaries for
  `volcengine-tts`, `openspeech`, and `streaming-asr`.
- `real-api-checklist.md`: opt-in checklist for real Volcengine API validation
  with credentials kept outside the repository.

## Current No-Secret Verification

Run from the repository root:

```bash
pnpm --filter @dofe/infra-shared-services typecheck
pnpm --filter @dofe/infra-shared-services verify:volcengine-speech
```

The default verification remains no-secret. Real vendor calls are documented in
`real-api-checklist.md` and must be triggered explicitly with external
credentials.

Latest local verification in this workstream:

- `pnpm --filter @dofe/infra-shared-services typecheck`
- `pnpm --filter @dofe/infra-shared-services verify:volcengine-speech`
- `git diff --check`

Latest closeout: Loop 31.

## Current Implementation Status

- README request options contract is aligned with code.
- ASR standard/fast/off-peak task flows have fake transport smoke coverage.
- Task result normalization is shared between body-status and header-status
  task APIs.
- TTS WebSocket, realtime, podcast, and simultaneous interpretation clients
  have local WebSocket session smoke coverage for init, event, post-connect
  JSON/audio sends, close callbacks, and closed-session state.
- Simultaneous interpretation has a dedicated WebSocket client; real vendor
  validation is still credentials-gated.
- Public package exports for `volcengine-speech/asr` and
  `volcengine-speech/task-result` are covered by require smoke.
- Legacy delegation boundaries are documented without requiring breaking
  rewrites.
