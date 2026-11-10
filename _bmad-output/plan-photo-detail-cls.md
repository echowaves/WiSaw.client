---
title: 'Drive Cumulative Layout Shift to zero on the photo/video detail page'
type: 'bugfix'
ticket: ''
created: '2026-11-09'
status: 'built'
baseline_revision: '2466ad90ec91cb3fbb10c80398a09e965181d523'
route: 'oneshot'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 3
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** PageSpeed/CrUX reports Cumulative Layout Shift **0.134** on `/photos/:id` and `/videos/:id` (poor is >0.10). Content the user can already see moves underneath them: the label row above the media grows by ~47px when recognitions hydrate, which drags the media box and everything below it down; on prev/next navigation the comments block and footer reflow as each new record's data lands; and when the document crosses one viewport in height a classic scrollbar appears and shifts the whole page sideways.

**Approach:** Make CLS zero by construction rather than by guessing sizes closer: **no element that has already been painted may change its start position after an async update.** Reserve the label row with placeholder markup that shares the hydrated block's exact DOM structure and CSS metrics (so hydration is a pixel-identical swap, not a growth), stop painting anything below the media box until its data exists on cold loads (including the lazy Footer, which today moves ~300px when the square media placeholder resolves to the real aspect ratio), and reserve the scrollbar gutter so document-height changes cannot move content horizontally.

</frozen-after-approval>

## Implementation Notes

Oneshot: presentation-only restructure of already-reserved skeleton slots plus one CSS line; no fetch, caching, routing or SEO change. ~110 lines across 4 files (`PhotosComponent.js`, `PhotosComponent.css`, new `src/utils/detailLayout.js`, `index.css`) + tests.

Shift sources found in investigation (`src/containers/PhotosComponent.js`):
- In-flow stack is `.PhotosComponent > main.content-container > [label row, .crop media box, comments/labels block]` then `<Footer>`. Nav buttons are `position:absolute` (:750-816) — cannot shift anything. Prev/next and hydration therefore only matter through the *heights* of these three blocks.
- **Label row grows on hydration**: reserved with `minHeight: 58` (:1035-1043, and :1316-1319 in the cold skeleton) but the hydrated block is `.recognition-tags` (padding 14+14 + border 2) › inner `div{margin:'4px 0 8px'}` › `h1{margin:8px 0;line-height:1.4}` › inline-block pills (`font-size:13px`, `padding:5px 14px`, `border:1px`, `margin-bottom:6px`) — one row measures ≈105px in the CSS as written. A ~47px downward push of the media box is the highest-impact shift on the page because the media box is the largest painted element.
- **Cold skeleton paints content that must move**: `getPlaceholderDimensions()` (:66-73) reserves a *square* media box (desktop 700×700, mobile `innerWidth−40`) while `computeDisplayDimensions()` (:28-51) sizes the real box by aspect ratio — up to ~306px of height change. The invisible `div{height:100}` filler below it is unpainted (excluded from CLS), but the `<Footer/>` rendered in that skeleton (:1337-1339) *is* painted and moves with it.
- **Fast path (router state / hover cache)** paints media at the correct aspect, then grows the label row and materialises `.comments-section` from nothing, pushing the already-painted Footer down — this repeats on every prev/next tap, which is what field data weights.
- Not a source: `#root`'s static SEO `<h1>/<h2>` in `index.html` (removals are excluded from CLS), the 100vh app Suspense fallback (`src/App.js:167-179`, replaced by new nodes), `<video>` and both `<img>` layers (all carry explicit `width`/`height` + absolute positioning).

Design decisions:
1. **Exact-height hydration, not approximate reservation.** While `requestComplete === false`, render the label row's real structure with `aria-hidden` invisible placeholder pills — same wrapper divs, same classes, same inline-block metrics as `renderRecognitionsH1` (:512-545) produces for its ≤3 labels. Hydration then swaps text into an identically sized box. Multi-row wrapping still differs by one pill row (~36px) and is accepted; a magic `min-height` number would be wrong on every viewport anyway.
2. **Cold loads paint nothing below the media.** Keep the unpainted flexible filler, drop the `<Footer/>` from that branch (amends previous plan's note 4 / review F4: Footer stays inside local `<Suspense fallback={null}>` wherever it *is* rendered). The page is already ≥100vh via `.PhotosComponent{min-height:100vh}`, so the document does not collapse. Comments/labels then appear as new nodes → excluded from CLS by spec instead of moving.
3. **Fast path reserves the comments panel** with the same technique (real `.comments-section` box + one `visibility:hidden` first-comment `<p>` at `fontSize:24/fontWeight:600`, matching :1258-1266) so a single-line comment is a pixel-identical swap. If the record has no comments the panel unmounts on completion; only the below-the-fold Footer moves.
4. **`scrollbar-gutter: stable`** on `html` in `src/index.css` — with classic scrollbars, crossing one viewport in height narrows the ICB by ~15px and shifts every in-flow element horizontally.
5. Extract `computeDisplayDimensions`, `getPlaceholderDimensions` and the new reserved-slot constants into `src/utils/detailLayout.js` (pure, jsdom-safe) so the geometry is unit-testable; PhotosComponent keeps the render logic. Do not change the aspect math or the 700px / `innerWidth−40` caps.

Do not touch: GraphQL queries, `buildPhotoPage`, `photoPageCache`/`inflightPhotoRequests`, the stale-response and keep-content-on-failure guards added by dc7c866, GA pageview dedupe, or `index.html`'s `#root` SEO markup.

## Implementation Notes

- Done as written: (1) label-row and comments slots are now invisible structural placeholders instead of `min-height` guesses; (2) the cold skeleton no longer renders `<Footer>` and reserves a paint-free band below the media; (3) `scrollbar-gutter: stable`; (4) geometry extracted to `src/utils/detailLayout.js` with unit tests.
- **Surprise:** the "reserve 3 pills" idea needs real markup, not just height — pill font size is relative (`max(0.8, conf/100)em`, so ≥0.8em) and resolves against Bootstrap's responsive `h1` size, which differs between jsdom (no viewport scaling) and a 1920px browser. The placeholder therefore mirrors the real markup with `visibility: hidden` (occupies space, paints nothing) rather than hard-coding px.
- **Surprise:** reserving the comments slot on the *fast* path is unavoidable if the footer must not move — it adds a visible ~57px comment line to every prev/next transition, which is why the cold path had to stop painting the footer (otherwise the cold page would paint 100vh of blank space above it).
- `getPlaceholderDimensions()` returns a **copy** of the fallback object now; the old helper returned the shared module constant, so any future mutation would poison every later call. Found while writing the unit tests.
- Removed the dead `minHeight: 58` and the arbitrary `minHeight: 200` cold-path filler; the only remaining magic number is `COLD_BELOW_MEDIA_RESERVE = 220`, which scores 0 CLS by construction (nothing below it was painted).
- Lint: my four files are clean. The repo's `npm run lint` still reports **11 pre-existing indent errors in `src/setupTests.js`** (verified present at the baseline commit) and 6 pre-existing warnings — untouched, out of scope.
- Iteration-2/3 hardening (from review): slot chrome overrides are compound selectors (`.comments-section.comments-section--slot`) so they cannot lose the cascade to the card rules declared later in the file; the placeholder row is clamped with `white-space: nowrap` + `overflow: hidden` so it can never be taller than one hydrated row; the label pills carry **no text** and are sized by CSS (`width: 5.5em; height: 1.4em`) so no crawler ever sees `<h1>label label label</h1>`; `renderRecognitionsH1` was split into `parseRecognitionLabels` (guarded, returns only renderable label objects) + `renderLabelRow`, and one parse now drives both the row content and its transparent-slot class.
- Tests: 52/52 pass — geometry unit tests, cold/bootstrap DOM invariants, empty-state slot invariants, and a stylesheet contract test (`src/containers/detailSlotStyles.contract.test.js`) that pins the cascade-safe selectors, the nowrap clamp, the shared pill metrics and `scrollbar-gutter: stable`.
- **Correction to Implementation Decision 1:** a wrapped label row is worth one full pill row of shift, measured ~74px on desktop and ~57px on a 390px phone (pills inherit Bootstrap's responsive `h1` = `calc(1.375rem + 1.5vw)`), not the "~36px" stated there.

## Verification

**Commands:**
- `npm run lint` -- expected: 0 errors (2 pre-existing react-hooks/exhaustive-deps warnings acceptable)
- `npm test` -- expected: existing suites pass plus new `src/utils/detailLayout.test.js` and detail-page skeleton invariants
- `npx vite build` -- expected: builds; `PhotosComponent` chunk still emits its own CSS

**Manual checks (dev server, `/photos/<id>`):**
- Cold deep link: label row does not jump when recognition labels appear; media top edge is identical before and after hydration; no `<footer>` in the DOM until data resolves.
- Click through from Home: thumbnail paints at final size, labels/comments fade in with zero movement of the media box.
- prev/next hover-preloaded navigation: instant paint, no vertical reflow of visible content.
- `npx lighthouse <url> --only-categories=performance` (run by the human — headless Chrome cannot start inside this sandbox): CLS ≤ 0.02 on desktop and mobile emulation for a landscape photo deep link.

## Review Triage Log

Lens: **quick** (pinned default), three iterations, all findings verified against the working tree.

| # | It | Finding | Class | Action |
|---|----|---------|-------|--------|
| F1 | 1 | Label row collapsed to nothing when a photo had no recognitions, pulling the painted media panel up (row sits **above** the media) | high, caused here | Fixed: the row always renders — real labels or the reserved slot; `recognition-tags--slot` drops its chrome so an empty row is invisible whitespace, not a glass panel |
| F2 | 1 | Placeholder pills at `1em` vs hydrated pills shrinking to `0.8em`, so hydration could pull media up | medium, caused here | Fixed: `.recognition-tags .recognition-tags-h1 { min-height: calc(1.4em + 20px) }` floors both states at one full-size pill row |
| F3 | 1 | Comments slot unmounted for comment-less photos, moving the painted Labels card and footer up | medium, caused here | Fixed: `CommentSlotSkeleton` stays mounted whenever there are no real comments; height constant in every state |
| F4 | 1 | `getPlaceholderDimensions` returned the shared fallback object on its SSR branch | low, caused here | Fixed (iteration 3): returns a copy; test asserts both branches |
| F5 | 2 | `.comments-section--slot` lost the cascade to the later `.comments-section` rule → an empty glass panel on most detail pages | medium, caused here | Fixed: compound selectors; pinned by the stylesheet contract test (jsdom cannot verify specificity — it ignores the cascade) |
| F6 | 2 | Three `"label"` pills wrap to two rows on a phone, so the placeholder could be **taller** than a short hydrated row and lift the media panel | medium, caused here | Fixed: `white-space: nowrap; overflow: hidden` on the placeholder row only (real labels still wrap) |
| F7 | 2 | Chrome class derived from `recognitions.length` while content depends on parsed labels → painted empty panel for corrupt metadata | low, caused here | Fixed: one parse (`parseRecognitionLabels`) drives both |
| F8 | 3 | Splitting parse from render dropped error containment around `.map()`: `{"Labels":"dog"}` or `[null]` threw and hit the error boundary | medium, caused here | Fixed: `Array.isArray` guard + filter to records with a usable `Name` |
| F9 | 3 | `JSON.parse(undefined)` threw (and logged) on every label-less view | low-medium, caused here | Fixed: `if (!recognition?.metaData) return null` before parsing |
| F10 | 3 | Filler text left a permanent `<h1>label label label</h1>` for SEO purposes | low | Fixed: pills are empty CSS-sized boxes; row height no longer depends on text at all |
| F11 | 3 | Contract test coupled to cwd / `?raw` returns empty under Vitest's CSS stubbing | low | Fixed: standalone `detailSlotStyles.contract.test.js` resolving the stylesheet from `import.meta.dirname` |
| R1 | 2,3 | Residual: a label set that wraps to 2+ rows grows the row and pushes the painted media panel down (~74px desktop / ~57px phone) | residual, accepted | Documented + deferred; needs real-device CLS data to justify a design change |
| R2 | 2 | Residual: 2+ comments or a wrapping first comment grow the comments slot and push the footer (in-viewport for landscape photos on desktop) | residual, accepted | Documented + deferred |
| R3 | 3 | Residual: prev/next legitimately changes media height (≤306px), moving painted content below it; mostly masked by CLS's ≤500ms post-interaction exclusion | residual, accepted | Documented |
| — | 1 | `index.html` static `#root` SEO markup, App-level Suspense fallback, absolutely-positioned nav buttons, `<img>`/`<video>` boxes with explicit dimensions, webfont FOUT (no `@font-face` in the built CSS) | false positives / not shift sources | Rejected after inspection; left untouched |

## Residual Shift Sources (honest scope of this change)

Zero shift is guaranteed for: single-row label sets, zero-or-one-line comment sets, cold loads (nothing below the media is painted), and scrollbar-driven horizontal movement. Still able to move already-painted content, by construction of the data rather than of this fix: multi-row label rows (R1), comments longer than one reserved line or more than one comment (R2), and media-aspect changes on prev/next (R3). Each is a *growth* of a reserved slot, which is the cheapest remaining form of shift; removing it entirely needs a layout decision (move the label row below the media, or reserve two rows / a fixed-height comments panel), not more code in this area.
