---
title: 'Search page renders the main feed layout from one shared layout file'
type: 'feature'
ticket: ''
created: '2026-11-20'
status: 'built'
baseline_revision: 'fbbe965345b43c07b67068897da5b152558486cf'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: ['.github/copilot-instructions.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `Home.js` and `SearchComponent.js` each hand-roll their own copy of the same feed layout, and the copies have drifted. Home carries the 2026-11-04 no-upscale work (shared `FEED_BREAKPOINT_COLS`, `getFeedThumbSize` display box, card border hugging the image, remeasure on resize/orientation); Search still uses the legacy `getOptimizedThumbnailDimensions`, its own inline breakpoint literal, `width: 100%` + `object-fit: cover` images and no remeasure — so search results upscale, shift on lazy load and can differ in column count from the feed.

**Approach:** Make the layout a single reused module that both routes render, with Home's newer layout as the reference. Search keeps its own data fetching, headings, SEO and empty/no-result states; everything that draws the grid and the card comes from the shared file.

## Boundaries & Constraints

**Always:**
- One layout source: after this change neither page contains feed card or masonry markup of its own.
- Reference behavior is Home's current one — column count from `FEED_BREAKPOINT_COLS`, thumb box from `getFeedThumbSize` (min of column width and natural thumb width), card shrunk to the image with `marginInline: auto`, full-column fallback when `photo.width`/`photo.height` are null.
- Search keeps its alt-text semantics (`{term} - WiSaw`) — layout parity must not cost SEO text.
- Existing shared CSS class names and `PhotosComponent.css` rules stay as they are; inline styles keep overriding `.masonry-grid-column img`.

**Never:**
- No change to GraphQL queries, pagination/infinite-scroll behavior, routing, or the edge/SEO path (`staticSeo.generated.js` is generated — never hand-edit).
- No new dependencies, no CSS-in-JS, no state library, no TypeScript.
- Do not touch `PhotosComponent.js` (detail route) or the detail skeleton/template machinery.
- No push, no deploy.

## Decisions (human-confirmed 2026-11-20)

- **Shared file scope:** the reused module owns `<main>`, the 1120px/90% content column, `<InfiniteScroll>`, `<Masonry>` and the card. Pages keep their own headings, search box, SEO tags, empty/no-result blocks and `<Footer />` — passed in as children rendered above the feed.
- **Loader:** the `Bars` spinner (`renderLoadingIndicator`) becomes the shared "load more" indicator on both routes; Home's plain-text loader is retired. Search's first-frame `initial-loading-container` stays page-owned.
- **Dead code:** delete `getOptimizedThumbnailDimensions` and `getSearchGridDimensions` from `imageUtils.js` once nothing imports them.
- **Version control:** commit on `main`, no push, no deploy.
- **Plan size:** kept whole at ~2270 tokens (user accepted the context-rot risk rather than splitting one goal).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Same record, both routes | One photo with `width`/`height`, rendered on `/` and on `/search/<term>` | Card DOM (wrapper classes, img attrs, inline width) is identical apart from link target and alt text | n/a |
| Portrait thumb in a narrow column | Viewport ≤ 700px, tall photo | Display box = min(column width, natural thumb width); no upscaling, no `object-fit: cover` cropping | n/a |
| Unknown dimensions | `photo.width`/`height` null (schema-nullable) | Card and img fall back to full-column (`width: '100%'` / `'auto'`), no `NaN` attrs, ▶ badge still anchored to the image box | Graceful degrade, as Home does today |
| Viewport change | resize or orientationchange crosses a breakpoint | Both pages re-measure card boxes without reload | Listener cleanup on unmount |
| Video record | `photo.video === true` | `/videos/{id}` link and ▶ indicator identical on both pages | n/a |

</frozen-after-approval>

## Code Map

- `src/containers/Home.js` — **reference layout**. `<main>` + content column `maxWidth: 1120px / width: 90%` (L386–415), card + Masonry JSX inline in `renderInfiniteFeed()` (~L170–320, incl. the text loader and end message); `FEED_BREAKPOINT_COLS`, `getFeedThumbSize`; resize/orientationchange `forceRemeasure` effect (L44–64). Becomes a consumer of the shared module; its markup moves out verbatim.
- `src/containers/SearchComponent.js` — **divergent copy** to replace: its own `<main>`/content column (L387–400), inline `breakpointCols={{default:4,1100:3,700:2,500:1}}`, `getOptimizedThumbnailDimensions`, `width:'100%'`+`objectFit:'cover'` (L246–380), no remeasure. Keep page-owned: `FEED_FOR_TEXT_SEARCH` query, `retrievePhotos`/`applySearchResults`/`handleSearchFailure`, `requestComplete` gate + `initial-loading-container` first frame (its own `<main>`, mutually exclusive with the feed's), h1/empty/no-result blocks (children of the shared shell), sibling `<Footer />` **outside** `<main>`, `RouteSeo`, GA pageview.
- `src/utils/imageUtils.js` — parity source: `FEED_BREAKPOINT_COLS` (L41), `getFeedColumnWidth`, `getFeedThumbSize` (L82). Legacy search sizing `getOptimizedThumbnailDimensions` (L5) and `getSearchGridDimensions` (L107, already imported by nobody).
- `src/containers/PhotosComponent.css` — `.home-thumb-card` (L214), `.thumbnail-wrapper`, `.video-indicator`, `.masonry-grid`/`.masonry-grid-column` (`flex: 1 0 0%`, ±20px gutter) already shared by both pages. **Do not modify.**
- `src/a11yLandmarks.test.js` — mounts the real `App` with mocked `consts`/`react-ga4`/`react-loader-spinner` for `/` and `/search/lake` including a settled feed record (`FEED_PHOTO`, `flush()`/`settle()`). Reuse this harness for the parity check; it must keep passing unchanged.
- `src/utils/imageUtils.test.js` — pins `FEED_BREAKPOINT_COLS` and `getFeedThumbSize`; extend only if new helpers are extracted.

## Tasks & Acceptance

**Execution:**
- [x] `src/containers/FeedGrid.js` (new) -- Create the shared feed layout module: `<main>` + 1120px/90% content column + `<InfiniteScroll>` + `<Masonry breakpointCols={FEED_BREAKPOINT_COLS}>` + card markup, lifted out of Home verbatim; owns the resize/orientationchange remeasure and the `Bars` loader + "Yay! You have seen it all" end message. Props: `photos`, `next`, `hasMore`, `scrollKey`, `altFor(photo)`, and `children` rendered above the feed (page headings/search box/states). Nothing outside this file renders `.masonry-grid`, `.home-thumb-card` or `Bars` -- single source for both routes.
- [x] `src/containers/Home.js` -- Delete the local card/Masonry JSX, `<main>`/column wrappers, remeasure effect and text loader; render the shared module with Home's data and `/` alt text, passing headings + search box as children; keep JSON-LD and `RouteSeo` -- no visible behavior change on the feed beyond the spinner.
- [x] `src/containers/SearchComponent.js` -- Render the shared module (search term in `altFor`, `scrollKey={activeSearchTerm}`), drop `getOptimizedThumbnailDimensions`, the inline breakpoint literal, its own `<main>`/column and its grid loader; leave fetching, the `requestComplete` gate with `initial-loading-container`, empty/no-result copy, `RouteSeo` and the sibling `<Footer />` untouched -- parity comes from reuse, not a second copy.
- [x] `src/utils/imageUtils.js` -- Delete `getOptimizedThumbnailDimensions` and `getSearchGridDimensions` once nothing imports them -- dead code that encodes exactly the non-parity behavior.
- [x] `src/feedLayoutParity.contract.test.js` (new) -- Render `/` and `/search/lake` through the existing a11yLandmarks harness with the same mocked record and assert the two cards match structurally (classes, img width/height attrs, inline width, wrapper styles) and that Search no longer imports legacy sizing -- a check that fails if either page grows its own copy again.

**Acceptance Criteria:**
- Given the feed and a search-results page showing the same record, when both have rendered, then their card markup is structurally identical (same classes, attrs, inline sizing) except link target and alt text.
- Given a search thumb whose natural width exceeds its column at ≤700px, when it renders, then its box equals `getFeedThumbSize` output — never the column width, so nothing upscales or crops.
- Given a settled search page, when the viewport crosses a masonry breakpoint, then card boxes are recomputed without a reload.
- Given `/search` with no term and `/search/zzznothing`, when they render, then the prompt and "Nothing found" blocks are unchanged and each route still exposes exactly one `main` landmark.
- Given either page's feed query fails, when it settles, then the page renders its empty state without console-thrown errors, as today.

## Implementation Notes

**Built (2026-11-20):**
- `src/containers/FeedGrid.js` (new) — the single feed layout: `<main>` + 1120px/90% column + `<InfiniteScroll>` + `<Masonry breakpointCols={FEED_BREAKPOINT_COLS}>` + card, lifted out of Home. Owns the rAF-coalesced `resize`/`orientationchange` remeasure and the `Bars` load-more spinner plus the end message. Props: `photos`, `next`, `hasMore`, `scrollKey`, `altFor(photo)`, `children`.
  - The card's two near-duplicate branches (comment / no comment) collapsed into one path: they differed only in alt text, and `altFor` already covers both cases, so the DOM is unchanged.
  - Exports `FeedLoader` as well as default-exporting the grid. Search's page-owned first frame needs the spinner, and "nothing outside this file renders `Bars`" is honoured by keeping the markup in this module — Search renders `<FeedLoader label='Loading content' />`, byte-identical to its old `renderLoadingIndicator`.
  - Renders the infinite-scroll section only when `photos.length > 0`. Without that gate, `/search/zzznothing` would gain "Yay! You have seen it all" beside "Nothing found", and Home flashed that line on every first frame (`noMoreData` starts `true`). Home's populated feed is unaffected.
- `src/containers/Home.js` — card/Masonry/`<main>`/column/remeasure/text loader deleted; renders `FeedGrid` with headings + search box + `RouteSeo` + JSON-LD `Helmet` as children. 244 lines → 68 of JSX.
- `src/containers/SearchComponent.js` — same treatment with `altFor` carrying `{term} - WiSaw` and `scrollKey={activeSearchTerm}`; fetching, the `requestComplete` gate, empty/no-result copy, `RouteSeo` and the sibling `<Footer />` untouched.
- `src/utils/imageUtils.js` — `getOptimizedThumbnailDimensions` and `getSearchGridDimensions` deleted (75 lines); nothing imports them.
- `src/feedLayoutParity.contract.test.js` (new, 11 cases) — mounts the real `App` on `/` and `/search/lake` with one shared three-record fixture (landscape-with-comment, portrait-video, square; three so all desktop columns are occupied — react-masonry-css renders a column div only per occupied column). Compares normalised card `outerHTML`, classes, img width/height attrs and inline sizing; asserts `getFeedThumbSize` equality and empty `objectFit`; crosses the 1024→500 breakpoint and requires the inline box to change (Masonry restacking alone would not); pins each route's alt text; pins the empty/no-result blocks with no grid markup inside `main`; and greps Home/Search for `masonry-grid`/`home-thumb-card`/`Masonry`/`InfiniteScroll`/`Bars` plus the retired helpers.

**Negative controls:** forcing the card back to `width: '100%'` + `objectFit: 'cover'` and deleting the remeasure effect fails exactly "keeps search thumbs inside getFeedThumbSize…" and "re-measures search card boxes…"; restored after.

**Verification:** `npx vitest run` → **235 passed / 20 files** (baseline 225/19; `a11yLandmarks.test.js` green unchanged). `npx eslint src --ext .js` → **17 problems**, identical to the recorded baseline; per-file lint of the touched files shows only the two pre-existing `exhaustive-deps` warnings. `npx vite build` clean — `FeedGrid` becomes one shared lazy chunk instead of two page-local copies — and `postbuild` (`src/seo.template.test.js`) **12 passed**.

**Deliberate deltas:** Home's empty-feed frame no longer shows the plain-text loader nor a premature end message; Home's unreachable `` Photo ${id} `` alt fallback is gone (that branch only rendered when `lastComment` was truthy).

**Matrix audit (planning thread):** three rows of the frozen I/O matrix had no covering test — null `width`/`height` fallback, "both pages re-measure" (`/` was untested and only `resize` was exercised), and listener cleanup on unmount. Added to `src/feedLayoutParity.contract.test.js`: a `UNKNOWN_DIMS` record rendered on both routes (no attrs emitted, `style.width: 'auto'`, card at full column, no `NaN` in the DOM, ▶ still inside `.thumbnail-wrapper`), an `orientationchange` re-measure case for `/`, a `removeEventListener` spy asserting both listeners are dropped on unmount, and `/videos/{id}` + ▶ badge assertions per route in the alt-text case. Parity file now 15 cases; full suite **240 passed / 20 files**; lint of every touched file still matches baseline exactly.



## Plan Change Log

## Review Triage Log

**Pass 1 (2026-11-20, lens `quick`, run as a context-free subagent against the plan + `.github/copilot-instructions.md`):** 0 high / 0 medium / 5 low / 1 false. No intent_gap, no bad_plan, so no loopback.

| Finding | Verdict | Evidence / route |
|---|---|---|
| `FeedGrid.js:95-115` + `PhotosComponent.css:362-368` — card sets no inline `objectFit`, so `.masonry-grid-column img { object-fit: cover }` still applies; matrix "no cropping" not delivered, and the test only reads inline style | **false** | Checked at the cited lines: the card's inline `height: 'auto'` with an explicit px width makes the content box always match the image's intrinsic ratio, so `cover` has nothing to crop. The same rule already styled Home's feed images since `52d81d4` with no observed cropping, so nothing regressed here. Its sub-claim that `getFeedColumnWidth` returns an unrounded width (→ `width="293.86…"`, parsed as 293 against a rounded height) is real but pre-existing on `/` and shifts the pre-CSS aspect hint by under a pixel — recorded in deferred work rather than patched. |
| `feedLayoutParity.contract.test.js:338-345` — failure case proves only one `<main>`; a regression dropping `setRequestComplete(true)` still passes, so the "renders its empty state" acceptance criterion is unasserted | **low** → patch | Confirmed: it asserted landmark count and absence of `.masonry-grid`, both of which hold on a permanently-spinning search page. Patched to assert each route's own empty state (`Nothing found` / the feed headings) and that the frame is not `initial-loading-container`. |
| `feedLayoutParity.contract.test.js:265-278` — cleanup guard vacuous for `resize` because react-masonry-css removes its own window resize listener | **low** → patch | Confirmed at `node_modules/react-masonry-css/dist/react-masonry-css.module.js:59,69`. Patched to capture handler identity on `addEventListener` and require every registered `resize`/`orientationchange` handler to be removed with the same type. Negative control after the patch: deleting FeedGrid's `removeEventListener('resize', …)` line now fails this case ("the resize handler registered during mount was never removed"). |
| `feedLayoutParity.contract.test.js:282` — comment says "one column" at a 700px viewport and the case pins no column count | **low** → patch | Confirmed: `FEED_BREAKPOINT_COLS` matches `700: 2` under `viewportWidth <= Number(key)`. Comment corrected to two ~451px columns and the case now asserts `columnCount() === FEED_BREAKPOINT_COLS[700]`. |
| `imageUtils.js:6-7,13-14,26,43` — comments still credit Home with the breakpoints, the 90%/1120px wrapper and "a Home feed thumbnail" | **low** → patch | Confirmed: after this change only `FeedGrid.js` imports `FEED_BREAKPOINT_COLS` or renders the column. All three comment blocks reworded to name `containers/FeedGrid.js`, with a note that FeedGrid's wrapper must move with `getFeedColumnWidth`. |
| `.github/copilot-instructions.md` — its Project Structure listing enumerates every container and has no `FeedGrid.js`; `CLAUDE.md` calls that file the source of truth | **low** → defer | Real drift, but the fix edits an agent-context file, which this workflow routes to deferred work rather than patching here. Recorded in `_bmad-output/initiative-mobile-core-web-vitals/deferred-work.md`. |

## Verification

**Commands:**
- `npx vitest run` -- expected: all files pass (240 tests after the review patches; the suite must stay green including `src/a11yLandmarks.test.js`, which owns the one-`main`-per-route contract)
- `npx vitest run src/feedLayoutParity.contract.test.js` -- expected: every parity case passes; deleting FeedGrid's `removeEventListener('resize')` line must fail "drops every viewport listener it registers when the feed unmounts"
- `npm run lint` -- expected: no new problems versus baseline (the 11 errors live in `src/setupTests.js`; touched files show only the two pre-existing `react-hooks/exhaustive-deps` warnings)
- `npm run build` -- expected: `vite build` succeeds and `postbuild` runs `src/seo.template.test.js` green; `FeedGrid` appears once as a shared chunk rather than duplicated per page

**Manual checks:**
- On `https://wisaw.com` after deploy: open `/` and `/search/<term>` at phone width and confirm identical card widths, gutters and column counts, that the ▶ badge sits on the image corner on both, and that rotating the device re-fits the cards without a reload.
