# @dofe/infra-workspace

Workspace and managed-path primitives for Dofe runtimes.

## Owns

- Workspace root discovery from explicit roots, environment values, or marker
  files.
- Safe path normalization and same-or-child checks.
- Allowed-root target resolution.
- Docker volume argument construction.

## Does Not Own

- Consumer workspace profile files such as `.loops/runtime/profile.json`.
- Bot/session/container ownership checks.
- Product-specific artifact stores, issue stores, or UI workspace pickers.

Consumers own their storage, authorization, and product policy; this package
only supplies safe path and mount primitives.
