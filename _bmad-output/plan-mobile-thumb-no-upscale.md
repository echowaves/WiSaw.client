---
title: 'Landing feed thumbnails must never upscale beyond their natural size'
type: 'bugfix'
ticket: ''
created: '2026-11-03'
status: 'built'
baseline_revision: '3491655ffff0ccb11d1547ce062600cf5d2ddce9'
route: 'oneshot'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** On the landing screen (`/`), when the viewport is narrow (≤500px) the masonry feed collapses to one column and each thumbnail is stretched to fill the whole column. Server thumbnails are only 300px tall (for a portrait phone photo that's ~225px wide), so on a ~330–430px-wide column they get scaled up well past their natural size and look blurry/pixelated.

**Approach:** Stop forcing the feed images to fill the column. Render each thumbnail at its natural size, capped only by the column width (`max-width: 100%`) — an image can shrink to fit but is never enlarged beyond its original pixels. The card shrinks to wrap the image (centered in the column) so its rounded border hugs the thumb with no gaps on left/right between image and border; the caption sits beneath at image width. Apply to both Home.js image variants (with and without caption).

</frozen-after-approval>

## Implementation Notes

Oneshot because the fix is display-only. Root cause verified against backend (`WiSaw.cdk` `processUploadedImage` generates `{id}-thumb.webp` via `sharp .resize({ height: 300 })`, so natural thumb height is always 300px and width = 300 × photo aspect ratio) and empirically against production (sips on live thumbs: 225×300 portrait, 400×300 landscape, 533×300 video). Home's images used inline `width: '100%'` (which beats the `.masonry-grid-column img { width: 100% }` CSS rule), forcing upscaling whenever the column is wider than the thumbnail.

Final shape: new helpers `getFeedColumnWidth` / `getFeedThumbSize` in `imageUtils.js` compute each thumb's display box (min of masonry column content width and natural thumb width, mirroring Home's Masonry breakpoints and 90%/1120px container; column math is `(container + 20) / cols − 20` because `.masonry-grid` carries a −20px margin and each column a 20px padding-left). Breakpoints live in one exported `FEED_BREAKPOINT_COLS` map consumed by both `<Masonry breakpointCols>` and the helper — no duplicated constants. `Home.js`: card gets `width: thumb.width ?? '100%'; maxWidth: 100%; marginInline: auto` so the visible border hugs the image with no side gaps (human requirement added mid-run); images get an explicit inline px width from `getFeedThumbSize` (`'auto'` only when dims are unknown) plus `maxWidth: 100%`; the px value equals attrs and final display size so lazy-loaded thumbs reserve their box (no CLS — inline `width: auto` would have defeated the attrs' presentational hints). `.masonry-grid-column` gets `flex: 1 0 0%` so real columns are exactly equal-share, matching the helper's math. `resize`/`orientationchange` listeners bump a `forceRemeasure` state so the column-dependent box refreshes after viewport changes. Decisions: (1) the ▶ video badge is anchored to the thumbnail box (wrapper `position: relative`, image-width card) so it sits on the image corner, not the column corner; (2) records with null `photo.width`/`photo.height` (schema-nullable) degrade to the old full-column behavior — possible side gaps for those records are accepted rather than upscaling or hiding them; (3) the onError logo placeholder sets `style.width = '100%'` so it fills the card border. `getOptimizedThumbnailDimensions` left untouched for SearchComponent; PhotosComponent detail view and shared CSS fallback rule unchanged (inline styles override it here). Unit tests for the new helpers in `src/utils/imageUtils.test.js`.

## Plan Change Log

- 2026-11-03 (quick lens): Review found a CLS regression — pre-load `width`/`height` attrs came from `getOptimizedThumbnailDimensions` (244px cap) while post-load display is min(natural, column), so landscape/square thumbs jumped on lazy load. Fixed by new `getFeedThumbSize` in `imageUtils.js` (thumb natural width = 300 × aspect ratio; verified against production: portrait thumbs are exactly 225×300, landscape 400×300, video 533×300) feeding both the attrs and the card box. Review also flagged the desktop manual-check wording as wrong-by-construction ("visually unchanged") — amended below: portrait thumbs on desktop now render at natural size in a centered card, which is the frozen intent applied at every breakpoint.
- 2026-11-03 (human): New requirement mid-implementation — "the border around the thumb should not have any gaps on the right and left side between the image and the border." Cards now shrink-wrap the image (`width: thumb.width`, `maxWidth: 100%`, `marginInline: auto`) so the rounded card edge hugs the thumbnail with no side gutters; the caption sits under the image at the same width. This supersedes the letterbox-centering approach (gaps inside the card) from the first pass.
- 2026-11-03 (quick lens pass 2): Patched five triaged findings — null-dims fallback to full-column sizing, resize/orientationchange re-measure, onError placeholder fills the card, corrected column gutter math (`(container + 20) / cols − 20`, `clientWidth` vs `innerWidth`), and shared `FEED_BREAKPOINT_COLS` + new unit tests. Extreme-aspect-ratio sliver concern rejected as low value (see triage log); no plan-level change.
- 2026-11-04 (quick lens pass 3): Final-lens review found the pre-load CLS claim was not holding — inline `width: auto` overrides the width/height attribute hints, so lazy thumbs reserved zero height until loaded — and that masonry columns had no equal-share flex rule, so shrink-wrapped cards could pool free space at the right edge. Fixed both (px inline width from `getFeedThumbSize`; `flex: 1 0 0%` on `.masonry-grid-column`), plus rAF-coalesced resize handling and a test for the `clientWidth` path. See pass 3 triage below.


## Review Triage Log

<!-- Append-only. Populated by step-04 on EVERY review pass. -->

### Pass 1 (quick lens, v1 flex-centering implementation)

1. **[PATCHED] CLS regression** — pre-load attrs capped at 244px ≠ final display box. Evidence: fixed by `getFeedThumbSize` feeding both attrs and card box; thumb model verified empirically against production (`sips`: 225×300 portrait, 400×300 landscape, 533×300 video).
2. **[PATCHED] Plan manual-check wording** ("desktop visually unchanged") wrong-by-construction because never-upscale shrinks portrait thumbs on desktop too. Evidence: Verification section amended to state the intended desktop consequence.
3. **[ACCEPTED-AS-DESIGN] ▶ badge anchor moved** from column corner to image corner. Evidence: required by the hug-border requirement; wrapper is `position: relative` and hugs the image.
4. **[DEFERRED] Duplicated breakpoint knowledge / scope creep** — first pass duplicated Home's masonry breakpoints in two places and grew helpers. Evidence: shared constant added in pass 2 patch; broader refactor of legacy `getOptimizedThumbnailDimensions` recorded in `_bmad-output/deferred-work.md`.

### Pass 2 (quick lens, v2 shrink-wrap implementation)

1. **[PATCHED] Null-dims records got gaps + no CLS box.** Evidence: `getFeedThumbSize` now returns nulls for unknown dims / SSR; card falls back to `width: '100%'` and attrs are omitted — old behavior retained (gaps possible only for those records; upscaling remains banned). 240 sampled production items all had dims.
2. **[PATCHED] No re-measure on resize/orientation change.** Evidence: Home.js adds `resize`/`orientationchange` listeners bumping `forceRemeasure`; cleanup removes both.
3. **[PATCHED] onError logo no longer hugged the card.** Evidence: both handlers now set `e.target.style.width = '100%'` so the placeholder fills the border (placeholder upscaling is acceptable).
4. **[PATCHED] Gutter math off by the gutter constant and used `innerWidth` for the container %.** Evidence: `(container + 20) / cols − 20` with `document.documentElement.clientWidth || window.innerWidth`; column counts still use `innerWidth` exactly like react-masonry-css. Regression-tested in `imageUtils.test.js`.
5. **[PATCHED] Duplicated breakpoint constants, zero tests for new logic.** Evidence: single exported `FEED_BREAKPOINT_COLS` consumed by Masonry and the helper; 12 new unit tests (breakpoint boundaries, scrollbar page widths, never-upscale invariant, null-dims contract).
6. **[REJECTED-LOW] Extreme aspect-ratio thumbs could render very narrow cards (slivers).** Evidence: no such items in 240 sampled production feed records; phone photos ≥ 9:19.5 give ≥ ~154px cards at the 351px single column; any min-width clamp would reintroduce the banned side gaps, contradicting requirement 2.
7. **[NO-ACTION] `naturalWidth` field flagged as possibly unused.** Evidence: false — Home.js does not read it, but it is part of the helper's documented contract and asserted by tests; keeping it prevents callers re-deriving the 300px thumb model.

### Pass 3 (quick lens, full-history diff)

Reviewer verified patches (a)–(e) from pass 2 all hold (null-dims degrade, listener cleanup, onError mutation survives React re-renders since the style prop never sets `width`, react-masonry-css breakpoint semantics match `getFeedColumnCount`, tests genuinely exercise the helpers). Findings:

1. **[PATCHED] Inline `width: auto` on feed imgs defeats the width/height attribute presentational hints.** Evidence: correct per CSS cascade — author-origin inline styles override HTML presentational hints, so pre-load both axes are `auto` with no intrinsic size yet → zero reserved height and full-column reflow on lazy load (the CLS the attrs were supposed to prevent). Fixed by setting inline width to `${thumb.width}px` when dims are known (`'auto'` only in the null-dims fallback); the px value equals min(column, natural) so it still never upscales, and `maxWidth: 100%` clamps if layout ever diverges from the formula.
2. **[PATCHED] `.masonry-grid-column` had no flex/width rule.** Evidence: correct — columns were `flex: 0 1 auto` (content-sized), so equal-share column width was only an upper bound; with shrink-wrapped cards the grid could end up narrower than its container, ragged at the right edge. Fixed with `flex: 1 0 0%` (border-box sizing confirmed global in `index.css`), making real columns match `getFeedColumnWidth()` exactly. Shared with SearchComponent, whose full-width cards are unchanged by equal-share columns.
3. **[PATCHED] Resize handler re-rendered synchronously per event.** Evidence: fair — react-masonry-css coalesces via rAF; handler now cancels + schedules one `forceRemeasure` per frame and cancels on cleanup.
4. **[PATCHED] Test comment claimed jsdom `clientWidth = 1024`; it is actually 0** (only the `|| innerWidth` fallback was exercised). Evidence: correct — comment fixed and a new test stubs `documentElement.clientWidth` to cover the preferred path. Suite now 19/19.
5. **[REJECTED-FALSE] `.masonry-grid-column img { width: 100% }` could override the inline style.** Evidence: false — inline styles beat non-`!important` stylesheet rules regardless of source order (that CSS rule is not `!important`); adopting the reviewer's suggested change would re-introduce upscaling.
6. **[NO-ACTION-NIT] `forceRemeasure` value is never read.** Evidence: intentional forced-rerender pattern; documented by adjacent comment in Home.js.

### Pass 4 authoring notes (jsdom test corrections)

Test expectations were corrected twice while authoring — jsdom viewport assumptions and the maxWidth-cap equality case — final suite green after each correction.

## Verification

**Commands:**
- `npm run lint` -- expected: no new errors in `src/containers/Home.js`
- `npx vite build` -- expected: production build succeeds (plain `vite build`; skip the sitemap curl used by `npm run build`)
- `npx vitest run` -- expected: existing suite still passes

**Manual checks:**
- Narrow viewport (~390px wide, one column): portrait thumbnails render at 225px wide (their natural size) inside a centered card whose rounded border hugs the image — no gaps between image and card edge on left/right; never stretched. Landscape/full-width thumbs fill the column.
- Desktop widths (4/3/2 columns): narrow-portrait thumbs display at natural size in centered cards instead of being stretched to full column width (intended consequence of never-upscale); wide thumbs still fill their column.
- Lazy-load scroll: card box is reserved from photo dimensions before the image loads — no vertical jump as images pop in.
