# Shared Primitives Boundary

Date: 2026-06-27

## Context

`infra.dofe.ai` publishes shared `@dofe/infra-*` packages consumed by
`agents.dofe.ai`, `vibecoding.dofe.ai`, `models.dofe.ai`, `sso.dofe.ai`, and
future Dofe services.

The 2026-06-27 agents/vibecoding extraction moved Docker, runtime, workspace,
and Redis/BullMQ primitives into infra. This document fixes the boundary for
that work so future changes do not move product orchestration into shared
packages.

## Decision

Shared infra packages own product-neutral primitives only:

- `@dofe/infra-docker`: Docker client creation, daemon/image primitives, image
  pull helpers, short-lived sandbox command/profile/runner primitives, generic
  container services.
- `@dofe/infra-workspace`: workspace root discovery, managed path policy, safe
  path resolution, Docker volume argument helpers.
- `@dofe/infra-redis`: Redis cache, distributed lock primitives, Redis version
  checks, BullMQ bootstrap option helpers.
- `@dofe/infra-runtime`: runtime candidate selection, diagnostic check building,
  local/Docker invocation planning.

Product projects keep product orchestration:

- `agents.dofe.ai`: Bot/Agent lifecycle, OpenClaw Gateway policy/config sync,
  runtime catalog DB reads, skills, knowledge, governance, audit.
- `vibecoding.dofe.ai`: Loop state machine, issue intake, review/evidence,
  eval gates, PR provider, operator dashboard UX.
- `models.dofe.ai`: model catalog, provider keys, availability, routing
  decisions, usage ledger, AI proxy gateway.
- `sso.dofe.ai`: SSO/OIDC/token/session/identity SDKs and shared UI.

## Public API Naming Rules

- New infra APIs must use product-neutral names such as `DockerSandboxProfile`,
  `RuntimeCandidate`, `resolveAllowedTargetPath`, or `createBullMqRootOptions`.
- New infra APIs must not use Bot/OpenClaw/Loop/Gateway/Review/model-routing
  product terms unless the term appears only in examples, tests, or a legacy
  compatibility note.
- Product-specific defaults, labels, environment variables, DB reads, state
  machines, and UI diagnostics stay in consumer wrappers.
- Compatibility exports that predate this boundary may remain, but new code
  should not depend on them for new product behavior.

## Review Checklist

Before adding a new shared API, answer:

1. Can a second Dofe product use this without inheriting another product's
   terminology or state machine?
2. Does it avoid reading product databases or product env conventions?
3. Does it expose primitives rather than end-to-end product workflows?
4. Can consumer projects keep their own error messages, contract shapes, and
   UX diagnostics?

If any answer is no, keep the logic in the product repository and call lower
level infra primitives instead.
