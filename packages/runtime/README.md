# @dofe/infra-runtime

Runtime detection and invocation planning primitives for Dofe services.

## Owns

- Runtime candidate types for local CLI and Docker execution.
- Candidate selection and diagnostic check construction.
- Local/Docker invocation planning with workspace and config mount inputs.

## Does Not Own

- Agent product state machines, Bot runtime catalogs, Loop phases, review gates,
  or remote runner orchestration.
- Product-specific CLI arguments, image defaults, error messages, or UI
  diagnostics.
- OpenClaw Gateway policy or model/provider routing.

Consumers should wrap these primitives with product-owned adapters that preserve
their contracts and language.
