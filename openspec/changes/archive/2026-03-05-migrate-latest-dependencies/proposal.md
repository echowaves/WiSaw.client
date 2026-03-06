## Why

Several dependencies have new major and minor releases available. Upgrading keeps the project on supported versions, picks up bug fixes and security patches, and ensures compatibility with the latest tooling ecosystem — particularly the Vite 6→7 and ESLint 9→10 major bumps.

## What Changes

- **BREAKING** Upgrade `vite` from 6.4.1 → 7.3.1 (major)
- **BREAKING** Upgrade `@vitejs/plugin-react` from 4.7.0 → 5.1.4 (major)
- **BREAKING** Upgrade `eslint` from 9.39.3 → 10.0.2 (major)
- **BREAKING** Upgrade `@eslint/js` from 9.39.3 → 10.0.1 (major)
- **BREAKING** Upgrade `jsdom` from 26.1.0 → 28.1.0 (major)
- Upgrade `@dr.pogodin/react-helmet` from 3.0.6 → 3.1.0 (minor)
- Upgrade `graphql` from 16.13.0 → 16.13.1 (patch)

## Capabilities

### New Capabilities

_None — this is a dependency upgrade, not a feature addition._

### Modified Capabilities

_None — no spec-level behavior changes. The application requirements remain the same; only the underlying library versions change._

## Impact

- **Build tooling**: Vite 7 and plugin-react 5 may require `vite.config.js` and/or `vitest` config adjustments
- **Linting**: ESLint 10 may require `eslint.config.mjs` updates for changed rule defaults or API changes
- **Test environment**: jsdom 28 may affect test setup or behavior in `vitest`
- **Dependencies**: `package-lock.json` will be regenerated
- **CI/CD**: None (project builds locally)
- **Runtime behavior**: No user-facing changes expected — same React, Apollo, Router, and Bootstrap versions
