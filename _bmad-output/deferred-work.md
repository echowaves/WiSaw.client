# Deferred Work

Log of review findings and observations deliberately not addressed in the current build. Add an entry per item; do not delete history.

## 2026-11-03 — mobile-thumb-no-upscale (quick lens pass 1)

- **Legacy dimension helpers are duplicated knowledge.** `getOptimizedThumbnailDimensions` / `getSearchGridDimensions` in `src/utils/imageUtils.js` hardcode their own caps and breakpoints, independent of the feed layout, and are still used by `SearchComponent.js`. The new `FEED_BREAKPOINT_COLS` / `getFeedColumnWidth` / `getFeedThumbSize` helpers are the single source of truth for Home. Migrating SearchComponent onto the new helpers (and deleting or reworking the legacy ones) is a separate change with its own manual QA on the search page.

## 2026-11-09 — photo-detail-cls (quick lens, passes 1-3)

- **Reserved slots can still grow: multi-row label rows and long comments.** The detail page reserves exactly one pill row (`min-height: calc(1.4em + 20px)`) and one comment line. A record whose three labels wrap on a narrow viewport, or whose first comment wraps / has more than one comment, grows the slot and pushes whatever is painted below it by ~57-74px per extra row. Removing this needs a layout decision, not more code: either move the label row **below** the media panel (then only sub-fold content can move), or reserve two rows / a fixed-height comments panel and accept the dead space. Needs field CLS data per breakpoint before spending that screen space.
- **`window.innerWidth` is read once for the media box.** `computeDisplayDimensions` / `getPlaceholderDimensions` take a snapshot of the viewport; a resize or orientation change between the cold skeleton and hydration (or after render) leaves the media box at the old width, which is itself a layout shift. There is a `resize` listener in the component for other purposes; wiring the dimension math to it (debounced) is a separate change with its own QA on mobile rotation.
- **CLS was not measured in-browser.** Headless Chrome cannot start inside this agent sandbox (`chrome-headless-shell` dies on Mach port registration, `/Applications/Google Chrome.app` is unreadable), so the fix is verified by construction plus DOM/stylesheet contract tests only. Someone must run `npx lighthouse https://wisaw.com/photos/<id> --only-categories=performance` (or PSI) on desktop + mobile emulation and confirm CLS ≤ 0.02 before declaring the 0.134 gone. A harness stub of this measurement exists at `$TMPDIR/cls-tools/measure.mjs` (scratch, not committed).
- **Prev/next navigation still changes media height.** Crossing from a portrait to a landscape record legitimately resizes `.crop` by up to ~306px, moving the comments slot and footer. CLS's ≤500ms post-interaction exclusion hides most of it in the field; making it shift-free would require letterboxing to a fixed box (a visual design change).

## 2026-11-10 — photos-detail-lcp (scope decisions)

- source_plan: `_bmad-output/plan-photos-detail-lcp.md`
  summary: Serve a correctly-sized LCP image (an ~800px webp derivative, or `srcset` on the edge-injected `<img>`) so no client ever downloads the 1.2–3.4 MB original for first paint.
  evidence: The dominant LCP term is bytes of the full-resolution upload injected by WiSaw.cdk `injectMetaTagsLambdaFunction`; only a `-thumb.webp` (29–53 KB) exists today. Fixing it needs an edge/upload change in echowaves/WiSaw.cdk, which this plan excludes by the user's "no backend changes" constraint. The client-side fix is a stopgap that trades source fidelity for latency below 700px.
- source_plan: `_bmad-output/plan-photos-detail-lcp.md`
  summary: Paint the detail media as soon as `getPhotoAllCurr` resolves instead of awaiting `Promise.all([curr, next, prev])`.
  evidence: Would remove two of three AppSync round-trips from the post-hydration paint, but LCP on this route is decided pre-JS (the edge-injected media), so it improves perceived warm navigation rather than the reported metric. It also re-shapes `buildPhotoPage`'s cache entry and touches guards + CLS invariants shipped in 12ad2bf — deserves its own change with its own QA.

## 2026-11-10 — photos-detail-lcp (production incident follow-ups)

- source_plan: `_bmad-output/plan-photos-detail-lcp.md`
  summary: Make `injectMetaTagsLambdaFunction` locate the mount point structurally instead of by first-match string search, so no template edit can ever blank a page.
  evidence: Deploying 0a83953 served blank photo/video pages (https://wisaw.com/photos/b677383c-3361-4e9d-857f-7965ab767ba2 returned HTML with no entry script and no stylesheet). The edge function replaces everything from the first literal `<div id="root">` to the next `</div>`; this repo's index.html had two more of those literals inside HTML comments, so the span swallowed the preload bootstrap, the module entry and both sheet links. echowaves/WiSaw.cdk should anchor on a unique marker (or parse), and ideally assert the result still contains `<script type="module"` before returning. Client-side mitigation shipped in the hotfix: index.html now has exactly one mount-point literal, pinned by `src/seo.template.test.js`.
- source_plan: `_bmad-output/plan-photos-detail-lcp.md`
  summary: Set deploy metadata per path — hashed assets `public, max-age=31536000, immutable`, `index.html` and `service-worker.js` `no-cache`.
  evidence: The last deploy applied `max-age=31536000` to every object; `curl -I https://wisaw.com/service-worker.js` still answers `cache-control: max-age=31536000`, so the legacy worker can stick for a year. Document HTML currently survives only because CloudFront overrides it (`max-age=900` on `/`, `max-age=100` on deep links) — the origin metadata is still wrong and will bite if that behaviour or distribution changes.
