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
review: ''
review_source: ''
lenses_ran: []
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



## Plan Change Log

## Review Triage Log
