---
title: 'Stop painting the multi-MB original on mobile detail pages; warm it after load, paint it on first interaction'
type: 'bugfix'
ticket: ''
created: '2026-11-11'
status: 'built'
baseline_revision: 'ff8e3d11fabf54d1ead4395e1407049949aefb18'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: ['.github/copilot-instructions.md', '_bmad-output/plan-photos-detail-lcp.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Below the detail breakpoint, hydration immediately paints the multi-MB original: the overlay `<img className='mainImage' src={currPhoto.photo.imgUrl} fetchPriority='high'>` sits at the full media box and fades in over the thumb (measured on `b677383c-…`: 2,789,822 B for `<id>.webp` vs 29,506 B for `<id>-thumb.webp`). The preload effect additionally warms `imgUrl` for curr/next/prev at mount, so a phone spends several MB before the visitor does anything. Because LCP is only finalised at first user input, that later paint of an equal-or-larger element replaces the thumb's LCP entry — which is why mobile LCP is still poor after `0a83953`.

**Approach:** Below 700px, the thumb is the painted media. The full-resolution source is fetched in the background a few seconds after the document finishes loading, exactly as asked, but it is *attached* to the page only once the visitor has interacted — by then the metric is frozen and the bytes are already warm, so the sharp image appears without ever becoming an LCP candidate. At or above 700px the render path is unchanged.

## Boundaries & Constraints

**Always:**
- Reuse `DETAIL_MOBILE_BREAKPOINT` from `src/utils/detailLayout.js`; no new breakpoint literal.
- Keep the thumb base layer (`.thumbnailImage`) exactly as it renders today, including geometry and z-index.
- Warm bytes through the existing `preloadImage` so `loadedMedia` / `inflightMediaPreloads` dedupe still applies; the background warm must never itself set an `<img>` attribute.
- Schedule the warm only once the document is complete, then after `FULL_MEDIA_WARM_DELAY_MS = 4000`, held in one place (human decision 2026-11-11: 4 s).
- Gate the full-resolution warm for **all three** records the mount effect touches — current, next and prev — on the same schedule (human decision 2026-11-11: gate neighbours too; tapping next is itself an interaction, so the neighbour still paints sharp immediately).
- The first-interaction trigger listens for `pointerdown`, `keydown`, `wheel`, is passive, fires once and removes itself.
- Resize to ≥700px opens the gate, so an orientation change cannot strand a visitor on the soft thumb.

**Never:** no new dependency; no GraphQL, `buildPhotoPage`/`Promise.all`, `cache`/`inflight` or GA pageview changes; no `detailLayout` geometry, reserved-slot or CLS work; no `index.html` bootstrap, Vite plugin or backend/schema/storage change; no invented `srcset` (no intermediate derivative exists); never leave a visitor permanently without the sharp image.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Cold deep link, <700px | `/photos/<id>` at 390px | thumb painted; **no** `.mainImage` element; no full-res request before document-complete + delay | n/a |
| Complete + delay elapsed, no interaction | 390px | background requests warm the current `imgUrl` (and any neighbour already in state); DOM unchanged — full-res still not painted | fetch fails → nothing painted, thumb stays, no retry storm |
| First interaction after warm | 390px | `.mainImage` mounts with `src=imgUrl`, paints from cache, existing fade preserved | not yet fetched → normal load path still runs `onLoad`/`onError` |
| Interaction before the delay | 390px | upgrade immediately; scheduled warm is a no-op via dedupe | — |
| Viewport ≥700px | any | unchanged: overlay painted at hydration with `fetchPriority='high'` | — |
| Resize 390→1280 after load | gate opens | full-res paints and stays painted when narrowed again | — |
| Prev/next while deferred | tap next | that tap is an interaction → next photo paints full-res immediately | — |

</frozen-after-approval>

## Code Map

- `src/containers/PhotosComponent.js` — L148-169 `preloadImage` (reuse, do not duplicate); L184-208 effect that warms `thumbUrl` + `imgUrl` for curr/next/prev (the `imgUrl` call is what must become gated); L249-257 `resize` handler; L259-268 `handleImageLoad`/`handleImageError`; overlay img L1160-1195 (`src={currPhoto.photo.imgUrl}`, `opacity: imageLoaded ? 1 : 0`); video path L1003/L1101 already uses `poster={thumbUrl}` + `preload='metadata'` — leave alone; `imageLoaded` lifecycle L129/528/546 only drives that opacity.
- `src/utils/detailLayout.js` — `DETAIL_MOBILE_BREAKPOINT = 700`; `computeDisplayDimensions` reads `window.innerWidth` at call time, so a gate can read the same source of truth.
- `src/utils/mediaUpgrade.js` — **new**: `shouldDeferFullMedia(screenOverride?)` and `scheduleAfterWindowLoad(delayMs, run) → cancel`, no React/Apollo imports so it is unit-testable alone.
- `src/containers/PhotosComponent.cls.test.js` — copy its mount pattern (`vi.mock('../consts')` with a never-settling query, `react-ga4`, `./Footer`; top-level `await import`). It runs at jsdom's 1024px → desktop path, and must stay green untouched.
- Do not touch: `index.html`, `src/build/*`, `PhotosComponent.css`, `Home.js` / `SearchComponent.js` feed thumbs, `src/utils/imageUtils.js`.

## Tasks & Acceptance

**Execution:**
- [ ] `src/utils/mediaUpgrade.js` — new module exporting `FULL_MEDIA_WARM_DELAY_MS`, `shouldDeferFullMedia(screenOverride)` (viewport `< DETAIL_MOBILE_BREAKPOINT`) and `scheduleAfterWindowLoad(delayMs, run)` that runs after `document.readyState === 'complete'` (else a `load` listener) plus `setTimeout`, returning a cancel function.
- [ ] `src/containers/PhotosComponent.js` — add `paintFullMedia` / `warmFullMedia` state seeded from `shouldDeferFullMedia()`; effect that opens both on first `pointerdown`/`keydown`/`wheel` (once, passive, self-removing); effect that uses `scheduleAfterWindowLoad` to set `warmFullMedia` and warm the current `imgUrl`; gate the L184-208 neighbour `preloadImage(entry.photo.imgUrl)` on `warmFullMedia`; render the overlay `<img>` only when `paintFullMedia`; open the gates from `handleResize` at ≥700px.
- [ ] `src/utils/mediaUpgrade.test.js` — new: readyState already complete vs pending, delay honoured under fake timers, cancel prevents the run.
- [ ] `src/containers/PhotosComponent.fullMedia.test.js` — new: matrix rows for cold mobile link, warm-without-paint, paint-on-interaction, desktop unchanged. Stub `window.Image` to record requested srcs; `vi.useFakeTimers()`; pin `window.innerWidth` per case.

**Acceptance Criteria:**
- Given a 390px cold deep link, when the page first renders, then no element with class `mainImage` exists and no background request was made for the full-resolution URL.
- Given the document has completed and the warm delay elapsed with no interaction, then exactly one background request exists for the current photo's full-resolution URL and the DOM still contains no `mainImage`.
- Given that state, when the visitor presses the pointer down, then `.mainImage` exists with `src` equal to the full-resolution URL and the thumb layer is untouched.
- Given a 1024px viewport, when hydration paints, then `.mainImage` carries `fetchpriority="high"` and `decoding="async"` exactly as today.
- Given the whole suite, when it runs, then every pre-existing CLS, slot, SEO and bootstrap contract test still passes.

## Design Notes

Painting on interaction rather than on idle is the whole point: LCP finalises at first input, and a `+5 s` paint of an element the same size as the thumb replaces the entry (equal sizes tie-break on later paint time). So the visitor's requested background pull happens on schedule — only its *paint* waits for input. A desktop gate is deliberately absent: `plan-photos-detail-lcp.md` chose full-resolution there for fidelity, and bandwidth is not the constraint above 700px.

```js
const [paintFullMedia, setPaintFullMedia] = useState(() => !shouldDeferFullMedia())
// warmFullMedia opens on document-complete + FULL_MEDIA_WARM_DELAY_MS, or on first input
{paintFullMedia && (<img className='mainImage' src={currPhoto.photo.imgUrl} … />)}
```

## Verification

**Commands:**
- `npm run lint` -- expected: clean on touched files (11 pre-existing indent errors in `src/setupTests.js` remain out of scope)
- `npx vitest run` -- expected: full suite green, including the two new files plus `PhotosComponent.cls.test.js`, `detailSlotStyles.contract.test.js`, `lcpBootstrap.template.test.js`, `seo.template.test.js`
- `npx vite build` -- expected: build succeeds; head keeps one `<div id="root">` literal and `media="print"` sheet links

**Manual checks:**
- `npx vite preview` at a 390px viewport on Fast 3G: Network shows `-thumb.webp` first, the multi-MB original only after load + quiet delay, and no `.mainImage` in the DOM until the first tap; Lighthouse mobile then reports the thumb as the LCP element.
- After deploy, human runs `npx lighthouse https://wisaw.com/photos/<id> --only-categories=performance` (mobile) and checks GA4 p75 LCP for `/photos/*` — headless Chrome cannot run in this sandbox.

## Review Triage Log

Lens `quick` ran as a subagent over the staged diff; verdicts below are this session's, after re-checking each claim in the code.

| # | Location | Claim | Verdict | Evidence & disposition |
|---|----------|-------|---------|------------------------|
| 1 | `src/containers/PhotosComponent.js` first-interaction effect | Input that happens before this lazy route chunk mounts is never seen, so the warmed original can be paid for and never painted | medium | Confirmed: listeners are attached in a mount effect, so taps during bundle download are gone by the time React runs, and nothing else opened the gate. Fixed (patch): `hasFirstInputHappened()` in `src/utils/mediaUpgrade.js` reads `navigator.userActivation.hasBeenActive` and buffered `first-input` entries — both recorded by the browser before our code existed — and both gates are seeded from it at hydration; pinned by the new "interacted before this lazy chunk was even loaded" case. |
| 2 | `src/containers/PhotosComponent.fullMedia.test.js` cold-link case | AC1's cold deep link was exercised through router state, i.e. the in-app path, so the real cold case was untested | medium | Confirmed: every case used `{ feedPhoto }`, which makes `bootstrapPhotoFromRouterState` return a record and seeds `imageLoaded = true`. Fixed (patch): added a case with `location.state = null`, `api.pages` resolved and a microtask flush, asserting the thumb is painted, `.mainImage` absent and no original requested. |
| 3 | same file, warm case | "exactly one background request" was only asserted as "at least one" | low | Confirmed. Fixed (patch): `requested.filter(src => src === FULL_777)` must be length 1 after the warm plus two extra re-renders; passes with the existing `inflightMediaPreloads`/`loadedMedia` dedupe. |
| 4 | overlay `<img>` opacity + `imageLoaded` seeding | A bootstrapped record that upgrades before the warm mounts the overlay at `opacity: 1`, so the sharp image pops in with no fade | low (grouped with #6) | Real but cosmetic on its own — the decoded thumb sits underneath, so nothing blank shows. Fixed together with #6 by resetting the loaded claim when the deferred paint opens. |
| 5 | overlay `<img>` mounted inside the `pointerdown` task | The first tap carries a ~2.8 MB / 2789×3000 raster, and `src/reportWebVitals.js` reports INP for this initiative too | medium | Confirmed plausible: `upgrade()` set state inside a discrete handler, so React rendered in that input's task and the overlay mounted at full opacity. Fixed (patch) with #4: `upgrade()` now also clears `imageLoaded`, and a bootstrapped navigation only claims "already loaded" above the breakpoint, so the sharp image fades in on its own `onLoad` instead of rastering inside the input frame. Pinned by asserting `.mainImage` starts at `opacity: 0` after the first press. |
| 6 | long-press save/share below the breakpoint | Before any input the only image in the media box is the ~30 KB thumb, so a native "Save Image" could grab the thumb instead of the original | maybe-false | Could not settle from code or jsdom: a long press begins with `pointerdown`, which opens the gate and mounts the overlay well inside the ~500 ms hold, so the OS may already offer the full-res element. Settled by a device check (iOS Safari + Android Chrome, long-press a photo before touching anything else). Deferred — see `_bmad-output/initiative-mobile-core-web-vitals/deferred-work.md`. |
