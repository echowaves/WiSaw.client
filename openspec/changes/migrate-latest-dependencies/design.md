## Context

The project currently uses Vite 6.4.1, ESLint 9.39.3, and jsdom 26.1.0 along with several other dependencies at slightly older versions. The build, lint, and test pipelines all work. This is a straightforward version bump — no architectural changes.

Current config files that may need adjustment:
- `vite.config.js` — uses `defineConfig`, `@vitejs/plugin-react`, `vite-plugin-svgr`, esbuild JSX loader overrides, and vitest config
- `eslint.config.mjs` — flat config format with `@eslint/js`, `eslint-plugin-react`, `eslint-plugin-react-hooks`

## Goals / Non-Goals

**Goals:**
- Upgrade all outdated dependencies to their latest stable versions
- Fix any breaking configuration changes introduced by major version bumps
- Ensure `npm start`, `npm run build`, `npm run lint`, and `npm test` all pass after upgrade

**Non-Goals:**
- Refactoring application source code
- Changing the application's runtime behavior or user-facing features
- Adopting new framework features (e.g., Vite 7 Environment API)
- Migrating to TypeScript or changing the linting style

## Decisions

### 1. Upgrade all outdated packages in one batch
**Rationale**: The outdated packages are independent enough (build tool, linter, test env, and two minor runtime patches) that upgrading all at once is simpler than sequencing. If a problem surfaces it will be isolated to the changed package.
**Alternative considered**: Upgrading one major version at a time — rejected because the packages don't interact in ways that make sequential upgrades safer.

### 2. Use `npx npm-check-updates -u` then `npm install`
**Rationale**: ncu updates `package.json` in place; `npm install` regenerates the lockfile. This is the standard workflow.
**Alternative considered**: Manual edits to `package.json` — more error-prone.

### 3. Review Vite 7 migration guide for config changes
**Rationale**: Vite 7 is a major version. The `esbuild` loader config for `.js` → JSX may have changed. The `@vitejs/plugin-react` v5 may handle JSX in `.js` files differently. Need to verify and adjust `vite.config.js`.

### 4. Review ESLint 10 migration guide for config changes
**Rationale**: ESLint 10 is a major version. The flat config format is already in use (`eslint.config.mjs`), so the migration should be minimal, but rule defaults or API surface may have changed.

### 5. Verify jsdom 28 compatibility with vitest
**Rationale**: jsdom jumped from 26 to 28 (skipping 27). Vitest should handle the newer jsdom transparently, but tests should be run to confirm.

## Risks / Trade-offs

- [Vite 7 breaking changes] → Mitigation: Read the Vite 7 migration guide; test `npm run build` and `npm start` immediately after upgrade
- [@vitejs/plugin-react 5 JSX handling] → Mitigation: If the esbuild `.js` → JSX loader config is no longer needed or has changed, update `vite.config.js` accordingly
- [ESLint 10 rule changes] → Mitigation: Run `npm run lint` after upgrade; fix any new errors or adjust config
- [jsdom 28 test breakage] → Mitigation: Run `npm test` after upgrade; jsdom API changes are typically minor
- [Lockfile churn] → Expected; the regenerated `package-lock.json` will have many transitive dependency changes

## Migration Plan

1. Run `npx npm-check-updates --target latest -u` to update `package.json`
2. Delete `node_modules` and `package-lock.json`, then run `npm install`
3. Run `npm start` — verify dev server starts and app loads correctly
4. Run `npm run build` — verify production build succeeds
5. Run `npm run lint` — fix any new linting issues from ESLint 10
6. Run `npm test` — fix any test failures from jsdom 28
7. If any step fails, consult the migration guide for the affected major package and adjust config

**Rollback**: Revert `package.json` and `package-lock.json` to the previous commit.

## Open Questions

- Does Vite 7 still support the `esbuild.loader` / `optimizeDeps.esbuildOptions.loader` config for treating `.js` files as JSX? If not, what is the replacement?
- Does `vite-plugin-svgr` 4.5.0 remain compatible with Vite 7, or does it also need an upgrade?
