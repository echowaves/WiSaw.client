---
title: 'Cut Largest Contentful Paint on the photo/video detail page, client-side only'
type: 'bugfix'
ticket: ''
created: '2026-11-10'
status: 'built'
baseline_revision: '12ad2bfd0e52d203666aef6bafd1443fa2783737'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: ['index.html', 'vite.config.js', 'src/build/vite-plugin-async-css.js', 'src/containers/PhotosComponent.js', 'src/utils/detailLayout.js', 'src/index.css', '.github/copilot-instructions.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** PageSpeed reports poor LCP on `/photos/:id` and `/videos/:id`. The largest painted element is the `<img>`/`<video poster>` that Lambda@Edge injects into `<div id="root">` before React mounts, and it points at the **full-resolution upload** — measured 1.2–3.4 MB per photo (posters ~959 KB) while the `-thumb.webp` variant of the same record is 29–53 KB. First paint of that element additionally waits on a render-blocking 32 KB gz stylesheet, and nothing preloads or prioritises it.

**Approach:** Ask the browser for the right bytes at the right time, entirely from this repo: pick a display-sized source for the pre-hydration media (the `-thumb.webp` variant, which is exactly what React already paints as its base layer), preload that source from `<head>` so its request starts before the body parses, and stop the application stylesheet from blocking first paint by inlining a tiny critical block and loading the bundle sheet asynchronously. No WiSaw.cdk, AppSync, schema or storage change; no new dependency.

## Boundaries & Constraints

**Always:**
- Derive everything from `location.pathname` + the already-present edge markup; never fetch to discover URLs.
- Only rewrite a source that matches `https://img.wisaw.com/<id>.(webp)` for the `<id>` in the route, and only inside `<div id="root">`. Anything else is left byte-identical.
- Keep every node the edge injector produces (h1/img/p/JSON-LD) — swap attributes only, never structure. `src/seo.template.test.js` pins `<div id="root">`, one `<title>`, no static canonical, robots `index, follow`.
- The inline bootstrap logic must be a classic parser-inserted script placed **after** `</div>` of `#root` (the injector replaces that div's contents, so in-DOM logic there is destroyed).
- Keep the geometry and slot work from `12ad2bf` intact: `src/utils/detailLayout.js`, the reserved label/comment slots, `scrollbar-gutter: stable`, and the cold skeleton's withheld Footer.

**Never:** GraphQL queries, `buildPhotoPage`'s `Promise.all`, `photoPageCache`/`inflightPhotoRequests`, the stale-response and keep-content-on-failure guards, GA pageview dedupe, `public/index.html` (legacy), registering a service worker, adding a build dependency, image URL construction in React components.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Photo deep link, narrow viewport (`< 700px`) | `/photos/<id>`, edge `<img src="…/<id>.webp">` | head preloads `…/<id>-thumb.webp` at `fetchpriority=high`; the injected img's `src` is swapped to that thumb before first paint; full-res loads only via React later | Swap failure leaves original `src` intact |
| Photo deep link, wide viewport (`>= 700px`) | same | no swap (a 300px source would be visibly wrong at up to 700px); head preloads the full `<id>.webp` with `fetchpriority=high` | — |
| Video deep link, any width | `/videos/<id>`, edge `<video preload="none" poster="…/<id>.webp">` | poster is swapped to `…/<id>-thumb.webp` and preloaded at every width — that thumb is what React paints as the video's base layer too | same no-op fallback |
| Route carries no id, or src host/name does not match the route id | `/`, `/search/x`, foreign media host | script returns without touching the DOM or injecting a preload | silent no-op |
| JavaScript disabled / crawler fetch | raw edge HTML | untouched full-resolution markup — crawlable body unchanged | N/A |
| App stylesheet arrives after React paints | very slow network | brief unstyled React frame is possible and accepted: the sheet is 32 KB gz while ~150 KB gz of JS must download **and execute** before React mounts, so it normally lands first | `<noscript>` copy of the sheet link |

</frozen-after-approval>

## Code Map

- `index.html` — the shipped Vite entry (not `public/index.html`). L23-24: only two preconnects; add an AppSync preconnect + `dns-prefetch`. `<head>` ends L86, `#root` L93-98, module script L99. Insert inline critical `<style>` in head, the bootstrap IIFE immediately after `</div>`, and a preload-injection IIFE before the stylesheet arrives.
- `vite.config.js` — 35 lines; `build: { outDir: 'build', sourcemap: false }`. Add `enforce:'post'` plugin from a new module to make emitted `<link rel="stylesheet">` async. No deps to add.
- `src/containers/PhotosComponent.js` — L1219-1235 (photo thumb), L1241-1263 (full-size overlay with `opacity: imageLoaded ? 1 : 0` + `transition:'opacity .5s'`), L1085-1103 / L1180-1209 (video thumb + `<video preload='metadata' poster>`). Add priority/decoding hints only.
- `src/index.css` — L119-147: `html{scrollbar-gutter:stable}`, `img{max-width:100%;height:auto}`; body uses `var(--bg)` (`#f5f7fb` light / `#111113` dark). Critical block mirrors only these.
- `src/utils/detailLayout.js` — `DETAIL_MOBILE_BREAKPOINT = 700`: the bootstrap script's width threshold must match this constant (duplicate the literal with a comment; the inline script cannot import).
- `src/seo.template.test.js` — template invariants to preserve and extend.
- Do not touch: `src/App.js` Suspense fallback, `src/utils/bootstrapGuard.js`, `lazyWithRetry.js`, `PhotosComponent.css`.

## Tasks & Acceptance

**Execution:**
- [x] `index.html` -- add AppSync preconnect + dns-prefetch; inline critical `<style>` (body bg/text via `prefers-color-scheme`, `img{max-width:100%;height:auto}`, minimal `#root` spacing); head IIFE that parses `/^\/(photos|videos)\/([0-9a-f]{8}-[0-9a-f-]{27,31})$/i`, injects `<link rel=preload as=image fetchpriority=high>` for the chosen source, and a classic script after `#root` that swaps the injected media's `src`/`poster` to `-thumb.webp` under the width rules in the matrix -- LCP bytes and request start.
- [x] `src/build/vite-plugin-async-css.js` -- new module exporting a Vite plugin plus a pure `makeStylesheetLinksAsync(html)` helper: add `media="print" onload="this.media='all'"` to each `<link rel="stylesheet">` in `<head>` and append a `<noscript>` copy -- unblocks first paint from the 32 KB sheet.
- [x] `vite.config.js` -- register that plugin (post transform) -- wires it into `vite build`.
- [x] `src/containers/PhotosComponent.js` -- add `fetchpriority='high'` + `decoding='async'` to the full-size overlay `<img>`, and `decoding='async'` to the base-layer thumb imgs (photo + video) -- earlier/lower-cost paint of the post-hydration media.
- [x] `src/lcpBootstrap.template.test.js` -- new: extract the inline IIFEs from `index.html`, run them in jsdom against a simulated edge-injected body for each matrix row (narrow/wide photo, video, non-photo route, mismatched src), assert preload href + `fetchpriority` and the exact swapped/untouched `src`; also assert the critical `<style>` exists and `seo.template.test.js` invariants still hold.
- [x] `src/build/vite-plugin-async-css.test.js` -- new: unit-test the helper on a representative built head, including idempotence (run twice → one transform) and that `<script type=module>` links are untouched.

**Acceptance Criteria:**
- Given a cold `/photos/<id>` fetch at a 390px viewport, when the inline scripts run, then exactly one `rel=preload as=image` exists pointing at `…/<id>-thumb.webp` with `fetchpriority="high"`, and the injected `<img>` no longer references `…/<id>.webp`.
- Given the same route at 1280px, when the scripts run, then the injected `<img>` still references the full-resolution source.
- Given any built `build/index.html`, when it is served, then no `<link rel="stylesheet">` in `<head>` blocks rendering, an inline critical style block is present, and `<div id="root">` is unchanged.
- Given `/`, `/about`, `/search/cat`, when the scripts run, then no preload link is injected and `#root` is untouched.
- Given the whole suite, when it runs, then all pre-existing CLS/slot/SEO contract tests still pass.

## Implementation Notes

- The async sheet ships as `<link rel="preload" as="style" crossorigin>` + `media="print"` /
  `onload="this.media='all'"` + a `<noscript>` copy. `crossorigin` is mirrored from the source link,
  never invented: a no-cors preload would not match Vite's CORS-mode sheet request and the browser
  would download the stylesheet twice.
- The critical block columns the edge-injected markup through `#root > h1|p|nav|img`, never through
  `#root` itself — no app stylesheet styles `#root`, so any rule there becomes the app's layout.
- The stale-deploy guard now reloads only for `SCRIPT` errors and `LINK` errors whose `rel` is
  `stylesheet`; its script carries `data-wisaw-guard="reload"` so the template test can run it.

## Plan Change Log

- 2026-11-10: implemented as written; no intent, boundary or I/O change. One addition beyond the task
  list: a single case in the existing `src/containers/PhotosComponent.cls.test.js` asserts the hydrated
  media renders `fetchpriority="high"` + `decoding="async"`, so the PhotosComponent task is guarded too.
  Test-only change to a file this plan requires to stay green.

## Review Triage Log

| # | Finding | Verdict | Evidence | Route | Disposition |
|---|---------|---------|----------|-------|-------------|
| 1 | `index.html` critical CSS styles `#root` (`max-width:1140px; padding:20px 20px 28px`), so it constrains the hydrated app on every route | `high` | Real. `grep -rn "#root" src/**/*.css public/*.css` returns nothing, so nothing overrides it; React renders exactly one child under `#root`, `<div className='App'>` (`src/App.js:182`), and `Header.css:5-16` gives `#header { width:100%; position:sticky }`, which after this change stops spanning the viewport above 1140px and gains a 20px scrolling band. | patch | Fixed in place: rule replaced with `#root > h1, #root > p, #root > nav` + `#root > img` (same ~1100px column for the injected markup only). Pinned by the new test "columns the injected markup without ever constraining #root itself". |
| 2 | `src/build/vite-plugin-async-css.js` — emitted `rel=preload as=style` omits `crossorigin`, so the sheet is fetched twice | `medium` | Real. Built head from this diff shows `<link rel="stylesheet" crossorigin … media="print">` beside `<link rel="preload" as="style" href=…>` with no `crossorigin`; a no-cors preload does not satisfy the CORS-mode stylesheet request, so ~32 KB gz downloads twice on every cold visit. | patch | Fixed in place: `asyncify` mirrors `crossorigin` from the source link. Test updated to expect it, plus "mirrors the source link rather than inventing a crossorigin mode of its own" for the opposite case. |
| 3 | `index.html` — the stale-deploy guard reloads on any `LINK` error, and the new image preloads can legitimately miss | `medium` | Real. Guard read `if (tagName === 'SCRIPT' || tagName === 'LINK') { reloadOnce() }`; the bootstrap injects `<link rel="preload" as="image">` for a URL derived from `location.pathname`, so a missing object or route-shaped-but-unknown id triggered a full reload that never happened before. | patch | Fixed in place: LINK branch narrowed to `target.rel === 'stylesheet'` (module scripts and the app sheet — the guard's actual signals — are unchanged). Guard script marked `data-wisaw-guard="reload"`; new "index.html stale-deploy guard" cases run it against a stand-in window and assert preload/img errors do not reload. |
| 4 | Same finding, second claim: after the swap, a `-thumb.webp` that 404s leaves the media broken until React paints | `false` | Refuted. React's base layer for both photos and video posters at mobile widths *is* that `-thumb.webp` URL (`.thumbnailImage src={currPhoto.photo.thumbUrl}`, `src/containers/PhotosComponent.js:1089`), so a missing thumb breaks the hydrated page identically — the swap introduces no new failure mode, and the pre-existing path is out of this change's scope. | — | Rejected on refutation; no code change. |

Review was run once with the pinned `quick` lens; all three verified findings were `patch`, so no loopback was needed (`review_loop_iteration` stays 0). The step-03 implementation subagent runs in sync mode and cannot be re-engaged, so the patches were applied here and full verification re-run afterwards: `npx vitest run` 93/93 across 9 files, `npx vite build` head carries `crossorigin` on the style preload and no bare `#root {` rule, `npx eslint` clean on every touched file.

## Design Notes

The width rules differ per media type on purpose: a photo's display box is `min(700, viewport-40)`, so below 700px the 300px-tall thumb is already what React paints; above it, nothing smaller than the original exists, so desktop keeps the honest (slow) source. A video's pre-hydration element is only a poster and React paints the same `-thumb.webp` base layer at every width, so the thumb is correct everywhere. Both choices are reversible in one place: the constants at the top of the bootstrap script.

Source selection lives in `<head>`, not React, because React's first paint happens ~150 KB of JS after the browser could already have the image. The swap script sits after `#root` so it survives the edge injector and still runs before any paint (parser-inserted classic script; nothing paints before it).

## Verification

**Commands:**
- `npm run lint` -- expected: no new errors in touched files (11 pre-existing indent errors in `src/setupTests.js` remain, out of scope)
- `npx vitest run` -- expected: full suite green, including the two new files and the existing `PhotosComponent.cls.test.js` / `detailSlotStyles.contract.test.js` / `seo.template.test.js`
- `npx vite build` then `grep -c 'rel="stylesheet"' build/index.html` and inspect that head -- expected: every stylesheet link carries `media="print"` + `onload`, inline `<style>` present, `<div id="root">` intact

**Manual checks:**
- `npx vite preview`, open `/photos/<id>` in DevTools with a 390px viewport + Fast 3G: the Network panel shows the `-thumb.webp` requested first at High priority and no request for the multi-MB original before hydration; LCP element is the thumb.
- Human runs `npx lighthouse https://wisaw.com/photos/<id> --only-categories=performance` (mobile) after deploy, and checks GA4 p75 LCP for `/photos/*` (`src/reportWebVitals.js` already reports it) — headless Chrome cannot run in this sandbox.
