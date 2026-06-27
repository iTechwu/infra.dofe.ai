# Publish Readback Checklist

Date: 2026-06-27

Use this checklist after publishing any `@dofe/infra-*` package and before
upgrading consumer repositories.

## 1. Verify npm Metadata

```bash
cd /Users/techwu/Documents/codes/dofe.ai/infra.dofe.ai
pnpm verify:published-package @dofe/infra-docker 0.1.79
pnpm verify:published-package @dofe/infra-workspace 0.1.1
pnpm verify:published-package @dofe/infra-redis 0.1.80
pnpm verify:published-package @dofe/infra-runtime 0.1.2
```

The script checks:

- `npm view <package> version`
- `npm view <package>@<version> dist.tarball`
- tarball URL is present

If a scoped package is newly created and npm returns metadata 404, wait until
`npm view` succeeds before changing consumer `package.json` files.

## 2. Verify Consumer Install

Run the install check in each consumer that will be upgraded:

```bash
pnpm_config_minimum_release_age=0 pnpm install --lockfile-only
```

Do not switch consumers to local path dependencies to bypass publish latency.
If the package cannot be installed from npm, fix the published package or wait
for npm metadata propagation.

## 3. Verify Exports

For newly added subpaths, run a small Node/TypeScript smoke import from the
consumer or package test:

```bash
node -e "require('@dofe/infra-docker/docker-image-puller')"
node -e "require('@dofe/infra-docker/docker-sandbox-runner')"
```

If a subpath fails to resolve, fix package `exports` and republish. Do not deep
import `dist/*` from consumers.

## 4. Keep Release Changes Scoped

- Publish infra packages from `infra.dofe.ai`.
- Upgrade consumers in separate, focused commits.
- Do not mix publish readback fixes with product logic changes.
