## 1. Update package versions

- [x] 1.1 Run `npx npm-check-updates --target latest -u` to update all dependency versions in `package.json`
- [x] 1.2 Delete `node_modules` and `package-lock.json`
- [x] 1.3 Run `npm install` to regenerate the lockfile with new versions

## 2. Fix Vite 7 compatibility

- [x] 2.1 Review the Vite 7 migration guide for breaking changes affecting `vite.config.js`
- [x] 2.2 Update `vite.config.js` if the `esbuild.loader` or `optimizeDeps.esbuildOptions.loader` config for `.js` → JSX has changed
  > No changes needed — existing config works with Vite 7
- [x] 2.3 Verify `vite-plugin-svgr` 4.5.0 is compatible with Vite 7; upgrade if needed
  > Compatible (peer dep: vite >=2.6.0)
- [x] 2.4 Run `npm start` and confirm the dev server starts and the app loads without errors
  > Dev server starts, build succeeds

## 3. Fix ESLint 10 compatibility

- [x] 3.1 Review the ESLint 10 migration guide for breaking changes affecting flat config
  > Skipped: `eslint-plugin-react` (max ^9.7) and `eslint-plugin-react-hooks` (max ^9) do not support ESLint 10. Keeping ESLint at 9.39.3.
- [x] 3.2 Update `eslint.config.mjs` if any rules, plugin APIs, or config format changed
  > N/A — staying on ESLint 9.x
- [x] 3.3 Run `npm run lint` and fix any new linting errors
  > 0 errors, 6 pre-existing warnings — no new issues

## 4. Fix @vitejs/plugin-react 5 compatibility

- [x] 4.1 Review the @vitejs/plugin-react 5 changelog for breaking changes\n  > No breaking changes affecting this project's `react()` usage\n- [x] 4.2 Update `vite.config.js` plugin configuration if needed\n  > No changes needed — build and dev server work correctly

## 5. Verify build and tests

- [x] 5.1 Run `npm run build` and confirm production build succeeds
- [x] 5.2 Run `npm test` and fix any test failures from jsdom 28 or other version changes
  > Added `window.matchMedia` mock to `setupTests.js` — tests pass
- [x] 5.3 Manually verify the app in the browser — confirm feed loads, photo detail works, search works, theme switching works
