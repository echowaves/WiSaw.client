# Review narrative — deleting the dead CRA-era public/index.html template

Target: commit `3d52e29` on branch `refactor/static-detail-pages` (WiSaw.client). Review skipped by user after orientation; no blocks visited.

- [ ] **1. Intent** — unvisited · *current block*
- [ ] **2. Broad strokes** — unvisited
- [ ] **3. Slice: why public/index.html was dead** — unvisited
- [ ] **4. Slice: the template contract test** — unvisited
- [ ] **5. Periphery: README references** — unvisited

## 1. Intent

Verbatim from the frozen intent block of [plan-static-detail-pages-client-cleanup.md](../plan-static-detail-pages-client-cleanup.md):

> **Problem:** `public/index.html` is a Create React App leftover. Vite never reads it as a template (the root `index.html` is the entry, and `build/` proves the output derives from it), yet it carries a second, already-diverged copy of the SEO head tags — a drift trap in the middle of an active SEO refactor: anyone editing "the" index.html can edit the wrong one.
>
> **Approach:** Delete `public/index.html` and update its two live references: `src/seo.template.test.js` (drop it from the template matrix and fix the stale comment) and `README.md` (line 186 still calls it "the page template"). Zero runtime impact — Vite copies `public/` only as static assets, and nothing in the app fetches `/index.html` at runtime.
>
> **Decision (positiveInt dedup):** deferred to the edgeSeed deletion plan — the duplication (`edgeSeed.js:16` vs `mediaSeo.js:30`) disappears for free when `edgeSeed.js` is deleted; no shared util is introduced in this commit.

## 2. Broad strokes

A pure deletion with reference cleanup: one dead file goes away, and the two places that still mentioned it — the SEO template contract test and the README — are updated to match reality. No code path changes; nothing in the app or the build reads `public/index.html`.

Open these three in order:

1. The deleted file itself — run `git show 3d52e29 -- public/index.html` (88-line CRA-era template: zero `<script>` tags, `%PUBLIC_URL%` placeholders).
2. [src/seo.template.test.js](../../../src/seo.template.test.js) — the contract test that pinned head invariants against both templates; its matrix now targets only the root `index.html`.
3. [README.md](../../../README.md) — project documentation that still called the dead file "the page template".

## 3. Slice: why public/index.html was dead

Vite's page template is the root `index.html` (it carries `<script type="module" src="/src/index.js">`); files under `public/` are copied verbatim into `build/` as static assets and never read as a template. So the file had no live role — only a confusing one: a second copy of the SEO head tags that had already diverged from the real template (no preconnects, no guard or LCP scripts).

Evidence checked before deletion:

- `build/index.html` contains the root template's two `data-wisaw-lcp` scripts and zero `%PUBLIC_URL%` leftovers — the build derives from the root file.
- The dead file has zero `<script>` tags; a browser opening it renders an empty page (its own comment admits this).
- Its `%PUBLIC_URL%` placeholders are never substituted by Vite — they would be broken URLs if the file were ever served.

## 4. Slice: the template contract test

[src/seo.template.test.js](../../../src/seo.template.test.js) guards the head invariants behind the November indexing incident: no static canonical, a single `<title>`, robots index/follow, Helmet-owned shared tags, and exactly one `<div id="root">` anchor for the edge injector. The suite ran `describe.each` over both templates; the matrix is now `['index.html']` and two stale comments were corrected. The `public/404.html` invariants and the injection-pass simulation are untouched — they already targeted only the root template.

## 5. Periphery: README references

[README.md](../../../README.md) carried three CRA-era mentions of the dead file, all now stating Vite facts:

- Folder-structure tree no longer lists `public/index.html`; the "must exist" bullet names the root `index.html` as the template.
- The "files inside public" line now says they are copied to the build output as-is and referenced by absolute path.
- The env-vars-in-HTML subsection now states that Vite substitutes `%MODE%`, `%BASE_URL%`, and `VITE_`-prefixed variables in `index.html`; everything else comes from JavaScript via `import.meta.env`.
