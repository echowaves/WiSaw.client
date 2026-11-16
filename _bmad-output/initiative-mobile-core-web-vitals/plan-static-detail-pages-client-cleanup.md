---
title: 'Delete the dead CRA-era public/index.html template and its stale references'
type: 'chore'
ticket: ''
created: '2026-11-13'
status: 'built'
baseline_revision: '4daf1329a087ad21e28d92c0389c777986c0f8bb'
route: 'oneshot'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: ['.github/copilot-instructions.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `public/index.html` is a Create React App leftover. Vite never reads it as a template (the root `index.html` is the entry, and `build/` proves the output derives from it), yet it carries a second, already-diverged copy of the SEO head tags — a drift trap in the middle of an active SEO refactor: anyone editing "the" index.html can edit the wrong one.

**Approach:** Delete `public/index.html` and update its two live references: `src/seo.template.test.js` (drop it from the template matrix and fix the stale comment) and `README.md` (line 186 still calls it "the page template"). Zero runtime impact — Vite copies `public/` only as static assets, and nothing in the app fetches `/index.html` at runtime.

**Decision (positiveInt dedup):** deferred to the edgeSeed deletion plan — the duplication (`edgeSeed.js:16` vs `mediaSeo.js:30`) disappears for free when `edgeSeed.js` is deleted; no shared util is introduced in this commit.

</frozen-after-approval>

## Implementation Notes

Oneshot route: pure deletion plus two reference updates, no behavior change. Verified before planning: `build/index.html` contains the root template's LCP scripts and zero `%PUBLIC_URL%` leftovers; `public/index.html` has no `<script>` tags at all; the only live references are the test matrix and README line 186 (the `_bmad-output/` research digests mention it historically — not code, left untouched).

- Deleted `public/index.html` via `git rm`.
- `src/seo.template.test.js`: `templates` array is now `['index.html']`; both stale comments fixed (matrix comment and the "not the legacy CRA copy" comment on the injection-pass suite). Kept `describe.each` shape — one element, future-proof for other templates.
- `README.md`: folder-structure tree no longer lists `public/index.html`; the "must exist" bullet now names the root `index.html` as the Vite template. Verification grep surfaced two more stale references (the "Only files inside public can be used from public/index.html" line and the CRA `%REACT_APP_%`-in-HTML subsection) — both corrected to Vite facts, including removing the now-contradicting CRA caveats list. The remaining CRA/Webpack boilerplate in the README is stale too but out of scope for this plan.

## Plan Change Log

## Review Triage Log

- quick lens, 1 finding: README env-vars-in-HTML sentence claimed Vite does not substitute `%VARIABLE%` placeholders — **medium** (real doc error introduced by this change; verified against installed vite 7.3.7 `htmlEnvHook`, which substitutes `%MODE%`, `%BASE_URL%`, and `VITE_`-prefixed vars in HTML). Action: patched the sentence to state Vite's actual behavior.

## Verification

**Commands:**
- `npm test` -- expected: all suites green; `seo.template.test.js` runs its matrix against `index.html` only (plus the unchanged `public/404.html` invariants)
- `npm run build` -- expected: succeeds; `build/index.html` is the Vite-generated entry (contains `data-wisaw-lcp` scripts, no `%PUBLIC_URL%`); postbuild template test passes
- `grep -rn "public/index" src/ README.md` -- expected: no matches
