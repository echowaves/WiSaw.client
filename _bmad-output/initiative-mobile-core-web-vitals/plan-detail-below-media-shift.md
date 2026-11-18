---
title: 'Stop the below-media enhancement from moving painted content on landscape detail pages'
type: 'bugfix'
ticket: ''
created: '2026-11-18'
status: 'built'
baseline_revision: 'c8df5cfa17fc91971a983f496f2f24cfc95f758b'
route: 'oneshot'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** PageSpeed still reports Cumulative Layout Shift on `/photos/:id` for landscape photos (mobile). Landscape media is short, so the region under the media box is inside the first viewport — and that region is exactly where late data lands: React paints an empty-but-visible `.recognition-tags` glass panel plus a `<Footer>` into the frame's below slot, then comments/recognitions arrive from AppSync and grow the block, pushing the already-painted footer down. The same shape repeats on prev/next (the sidecar wording arriving after the client-painted frame grows the heading/description/tag row above an already-painted below slot). Portrait records hide the shift because their taller media pushes the region below the fold, which is why only landscape reports.

**Approach:** Paint nothing into the below-media slot until everything that can change its height is final — the record's comments/recognitions and the frame's published wording — so comments, labels and footer mount together as new nodes at their final height (insertions cannot shift), and take them down before anything above them changes again. Applies to both producers of the page automatically: the edge-painted frame on a direct visit and the client-painted frame after prev/next share one enhancement layer and one template, so the gate lives in that shared layer, not in either frame.

</frozen-after-approval>

## Implementation Notes

Oneshot: ~50 lines of source in one component (plus CSS-class reuse) and focused tests in the existing CLS suite. No new module: both gate inputs are already-known facts, so a helper would only restate an `&&`. Cause traced directly (not inferred): with `PSI` API quota exhausted and headless Chrome unable to start in this sandbox (Mach port `bootstrap_check_in` denied), the mechanism is read off the live served document (`curl` on the reported URL: `.wsk-box aspect-ratio:4000/3000`, media 4000×3000, empty `.wsk-slot-below{min-height:220px}`) plus the code paths below. Field CLS must still be confirmed by a human Lighthouse run.

Shift sources (all "a painted element sits below something that grows later", all inside the shared enhancement layer):
- `src/containers/PhotosComponent.js:1256-1262` — adopted mode portals `<BelowMediaContent>` and `<Footer>` into `frame.belowSlot`. Footer's chunk is tiny and cached; the record's comments/recognitions arrive later, so Footer is painted first and then pushed down when `.comments-section` replaces `CommentSlotSkeleton` (:160-172, invisible placeholder) and `.recognition-tags` fills from `renderRecognitions`. The empty `.recognition-tags` panel (:284-286) paints chrome (`PhotosComponent.css:82-88`: 14px margin + 14/16px padding + border) even with no recognitions, so a ~30px painted panel grows to ~105px+ → footer moves.
- `src/utils/detailSkeleton.js:refreshFrameText` (:180-232) — on a client-painted frame the wording sidecar usually lands after the paint and replaces heading/description/tag row in place. Their height differs from the fallback wording → the whole below slot, comments and footer included, moves.
- Not a source: media box aspect ratio (edge publishes `aspect-ratio` + numeric `width`/`height`; `mediaBoxStyle` in `src/utils/detailTemplate.generated.js:106-113`), header slot (`HEADER_MOBILE_PX` 64 matches `.header-container{height:64px}` at ≤768px), nav buttons (absolute), the cold placeholder branch (:1291-1324, paints nothing below the media).

Design decisions:
1. **Gate on finality, not on reservation.** Reserving heights cannot work here — comment count and label wrapping are unbounded, which is exactly why R1/R2 were left as residuals in `plan-photo-detail-cls.md`. Gating turns growth into insertion, which the CLS spec excludes.
2. **Two independent finality inputs, one gate.** Both mean "nothing more can change this", not "data arrived".
   - `detailsSettled` in `internalState`: false whenever state is seeded from the skeleton or from router state (both fake `comments: []` / `recognitions: []`, :906-946), true when the record's enhancement data is final — a fetched record painted (`paintCurrentPhoto`, :857-862), the cache-hit branch of the route effect (:913-920), or a settled fetch that returned nothing. The failure case matters: `fetchCurrPhoto` resolves `null` rather than rejecting, so a failed record must still settle the gate, or comments and the footer would never appear for an offline visitor.
   - `wordingSettled`: true when `(adopted && frame?.source === 'edge')` — the edge published final copy and the paint effect refuses to rebuild that frame (:596-599) — or once this id's sidecar attempt has resolved with any outcome. Track it as component state set in the existing seoText effect (:513-527) alongside `setSeoText`, reset at effect start. Deliberately *not* `detailSeoText.js`'s cache: that module intentionally refuses to cache offline/5xx, so "cached" would leave the gate shut forever on a blocked network and cost content, not just shift. Safe because that effect re-runs only on `photoId`, and a `photoId` change unmounts the below content first.
3. **Nothing painted while unsettled.** When the gate is closed, render no portals into `belowSlot` at all: the template's 220px reserve stays unpainted (transparent, no chrome) so its later growth moves nothing. This replaces today's "paint a placeholder version of the content" strategy below the media, which is what made the shift possible.
4. **Take it down before it can move.** The existing structure already unmounts these portals on prev/next (route change → `adopted` false and `currPhoto?.photo` truthy → `return null` at :1273-1275, before the repaint effect runs). Keep that invariant and pin it with a test, so a media aspect change across records can never move a visible below-media node.
5. **Empty recognitions panel loses its chrome.** With the gate, "settled but no recognitions" stops being transient and becomes permanent, so give that state `.recognition-tags--slot` (already defined at `PhotosComponent.css:149-153`: identical box, transparent background/border) instead of leaving a permanently empty glass panel — consistent with how the comments slot already behaves.

Do not touch: `src/utils/detailTemplate.generated.js` or anything in `WiSaw.cdk` (the shared template and its `detail-template-copy-once.js` pin stay as they are — the fix needs no markup change, which is what makes both render paths covered by one edit), GraphQL queries, `buildPhotoPage`/`photoPageCache`/`inflight*` dedupe, the edge-node src-swap and video handlers, `index.html`, or the LCP seed in `skeletonSeededPhoto`.


- Done as written: `detailsSettled` + `wordingSettled` gate the below-slot portals in adopted mode; a settled record with nothing to recognise wears `.recognition-tags--slot`. 2 source files (`PhotosComponent.js`, plus the class expression), tests extended in 2 files (7 new cases). No markup, CSS or backend change — both render paths share the enhancement layer, which is what makes one edit cover direct visits and prev/next.
- **Surprise:** `waitForBox()` in the CLS suite used the footer as its "a frame exists" signal. With the gate closed on an unsettled record three tests timed out for exactly the right reason; the helper now waits on `#root .wsk-box`, and a new `mediaAltIs` probe proves a record has landed (alt text comes from its first comment) without touching the gated region.
- **Surprise:** "comments, labels and footer arrive in one commit" is not observable through a never-settling mock — the pre-settle half of that invariant is pinned by the existing "paints nothing below the media" cases plus the new seam case, so the cls test pins the post-settle shape (slot has two children, footer last).
- Ordering accuracy: the real `Footer` is `lazy()`-imported, so on a cold chunk it lands in a commit *after* comments/labels rather than atomically. Still shift-safe — DOM order puts it after the content, and an insertion below already-painted nodes moves nothing — but read "mounts as one block" as "the footer is never painted before the content that grows above it".
- The wording gate settles on **any** sidecar outcome, not on an answer: `detailSeoText` deliberately refuses to cache offline/5xx and re-asks later, so gating on cached-but-absent would strand the footer offline. Safe because only a `photoId` change re-runs that effect, and navigation takes the region down first — pinned by `takes the region down as soon as the route leaves its record`.
- Suite is 198 tests / 17 files at this baseline (the 243 figure in earlier plans predates the shared-template consolidation). Verified: `npx vitest run` green, `npx eslint` clean on all three changed files, `npm run build` + postbuild SEO contract test green. One seam case flaked once at ~1.08 s under parallel load (a `findByText` default timeout) and passed in four subsequent runs; not attributed to this change.
- Not measured in a browser: headless Chrome still cannot start here (`bootstrap_check_in … Permission denied`) and the PSI API returns anonymous-quota exhaustion, so field CLS needs a human Lighthouse/PSI run on the reported landscape record.

### Pass 1 patches (from the quick lens)

- `.recognition-tags` chrome now keys off `parseRecognitionLabels(...)?.length` instead of `recognitions?.[0]`, so metadata that is `{}`, malformed, or `Labels: []` no longer keeps a permanently empty glass panel — the module already had that predicate for the frame's tag row.
- New seam case: an **adopted edge frame** with queries pending paints nothing into the below slot — proves the `source === 'edge'` shortcut alone cannot open the gate on the exact page PageSpeed measures.
- New cls cases: a record that cannot be read (`getPhotoAllCurr: null`) still settles the gate so the site footer survives; and the wording-in-flight case now models a *slow but successful* sidecar (delayed resolve) and asserts the region opens once it lands.
- Renamed the navigation case to what it proves ("as soon as the route leaves its record") and added the placeholder-still-present assertion instead of implying it observed ordering before a repaint.

## Review Triage Log

Pass 1 — `quick` lens (1 reviewer). Verdicts: high 0, medium 4, low 3, false 3, maybe-false 1.

- **medium / deferred (product call)** — No timeout on the AppSync link or the sidecar fetch means a *hung* request keeps comments and the footer off the page indefinitely; the footer used to mount unconditionally in adopted mode. Real and reachable (`src/consts.js` sets no timeout; `detailSeoText.js` has no `AbortController`). Not patched because any bounded-wait escape re-opens the growth-under-a-painted-footer shift this plan removes — recorded in `deferred-work.md`.
- **medium / patch (applied)** — `.recognition-tags` keyed off `recognitions?.[0]`, so `{}` / malformed / `Labels: []` metadata kept a permanently empty panel; now uses the module's existing `parseRecognitionLabels`.
- **medium / patch (applied)** — no coverage of an adopted edge frame under the gate, i.e. the reported page. Added in `detailSkeleton.seam.test.js`.
- **medium / patch (applied)** — the plan's own critical failure branch (`fetchCurrPhoto` resolving null → footer must survive) was untested. Added.
- **low / patch (applied)** — the wording-in-flight test modelled an infinite hang rather than a slow success. Rewritten with a delayed resolve plus a post-settle assertion.
- **low / patch (applied)** — the navigation case passed trivially (`#root` had been cleared) and overclaimed paint ordering. Renamed, placeholder assertion added.
- **low / rejected** — `CommentSlotSkeleton`'s ~90px invisible reserve is now purposeless dead space above the footer on comment-less records. Real but pre-existing (production paints that box today), cosmetic, and removing it means retiring `.comments-section--slot` CSS plus its contract case. Deferred with an entry.
- **false** — "`photoId` falsy leaves the gate shut forever": unreachable on `/photos/:photoId`, and with no id there is no frame, so the gated branch never renders.
- **false (as a shift)** — "the edge shortcut can adopt a stale copy whose wording differs from the sidecar": true as content consistency, but nothing above the below slot ever changes on that path (paint effect early-returns for `adopted && source === 'edge'`; `refreshFrameText` runs only on `painted` frames), so no shift follows. Recorded in `deferred-work.md` as pre-existing edge staleness.
- **false** — "nothing pins the slot's siblings while the gate is open": post-settle repaints (`paintFullMedia` flipping on first input/resize) call `refreshFrameText` with byte-equal wording for a client frame and are skipped entirely for an adopted edge frame; media `alt` writes are not layout; header-slot `display: contents` swaps 64 reserved px for a 64 px header (`HEADER_MOBILE_PX` vs `.header-container{height:64px}`).
- **maybe-false (unverified; would be medium)** — "the lazy Footer mounts in a later commit than the comments, so 'mounts together' is a mock artifact." The two `<Suspense>` boundaries do allow it, but DOM order keeps the footer appended *after* the content and an insertion below painted nodes cannot shift them. What would settle it: a browser run with the Footer chunk throttled. Plan wording amended instead of asserting atomicity.
- **low / rejected** — "existing tests now wait on the footer as their hydration signal": they still pass, the stronger wait is intended, and the rewritten bootstrap case also asserts the frame's box, aspect ratio and `src`.

## Verification

**Commands:**
- `npx vitest run src/containers/PhotosComponent.cls.test.js` -- expected: green, including new gate cases
- `npm test` -- expected: full suite green (198 tests / 17 files at this baseline), no regressions in `detailSkeleton.seam.test.js` / `PhotosComponent.fullMedia.test.js` / `detailSlotStyles.contract.test.js`
- `npx eslint src/containers/PhotosComponent.js src/containers/PhotosComponent.cls.test.js` -- expected: clean (repo-wide `npm run lint` has pre-existing indent errors in unrelated files)
- `npm run build` -- expected: production build green and `postbuild` SEO template contract test passes

**Manual checks:**
- `npx lighthouse https://wisaw.com/photos/2f3c38f7-9c2d-4c8b-9098-894070265dd7 --only-categories=performance --form-factor=mobile` (human-run: headless Chrome cannot start in this sandbox) — expected CLS ≤ 0.02 on that landscape record, and again after tapping next/prev.
