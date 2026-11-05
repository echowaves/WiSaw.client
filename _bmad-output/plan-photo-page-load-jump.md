---
title: 'Eliminate the loading-to-content jump on the photo/video detail page'
type: 'bugfix'
ticket: ''
created: '2026-11-04'
status: 'built'
baseline_revision: 'b7571f7104a3ede03cd8cfbebc71d8e08ad89002'
route: 'oneshot'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 1
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Opening `/photos/:id` or `/videos/:id` shows two visually different pages in sequence: first a generic loader (a fixed 300×300 spinner square floating on an otherwise empty page), then — when the GraphQL batch resolves — the real detail page (nav buttons, label headline, media at its true aspect ratio up to 700px, comments, footer). The abrupt layout swap is a visible jump, both on deep links and when clicking through from Home/Search.

**Approach:** Make "loading" look like the final page instead of a different page. (1) Home/Search pass the clicked feed record via router `Link` state; when its id matches `:photoId`, PhotosComponent renders the real layout immediately — media box at correct aspect ratio with the thumbnail visible — then hydrates comments/recognitions when the query resolves, so no loader appears at all for in-app navigation. (2) For cold deep links, render a skeleton that mirrors the final page's structure and sizes (same containers, media box sized like the final max-size box, Footer in place, reserved slots for headline/comments) so content fills reserved space instead of swapping layouts. (3) When page data is already in `photoPageCache` (prev/next hover preloads), paint immediately without blanking state first.

</frozen-after-approval>

## Implementation Notes

Oneshot: display-only, mostly one file (~90–110 lines), degrades to current behavior whenever router state/cache is absent.

Verified facts from investigation (`src/containers/PhotosComponent.js`):
- Loading branch (lines ~1219–1265) renders a 300×300 spinner box in an empty `content-container`, no Footer — the "square" the user sees. Final page returns at line ~900+ with `<main class="content-container">`, nav buttons, Helmet, h1 recognition labels, crop box (`getDimensionsFromPhoto`: ≤700px long side; mobile `innerWidth − 40`), comments, Footer.
- `load()` awaits `buildPhotoPage` (curr+next+prev via `Promise.all`); the `photoId` effect first blanks `internalState` to null — even on cache hits, causing a skeleton flash during prev/next navigation.
- Feed records from Home (`feedRecent`) and Search carry `id, imgUrl, thumbUrl, videoUrl, video, watchersCount, lastComment, createdAt, width, height` — enough to bootstrap `{ photo: feedRecord, comments: [], recognitions: [] }`. Render guards already tolerate empty `comments`/`recognitions` (`renderRecognitions(null)` → `<div/>`).
- Photo branch layers thumbUrl under the fading full image; video branch shows thumbUrl immediately — both work from a bootstrapped record.

Design decisions:
1. Router state key `{ feedPhoto }`; used only when `feedPhoto.id === photoId` (guard against stale/wrong photo). React Router gives each navigation its own state, so prev/next Links (no state) fall through to cache/skeleton paths; refresh keeps state, which is fine since hydration overwrites it.
2. In the `photoId` effect: try synchronous cache hit first, then router-state bootstrap; only blank `internalState` when neither yields data. This kills the flash on hover-preloaded prev/next.
3. Bootstrap reserves a min-height (~48px) placeholder for the h1 labels block while `requestComplete === false`, so media doesn't shift down when recognitions hydrate.
4. Cold-link skeleton keeps `.PhotosComponent` > `main.content-container`, lazy `<Footer />`, and a spinner box sized via the same responsive math as `getDimensionsFromPhoto` for an unknown (square) aspect — min(700px, viewport−40).
5. Keep `buildPhotoPage`'s three-query `Promise.all` untouched: queries run in parallel and cache/preload dedup depends on it; splitting curr-first adds fetch-orchestration risk for ~1 round-trip of latency the visual fixes already mask.

## Plan Change Log

## Review Triage Log

Quick lens (1 iteration, 6 findings):
- F1 high/real — `imageLoaded` no longer reset on fast paths; full-res img popped over undecoded thumbnail. Patched: unconditional `setImageLoaded(false)` in the photoId effect, `true` on bootstrap paths (thumbnail already decoded from feed).
- F2 high/real — failed GraphQL batch painted `{currPhoto:null}` over already-rendered content → bootstrapped/cached page collapsed to NoMatch. Patched: `load()` keeps painted content when `pageData?.currPhoto == null`; NoMatch only when nothing valid on screen.
- F3 medium/real — cache-hit fast path sets internalState twice; GA pageview could double-fire. Patched: `lastPageviewRef` dedupes consecutive identical pageviews.
- F4 medium/real — lazy `<Footer/>` in new skeleton suspends to app-level boundary, replacing skeleton with "Loading...". Patched: wrapped both Footer renders in local `<Suspense fallback={null}>`.
- F5 low/maybe-false — widened effect deps `[load, photoId, location.state]` re-run pipeline on same-route state changes. Deferred: no code writes router state other than the two new Links; latent only.
- F6 low/false-positive-of-concern — cold skeleton is square while final media may be 16:9 (~300px residual reflow on desktop deep links). Accepted: plan note 4 sanctioned the unknown-aspect square fallback.

## Implementation Notes (post-build)

- Validation commands differ from plan draft (repo uses Vite+vitest, not CRA): lint `node_modules/.bin/eslint src/containers/*.js` → 0 errors (2 pre-existing exhaustive-deps warnings); `CI=true vitest run` → 19/19 pass; `vite build` succeeds.
- Added beyond plan: stale-response guard (`activePhotoIdRef`) so a slow fetch can't paint over a newer photoId; GA pageview dedupe; failure-keeps-content guard (review F2).

## Verification

**Commands:**
- `npm run lint` -- expected: no new ts-standard errors in touched files
- `CI=true npx react-scripts test src/utils/imageUtils.test.js` -- expected: existing suite still passes (no regressions)

**Manual checks (dev server, `npm start`):**
- Feed card click → detail page paints immediately with thumbnail at correct aspect ratio; only labels/comments fade in ~300ms later; no 300px square ever appears.
- Cold deep link (fresh tab to `/photos/<id>`) → skeleton shows a centered box of final size with Footer below; content fills the same slots with no chrome jump.
- prev/next after hover preload → instant switch, no skeleton flash.
