---
title: 'Detail prev/next must render the edge page template, from one shared template file'
type: 'bugfix'
ticket: ''
created: '2026-11-16'
status: 'built'
baseline_revision: '43f4cf50288eefed0dd0664a62502b1466772e72' # WiSaw.client main; WiSaw.cdk main was 1edaa794163a82567de31f160da48bd642018ead
route: 'full'
route_source: 'auto'
risk: 'high'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context: ['.github/copilot-instructions.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A `/photos/<id>` deep link is served the edge-painted page (`.wsk` frame: media box, `<h1>`, description, tag links, reserved slots) and React only enhances it. The first prev/next click hands off to `PhotosComponent`'s own JSX — the old glassmorphism card (`.PhotosComponent` + `.content-container` + `.crop`, px-sized media, label pills above the picture, no `<h1>`/description) — so one product has two detail templates, and the second one is the worse-looking one. The markup also exists twice in two repos, so any layout change must be made twice.

**Approach:** Make the detail frame a single authored module that both sides render: Lambda@Edge keeps painting it into `#root`, and the SPA paints the *same* markup for every detail render that has no edge-painted frame (prev/next navigation, local dev, stale-edge cache) and portals its enhancements into its slots. The old client JSX detail template is deleted rather than restyled, so there is nothing left to drift.

## Boundaries & Constraints

**Always:**
- One template source file; the other side consumes it through a committed generated copy plus a byte-for-byte drift test (the `publish-static-seo.js` / `static-route-copy-once.js` pattern).
- Crawler-visible bytes served by the edge stay byte-identical: same classes, attributes, order and geometry. Only selector scoping may change, and only so the same rules also apply inside `#wisaw-app`.
- Adoption stays strict and untouched in its purpose: the edge-painted media node is never mounted, cloned or detached by React (LCP/CLS guarantee from plan `plan-static-detail-pages-portal-app`).
- Detail routes keep publishing zero `<head>` tags.
- Nav buttons anchor to `.wsk-main` in every path; comments/recognitions/footer portal into the below slot in every path.

**Decisions (settled with the human 2026-11-16):**
1. `WiSaw.cdk …/skeleton.js` is the single authored template; a new `scripts/publish-detail-template.js` emits the committed ESM copy `WiSaw.client/src/utils/detailTemplate.generated.js`, and `WiSaw.client/src/utils/detailLayout.js` re-exports geometry from it.
2. Nav-time heading/description/tag wording comes from the published sidecar `https://img.wisaw.com/<id>.json` — the same object the edge reads — fetched once per id, cached and prefetched with the neighbouring-page warmers. Enabling it is a CORS response-headers policy for `*.json` on the `img.wisaw.com` distribution (`WiSaw.cdk/lib/resources/cloud-front.ts`). No SEO text is authored or re-derived in the browser app.
3. `document.title` is written from that same sidecar title on detail navigation (closes deferred item C4). No other head tags are added, and no `<Helmet>` returns.
4. The plan stays one plan (~2,000 tokens); the human accepted the context-rot risk rather than splitting the wording piece off.

**Never:**
- No redesign of the frame, no new SEO wording authored in the browser app, no re-introduction of detail-route `<Helmet>`.
- No changes to Home/Search/static-route rendering, to `#root`'s boot markup or the inline scripts in `index.html`, or to `seo.template.test.js` / `lcpBootstrap.template.test.js` contracts.
- No second copy of the media-object naming rule, and no re-derivation of stored SEO text that the edge already publishes.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Direct deep link, edge frame present | `/photos/<uuid>` cold load | Unchanged: capture + portals, painted media node identical after commit | Malformed/foreign skeleton → declined, client paints the frame itself |
| Click next, record cached | prev/next navigation | Client-painted frame with the same classes/geometry as a direct load of that id; enhancements portalled | None expected |
| SEO text unavailable | sidecar fetch fails/CORS absent | Frame still paints: media + `wisaw photo <id>` heading, description omitted — matches what the edge serves for a record with no sidecar | Log once per id, no retry storm |
| Record without dimensions | width/height absent or 0 | Box uses shared `mediaBoxStyle` fallback (1/1 at the 300 px cap) | n/a |
| Kind contradiction | video record under `/photos/` | Existing contradiction handling preserved: no `<video>` painted into a photo frame, host cleared | Falls back to existing NoMatch path |
| Cold boot with no edge frame | local dev / stale edge | Same frame painted from GraphQL data — the card design is gone everywhere | n/a |

</frozen-after-approval>

## Code Map

- `WiSaw.cdk/lambda-fns/lambdas/injectMetaTagsLambdaFunction/skeleton.js` — today's edge frame template: `SKELETON_STYLE` (scoped `#root .wsk…`), `mediaBoxStyle`, `positiveInt`, `slot`, `renderSkeleton`, `MEDIA_ONERROR`. Becomes the single authored template; gains the media-element markup now in `utils.js:mediaElement` and owns `escapeHtmlAttribute` (utils.js already requires this file, 29 call sites keep working through one import).
- `…/injectMetaTagsLambdaFunction/utils.js` — `mediaElement` (301-327), `buildSeoBody` (333-412) assemble the served body; must emit byte-identical bytes after the move.
- `WiSaw.cdk/scripts/publish-static-seo.js` + `tests/static-route-copy-once.js` — the publish/drift-test pattern to copy for the template module.
- `WiSaw.client/src/utils/detailSkeleton.js` — edge capture, one-shot store (`subscribe/getDetailSkeleton`), `skeletonSeededPhoto`, `clearDetailSkeleton`, `skeletonMatchesPath`. Gains the client-paint producer so one module owns "the active detail frame host".
- `WiSaw.client/src/containers/PhotosComponent.js` — adopted path 1219-1243 (portals) vs. old JSX template 1245-1338 to delete; cold-load placeholder 1405-1441 and spinner tail 1443-1458 to restyle into the frame; `renderNavigationButtons` 1142-1204, `VideoOverlays`, `BelowMediaContent` stay as portalled content.
- `WiSaw.client/src/App.js:196-253` — `AppShell`'s `adopted` gate (Header portal, `display:contents` sticky travel, `App--adopted`, null Suspense fallback) generalises to "frame active", whichever side painted it.
- `WiSaw.client/src/utils/detailLayout.js` — geometry mirrored by the edge; re-export from the shared module so 700/40/72/64/220 live once.
- Tests to extend, not delete: `src/containers/detailSkeleton.seam.test.js` (18 cases), `PhotosComponent.cls.test.js`, `PhotosComponent.fullMedia.test.js`, `detailSlotStyles.contract.test.js`.
- Do not change: `index.html`, `src/index.js` boot order, `seo.template.test.js`, `lcpBootstrap.template.test.js`, Home/Search/static routes.

## Tasks & Acceptance

**Execution:**
- [ ] `WiSaw.cdk/…/skeleton.js` + `utils.js` -- fold the media element and escaper into the template module; scope its style block so it also applies outside `#root` -- one template, same served bytes.
- [ ] `WiSaw.cdk/scripts/publish-detail-template.js` (new) -- emit the client ESM copy `WiSaw.client/src/utils/detailTemplate.generated.js`; wire into `tests/edge-detail-skeleton.js` a byte-for-byte staleness check and a golden-body assertion that today's crawler bytes are unchanged.
- [ ] `WiSaw.client/src/utils/detailTemplate.generated.js` -- generated; consumed by the client for markup, geometry and slot names.
- [ ] `WiSaw.client/src/utils/detailSkeleton.js` -- add the client-paint producer (paint frame into a React-owned host, resolve slots + nav anchor, publish through the existing store); keep capture strictness and handoff semantics.
- [ ] `WiSaw.client/src/containers/PhotosComponent.js` -- paint the frame whenever no edge frame describes the route; single enhancement path for both; delete the card template; frame-shaped loading state.
- [ ] `WiSaw.client/src/App.js` + `src/utils/detailLayout.js` -- generalise `adopted` to any active frame; re-export geometry.
- [ ] tests above -- pin: client-painted DOM equals a captured edge frame for the same record (classes, slot order, box style); nav anchor stable across handoff; zero `<head>` mutations still hold; matrix rows covered.
- [ ] `WiSaw.client/src/utils/detailSeoText.js` (new) -- fetch + cache the `<id>.json` sidecar, prefetch it with the existing neighbour warmers, feed `title`/`description`/labels into the frame, and write `document.title` on detail navigation; fall back to `wisaw <kind> <id>` with no description when it cannot be read.
- [ ] `WiSaw.cdk/lib/resources/cloud-front.ts` -- CORS response-headers policy for `*.json` on the `img.wisaw.com` distribution so the browser can read the sidecar the edge already reads.

**Acceptance Criteria:**
- Given a `/photos/<id>` page reached by clicking next, when the frame is compared with the same id loaded directly, then both render the same template markup from the same module (same classes, slot order, box geometry rule).
- Given any detail route render in the app, when React has finished committing, then no `.content-container`/`.crop` detail card exists anywhere on `/photos/*` or `/videos/*`, while Home and Search are unchanged.
- Given a detail page whose edge frame was adopted, when the first prev/next click happens, then the media element is replaced by the client-painted equivalent without any layout shift below it (CLS stays 0 in the CLS test) and the nav buttons do not move.
- Given the edge template file is edited without re-running the publish script, when either repo's tests run, then they fail naming the stale copy.
- Given the Lambda@Edge body for a fixture record, when compared with the pre-change production bytes, then it is identical.
- Given a detail page reached by navigation, when its sidecar has been read, then the tab title matches the `<h1>` the same page shows on a direct load.

## Implementation Notes

- **Commits.** `WiSaw.cdk` branch `fix/detail-nav-shared-template`: `a07ee61` (single authored template, publisher, CORS for `img.wisaw.com/*.json`, drift + golden-body tests), `c88ed04` (fallback description moved into the shared template). `WiSaw.client` same branch: `74747f4` (client paint of the shared template, card deleted, sidecar wording reader), `7d4bf72` (fallback description + read-again policy). No pushes; both branch off the recorded baselines.
- **One source, two producers.** `WiSaw.cdk/lambda-fns/lambdas/injectMetaTagsLambdaFunction/skeleton.js` is the only authored markup. `scripts/publish-detail-template.js` renders it into `src/utils/detailTemplate.generated.js`; `src/utils/detailSkeleton.js` paints that string into `#root` for any detail render the edge did not paint, and its enhancement slots are identical to the captured ones, so nav buttons, overlays, below-media content and footer behave the same on both paths. Drift is pinned on both sides (`WiSaw.cdk/tests/detail-template-copy-once.js`, `src/detailGeometry.contract.test.js`).
- **Wording.** Headings/descriptions/tag rows come from the published sidecar `https://img.wisaw.com/<id>.json` (`src/utils/detailSeoText.js`), the same file Lambda@Edge reads; neighbours are prefetched with their media. Only an HTTP 404 is cached as "no published wording" — matching `sidecar.js`, which refuses to cache a throttled or server-side answer.
- **Known divergences, both data-availability rather than template:**
  - Media geometry: the edge reads width/height off the sidecar, this app off the GraphQL record. For a record whose sidecar does not exist yet, a direct load reserves the unknown-dimension cap while a navigated page uses the true ratio. The client has the better datum; degrading it to match would be worse for every visitor who can see the layout.
  - Until `WiSaw.cdk` is deployed with the `*.json` CORS behaviour, a navigated page reads no sidecar and shows the edge's own fallback heading plus `FALLBACK_DESCRIPTIONS` copy — same template, less copy. Nothing here needs a coordinated release.
- **Test results.** Client `npx vitest run`: 187 passing. Client `npm run lint`: unchanged pre-existing findings only (`src/setupTests.js` indent errors; warnings in `About/Contact/Home/NoMatch/SearchComponent/Terms`). `npm run build && postbuild`: green, `seo.template.test.js` 12 passing. CDK `npm test`: 424 passing, 6 failing — the same 6 at baseline (bucket-env `edge-detail-truthfulness.js` and 5 timezone-dependent `season-key.js` cases), confirmed against a clean worktree of `1edaa794`.
- Implementation and every review lens run sequentially on this thread: `.github/copilot-instructions.md` Execution Constraints forbid subagent launches against the single-concurrency model endpoint (same handling as plan `plan-static-detail-pages-portal-app`).

## Plan Change Log

## Review Triage Log

Lenses ran inline (no subagents — repo execution constraint). Verdicts rendered by this session against the code at the cited location; every finding from every lens has a row.

| # | Finding (lens) | Location | Verdict | Evidence / action |
|---|---|---|---|---|
| 1 | Navigated page paints no description where the served page shows the fallback sentence (blind-hunter, edge-case claims) | `PhotosComponent.js` `detailFrameParts` | medium | `photo.js:54`/`video.js:59` used `seo.metaDescription \|\| FALLBACK_DESCRIPTION`, and `descriptionMarkup('')` emits an empty `<p>` — a fresh photo showed nothing under the heading after prev/next. Fixed: `FALLBACK_DESCRIPTIONS` authored in `skeleton.js`, read by both handlers (`c88ed04`) and by the client paint (`7d4bf72`), pinned by a new cls test. |
| 2 | Sidecar read caches `null` on any failure, so prev→next→prev keeps a page without its wording (blind-hunter, verification-gap) | `detailSeoText.js` `fetchSeoText` | medium | `sidecar.js:62-74` deliberately caches only NoSuchKey/NotFound for exactly this reason. Fixed: only an HTTP 404 or a readable body counts as answered; tests pin 404-cached, 503-retried, network-retried. |
| 3 | Dead exports left behind by the card deletion (`COLD_BELOW_MEDIA_RESERVE`, `PLACEHOLDER_LABEL_COUNT`, `getPlaceholderDimensions`) (blind-hunter) | `detailLayout.js` | false | My grep was truncated by `head`; the loading placeholder still uses all three (`PhotosComponent.js` placeholder + `RecognitionLabelsSkeleton`). Nothing dead. |
| 4 | Stylesheet inserted twice per paint (`withStyle: true` plus `ensureFrameStyle`) (blind-hunter) | `detailSkeleton.js` | false | Both client-paint paths already pass `withStyle: false`; the single `<style id="wisaw-frame-style">` lives in `<head>` and is asserted to stay singular. |
| 5 | Client does not re-run `normaliseLabels` on sidecar labels (blind-hunter) | `detailSeoText.js` `parseSidecar` | low — rejected | The writer stores `pickLabels([photo])`, already deduped and capped at 8, and `labelLinksMarkup` slices to `FRAME_LABEL_LIMIT` itself. Closing the legacy-object case would mean copying `LABEL_LIMIT` into the client. |
| 6 | Media geometry from the record vs the sidecar (blind-hunter) | `detailFrameParts` | low — rejected | Real only for a record with no published sidecar, where the edge is the degraded party. Fix = ignore known dimensions on the client; worse for every visitor who can see it. Recorded as a known divergence above. |
| 7 | Deleted card's `onerror` placeholder swap is gone (edge-case deletion check) | `PhotosComponent.js` (removed) | low — rejected | The shared template carries no `onerror`, so the served page never had one; parity is the intent, and re-adding a client-only handler reintroduces the divergence. |
| 8 | `document.title` write can contradict an edge-authored title (blind-hunter) | `PhotosComponent.js` title effect | false | The effect returns early when the adopted frame's source is `edge`; on client-painted frames there is no served title to contradict. |
| 9 | Blank page if `paintClientDetailFrame` finds no `#root` (blind-hunter, edge-case) | `PhotosComponent.js` render tail | low — rejected | `index.html` ships `<div id="root">` and `AppShell` mounts there; reaching it needs a shell with no mount point. |
| 10 | `refreshFrameText` could write into detached slots (edge-case) | `detailSkeleton.js` | false | The slots live inside the painted `#root` subtree, which React never renders into on this route (component returns `null` and portals only). |
| 11 | Neighbour prefetch re-runs whenever wording arrives (blind-hunter) | `PhotosComponent.js` | false | Prefetch is its own effect keyed on `[nextPhoto, prevPhoto]`. |
| 12 | Stale frame for a route whose record is still in flight (edge-case) | `PhotosComponent.js` paint effect | false | Handled by the `!skeletonMatchesPath(frame, location.pathname)` clear branch, covered by a cls test. |
| 13 | Wrong-kind adoption (video under `/photos/`) left half-enhanced (edge-case) | `detailSkeleton.js` / paint effect | false | Guard is on `frame.source === 'edge'` plus id/kind equality, so a kind mismatch falls through and is replaced by a correct client frame; pinned in `detailSkeleton.seam.test.js`. |
| 14 | No test would fail if the description fallback regressed (verification-gap) | cls test | medium → patch | Added `says the served page's fallback sentence while no wording is published`, asserting `.wsk-main > p` equals `FALLBACK_DESCRIPTIONS.photo` with fetch stubbed to 404. |
| 15 | No test pinned the retry-vs-cache policy (verification-gap) | `detailSeoText.test.js` | medium → patch | Three assertions added: 404 cached once, 503 asked again, rejected network call asked again. |
| 16 | Cross-repo byte-drift pin silently skips when `../WiSaw.cdk` is not checked out (verification-gap) | `detailGeometry.contract.test.js:33` | low — rejected | The invariant is pinned authoritatively in the CDK suite, which reads the committed client copy (`TARGET`) and fails there on any drift; making the client test hard-fail would break `npm test` for a client-only checkout. |
| 17 | Intent alignment (descriptive) | — | n/a | Readings: (a) one look for direct load and navigation — implemented at markup level, pinned by byte-equality against `detailFrameHtml`; (b) one authored file — implemented via `skeleton.js` + publisher + drift pins both sides. Residual divergence is data availability (#6, sidecar wording), not template or surface: the intent's expectations live in the DOM, and the tests that exercise them run the real DOM. |

## Verification

**Commands:**
- `npm test` (WiSaw.client) -- expected: all suites green incl. seam/CLS/fullMedia/contract tests.
- `npm run lint` (WiSaw.client) -- expected: no new errors in touched files.
- `npm run build` (WiSaw.client) -- expected: postbuild `seo.template.test.js` passes (template contract untouched).
- `cd ../WiSaw.cdk && npm test` -- expected: mocha suites green incl. `edge-detail-skeleton.js`, new drift + golden-body checks.

**Manual checks:**
- Dev server: open `/photos/<id>`, click next/prev — the page keeps the edge look; compare with a hard reload of the same id (same classes and geometry in DevTools).
- `curl -s https://wisaw.com/photos/<id>` before/after deploy: body bytes for the frame unchanged.

- Open Questions resolved 2026-11-16 (all three answers are now Intent decisions 1–3 above); the section was deleted rather than left answered.
