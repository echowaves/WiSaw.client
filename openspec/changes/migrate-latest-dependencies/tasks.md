## 1. Update package versions

- [ ] 1.1 Run `npx npm-check-updates --target latest -u` to update all dependency versions in `package.json`
- [ ] 1.2 Delete `node_modules` and `package-lock.json`
- [ ] 1.3 Run `npm install` to regenerate the lockfile with new versions

## 2. Fix Vite 7 compatibility

- [ ] 2.1 Review the Vite 7 migration guide for breaking changes affecting `vite.config.js`
- [ ] 2.2 Update `vite.config.js` if the `esbuild.loader` or `optimizeDeps.esbuildOptions.loader` config for `.js` → JSX has changed
- [ ] 2.3 Verify `vite-plugin-svgr` 4.5.0 is compatible with Vite 7; upgrade if needed
- [ ] 2.4 Run `npm start` and confirm the dev server starts and the app loads without errors

## 3. Fix ESLint 10 compatibility

- [ ] 3.1 Review the ESLint 10 migration guide for breaking changes affecting flat config
- [ ] 3.2 Update `eslint.config.mjs` if any rules, plugin APIs, or config format changed
- [ ] 3.3 Run `npm run lint` and fix any new linting errors

## 4. Fix @vitejs/plugin-react 5 compatibility

- [ ] 4.1 Review the @vitejs/plugin-react 5 changelog for breaking changes
- [ ] 4.2 Update `vite.config.js` plugin configuration if needed

## 5. Verify build and tests

- [ ] 5.1 Run `npm run build` and confirm production build succeeds
- [ ] 5.2 Run `npm test` and fix any test failures from jsdom 28 or other version changes
- [ ] 5.3 Manually verify the app in the browser — confirm feed loads, photo detail works, search works, theme switching works
