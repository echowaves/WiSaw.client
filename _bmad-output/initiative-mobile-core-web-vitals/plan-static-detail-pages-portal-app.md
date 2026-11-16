---
title: 'Adopt the edge-painted detail page as a React enhancement layer (portal app)'
type: 'refactor'
ticket: ''
created: '2026-11-13'
status: 'built'
baseline_revision: '1045b9b6dce8e3aae5d22dc15de6fccc908bb8c5'
route: 'oneshot'
route_source: 'pinned'
risk: 'high'
review: 'thorough'
review_source: 'pinned'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
lenses_note: 'executed sequentially on the main thread (single-model endpoint; no subagents) 2026-11-15'
review_loop_iteration: 0
context: ['.github/copilot-instructions.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Mobile detail pages score LCP 4.9–19.8 s / CLS up to 0.35 because React's first commit (`createRoot(#root).render`, index.js:26) unmounts the media node the edge already painted at FCP ~0.8 s, so LCP falls back to first-render JS/CSS delivery (~676 KB on throttled 4G ≈ 5 s), and layout re-arrangement on mount drives CLS. The video poster kill (3 MB full-res `.webp`) is fixed separately in the WiSaw.cdk solicitation (`backend-solicitation-brief.md`), which also turns `buildSeoBody` into a full static skeleton with marked enhancement slots.

**Approach:** React stops owning `#root`. `index.js` mounts the app into a sibling container; on detail routes where the edge skeleton is present, PhotosComponent renders only its enhancement layer — interactive overlays and below-fold content portaled into the skeleton's marked slots — and never touches the server-painted LCP media node. Media everywhere becomes a single `<img>` (video: thumb base + player) with full-res upgrade as an input-gated `src` swap on the same node. First prev/next navigation performs a one-time handoff to the fully React-rendered page. Detail routes declare no client-side head tags — the edge's served bytes are authoritative; the backend brief is amended so nothing SEO-visible is lost (full video OG block + BreadcrumbList JSON-LD in the skeleton).

**Decisions:**
1. Dual-container mount (sibling `#wisaw-app`, React never reconciles `#root`) — required: any detach of the painted node at commit time re-dates its LCP paint to JS-delivery time, which is the exact failure being fixed.
2. Full-res photo upgrade keeps the shipped gates from built plan `plan-defer-full-res-paint-mobile` (human decision 2026-11-13, keep-shipped): below 700 px the thumb stays until first interaction/resize past breakpoint; at ≥700 px full-res paints immediately. Full-res bytes still preload on the existing warm schedule so the swap is instant. The only change: single `<img>` `src` swap instead of a second overlay layer.
3. Detail-route Helmet removed entirely; `servedHead.js` and `edgeSeed.js` deleted; `mediaSeo.js` gutted to its duration functions (contract test kept). Backend brief amended in this plan's implementation (video OG block + BreadcrumbList in skeleton) — safe because deploy order is backend-first with CloudFront invalidation.
4. No skeleton found (old edge still cached, non-detail route) → clear `#root` at boot and render the full page normally in the new container: today's behavior, one honest check, no dual-format head tolerance.

</frozen-after-approval>

## Implementation Notes

Oneshot route: one architectural change across ~10 files; design captured here so implementation is unambiguous. Investigation (subagent report) verified: PhotosComponent never reads `window.__wisawLcp` directly (only via `edgeSeed.js`); the component instance is reused across detail→detail navigations (no `key`, stable tree position); `__wisawBooted` is set at index.js:12 before `createRoot`; Home/Search/About/Contact/Terms use `<RouteSeo>` from `staticSeo.generated.js` and are untouched.

**New — `src/utils/detailSkeleton.js`:** one-shot capture that runs in index.js BEFORE the first commit (skeleton nodes must still be live). Returns null unless pathname matches `/photos|videos/<uuid>`, the route id equals the skeleton's media id, and `[data-wisaw-media]` exists. Otherwise returns `{ kind, photoId, width, height, mediaSrc, videoSrc?, mediaNode, headerSlot, belowSlot, labelSlot? }` read from the DOM node attributes (this replaces `edgeSeed.js`'s plan-reading role — seed from the DOM, per architecture). No caching beyond module-level once: handoff clears it.

**`src/index.js`:** after the `__wisawBooted = true` line, `const skeleton = captureDetailSkeleton()`; create `<div id="wisaw-app">`, append to body, `createRoot(appDiv).render(...)` instead of `createRoot(#root)`. If no skeleton: clear `#root` children (it holds the shell's static h1/h2 fallback — same as today's replacement). Expose the capture via module import, not a global.

**`src/containers/PhotosComponent.js` (the bulk):**
- Seed init (L127-150) reads from the skeleton capture instead of `edgeSeededPhoto`; dimensions come from the captured node attributes with the existing `detailLayout` fallbacks.
- Adopted first render (skeleton present AND `photoId === skeleton.photoId`): render the enhancement layer only — label row, media-box overlays (play button, spinner, error), nav buttons, comments/actions, footer — each via `createPortal` into its slot node; the LCP `<img>`/`<video>` node is never rendered or touched by React. Video: attach refs/handlers to the adopted `<video>` node in an effect (it already carries `src`, thumb `poster`, `preload="none"`, native `controls` — keep them; the big ▶ overlay stays for parity).
- No skeleton OR handoff done (`photoId !== skeleton.photoId`, first nav): one-time cleanup removes `#root`'s frame content, then render the full page normally in `#wisaw-app` as today.
- Media render: single `<img>` (src = thumb below 700 px / full above, per existing `detailLayout` rules); upgrade = `src` swap to full after first input (reuse `mediaUpgrade.hasFirstInputHappened`, drop the paint-gate/overlay machinery at L157-158, L216-247, L315-328 and the two-layer JSX at L1254-1346). Video branch keeps base thumb img + player fade (no overlay layer exists there today).
- Helmet block (L1040-1093) deleted; `servedHeadFor`/`mediaHead`/`mediaGraphOf`/`breadcrumbGraph` inputs with it. GA pageview effect, cache/inflight refs, query layer (L365-585) unchanged.

**Deletions:** `src/utils/edgeSeed.js` + its test; `src/utils/servedHead.js` + its test; `src/utils/mediaSeo.js` reduced to `durationSeconds`/`iso8601Duration` (+ keep `videoDuration.contract.test.js`, update `mediaSeo.test.js` to duration-only).

**Tests:** new seam contract test — mount over a simulated skeleton: media node identity survives the first commit (same DOM node, not a clone), slots receive portal content, zero `<head>` mutations by the app; rewrite `PhotosComponent.fullMedia.test.js` for single-img input-gated upgrade; update `PhotosComponent.cls.test.js` + `detailSlotStyles.contract.test.js` to skeleton geometry; `lcpBootstrap.template.test.js` and `seo.template.test.js` untouched (inline scripts unchanged).

**Backend brief amendment** (`_bmad-output/.../backend-solicitation-brief.md`, committed with this work): C2 gains (a) full video OG block — `og:video:url`, `og:video:secure_url`, `og:video:type`, `og:video:width/height` from sidecar dims, `og:video:image` = thumb — and (b) a BreadcrumbList JSON-LD graph; both are what the client's Helmet publishes today and must survive head removal.

**Known tradeoff:** on old-edge detail pages during transition (pre-backend-deploy), the fallback full-React render has no client head, losing only BreadcrumbList + extra `og:video:*` tags — the edge already injects title/OG/canonical there; deploy order + invalidation bounds the window.

**Simplification pass (2026-11-15, resumed run):** the half-applied tree was functionally complete and green (188 tests) but had grown duplicated JSX between the adopted and full-render paths. Extracted two shared components in `PhotosComponent.js` — `VideoOverlays` (play button / spinner / error alert, identical markup in both paths) and `BelowMediaContent` (comments slot + recognitions + spacer) — cutting ~150 lines of copy-paste. Removed the debug probe file (`__probe.appempty.test.js`). Found and fixed a real edge case the duplication had masked: a video id requested under `/photos/` is served an `<img>` by the edge, but the hydrated record claims `video: true`; the old adopted check would attach player state to an image (and crash on play). The adoption condition now also requires the skeleton's kind to agree with the record's `video` flag, and the handoff effect clears the skeleton whenever the page stops adopting it (route change OR kind mismatch), not only on route change. Because that clear is a module mutation React cannot see, `detailSkeleton.js` gained a one-shot `subscribeDetailSkeleton` and both consumers (`AppShell`, `PhotosComponent`) read the capture through `useSyncExternalStore` so a handoff re-renders them out of portal mode. The capture is also now strict about both slots being present (a skeleton missing either renders fully client-side instead of half-enhancing). Added a seam regression test for the kind-mismatch handoff.

## Plan Change Log

## Review Triage Log

Lenses run on the main thread, sequentially (single-model endpoint — subagents unavailable; recorded in `.github/copilot-instructions.md` Execution Constraints).

- **high** `src/App.js` + `src/App.css` — adopted mode left `<div className='App'>` (opaque `background: var(--bg)`, `min-height: 100vh`) in `#wisaw-app`, which follows `#root` in DOM order and painted over the edge page; verified no CSS anywhere referenced `wisaw-app`. Patched: wrapper moved into `AppShell`, gains `App--adopted` (transparent, zero min-height); pinned by new seam test asserting the modifier class, empty wrapper, and absence of the Loading fallback.
- **high** AppShell Suspense — 100vh "Loading..." overlay covered painted content during lazy-chunk load; no DOM-identity test could see it. Patched: `fallback={null}` while adopted; pinned by the same seam test.
- **medium** `index.html` swap script — dims/`videoSrc` capture loop fed the deleted `edgeSeed.js`; nothing reads those plan fields (repo search for `__wisawLcp`: only `lcpBootstrap.template.test.js`), and the template test pinned the dead output. Patched: capture block removed, dead describe block deleted; preload + thumb-swap (live paths) untouched.
- **medium** `src/index.js` — unguarded `rootElement.innerHTML = ''` when no skeleton would throw before `createRoot` on a page missing `#root`. Patched with existence guard.
- **medium** adopted-video path untested; video overlays duplicated between render paths (drift risk). Patched: shared `VideoOverlays`/`BelowMediaContent` components + new seam test driving an `error` event through the adopted node's listeners to the overlay.
- **low-medium** capture accepted a media node with no positioned wrapper (`mediaBox === #root`), which would anchor absolute overlays to the page. Patched: strictness check added.
- **false** (edge-case lens) "argument mismatch on `skeletonSeededPhoto(photoId, routeKind)`" — callee signature is `(photoId, kind)`; both call sites match.
- **maybe-false → deferred** stale `document.title` after client-side prev/next (Helmet gone): real by inspection, fix belongs in the edge skeleton script → `deferred-work.md`.
- **low → rejected** handoff-clear exists in both AppShell and PhotosComponent: AppShell cannot observe the kind-mismatch condition; consolidation would add indirection for no safety gain. Documented in code comments instead.
- **low → deferred** `MEDIA_ORIGIN` third copy of object naming → `deferred-work.md`.
- **rejected (by design)** silent non-UUID rejection in capture — "one honest check, no dual-format tolerance" is frozen Intent decision 4.
- **rejected (contract-pinned)** dropping unused `duration` from the three detail queries: `videoDuration.contract.test.js` pins the selection per frozen Intent decision 3; payload bytes are negligible.
- **claim inaccurate** plan Verification cited "update `detailSlotStyles.contract.test.js` to skeleton geometry" — the file passes unmodified (its assertions still hold); corrected below.

## Verification

**Commands (run 2026-11-15, all green):**
- `npm test` — 15 files / 184 tests passed, incl. `detailSkeleton.seam.test.js` (media-node identity across first commit; slot portals; zero `<head>` mutations; adopted-wrapper paint guard; adopted-video error path; kind-mismatch handoff; no-skeleton fallback) and `videoDuration.contract.test.js`
- `npm run build` — succeeds; postbuild `seo.template.test.js` (12 tests) passes against the edited template
- `npx eslint` on every changed file — clean (repo-wide pre-existing warnings in untouched files unchanged)
- `grep -rn "edgeSeed\|servedHead" src/` — no matches
- Note: the plan draft also listed updating `detailSlotStyles.contract.test.js`; it passes unmodified — its assertions hold against skeleton geometry, so no update was needed.
- Manual (dev server + local skeleton fixture): cold-load a `/photos/<id>` with skeleton present — LCP element is the pre-painted node (DevTools Performance: no re-paint of it at React commit); prev/next nav hands off to full React page once; non-detail routes render identically to today. **Still pending** — requires a served fixture; adoption cannot fire against production until the backend skeleton ships (edge currently serves the old bare format, so prod boots take the fallback path).
