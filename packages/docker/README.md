# @dofe/infra-docker

Shared Docker primitives for Dofe services.

## Owns

- Docker client creation and daemon probing.
- Image inspect and pull helpers, including registry auth matching and safe
  error redaction.
- Product-neutral Docker sandbox command/profile/runner primitives for
  short-lived execution.
- Generic container lifecycle helpers retained by the existing `DockerService`.

## Does Not Own

- Bot lifecycle, OpenClaw Gateway config sync, Gateway tokens, provider routing,
  or product container labels.
- Loop shards, review evidence, browser QA, operator UX, or Loop-specific image
  defaults.
- Model provider keys, routing decisions, usage, or proxy behavior.

## Compatibility Note

Some historical exports in `src/types.ts` are Bot/OpenClaw-shaped compatibility
stubs. They remain for existing consumers, but new public APIs must use
product-neutral names and types.

See `docs/0627/shared-primitives-boundary.md` in the infra repository for the
cross-package boundary.
