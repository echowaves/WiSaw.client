---
title: 'Detail prev/next must render the edge page template, from one shared template file'
type: 'bugfix'
ticket: ''
created: '2026-11-16'
status: 'in-progress'
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

## Plan Change Log

## Review Triage Log

## Verification

**Commands:**
- `npm test` (WiSaw.client) -- expected: all suites green incl. seam/CLS/fullMedia/contract tests.
- `npm run lint` (WiSaw.client) -- expected: no new errors in touched files.
- `npm run build` (WiSaw.client) -- expected: postbuild `seo.template.test.js` passes (template contract untouched).
- `cd ../WiSaw.cdk && npm test` -- expected: mocha suites green incl. `edge-detail-skeleton.js`, new drift + golden-body checks.

**Manual checks:**
- Dev server: open `/photos/<id>`, click next/prev — the page keeps the edge look; compare with a hard reload of the same id (same classes and geometry in DevTools).
- `curl -s https://wisaw.com/photos/<id>` before/after deploy: body bytes for the frame unchanged.

## Implementation Notes

- Open Questions resolved 2026-11-16 (all three answers are now Intent decisions 1–3 above); the section was deleted rather than left answered.
- Implementation and every review lens run sequentially on this thread: `.github/copilot-instructions.md` Execution Constraints forbid subagent launches against the single-concurrency model endpoint (same handling as plan `plan-static-detail-pages-portal-app`).
- Branches: a matching feature branch in each repo, committed locally, no push.
- Deploy-order dependency: the client's sidecar wording degrades to the edge's own `wisaw <kind> <id>` fallback until `WiSaw.cdk` is deployed with the CORS policy, so nothing here requires a coordinated release; the frame itself does not depend on it.
