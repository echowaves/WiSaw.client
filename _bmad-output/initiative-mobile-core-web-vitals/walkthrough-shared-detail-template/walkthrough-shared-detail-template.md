# Review narrative: one detail template, painted by both sides

**Target:** branch `fix/detail-nav-shared-template` in both repos — WiSaw.client `43f4cf5..HEAD` (`74747f4`, `7d4bf72`, `292f323`, `036a3a8`) and WiSaw.cdk `1edaa794..HEAD` (`a07ee61`, `c88ed04`).
**Plan:** [plan-detail-nav-shared-template.md](../plan-detail-nav-shared-template.md) · **Review log:** [walkthrough-shared-detail-template-log.md](./walkthrough-shared-detail-template-log.md)

A block is reviewed only when you say so. Working on a block does not accept it.

---

## 1. Intent — ✅

> **Problem:** A `/photos/<id>` deep link is served the edge-painted page (`.wsk` frame: media box, `<h1>`, description, tag links, reserved slots) and React only enhances it. The first prev/next click hands off to `PhotosComponent`'s own JSX — the old glassmorphism card (`.PhotosComponent` + `.content-container` + `.crop`, px-sized media, label pills above the picture, no `<h1>`/description) — so one product has two detail templates, and the second one is the worse-looking one. The markup also exists twice in two repos, so any layout change must be made twice.
>
> **Approach:** Make the detail frame a single authored module that both sides render: Lambda@Edge keeps painting it into `#root`, and the SPA paints the *same* markup for every detail render that has no edge-painted frame (prev/next navigation, local dev, stale-edge cache) and portals its enhancements into its slots. The old client JSX detail template is deleted rather than restyled, so there is nothing left to drift.

Source: the `## Intent` section of the plan, pasted verbatim. Its Boundaries section adds three things worth holding in mind while reviewing: crawler-visible served bytes must stay byte-identical; the edge-painted media node is never mounted, cloned or detached by React (LCP/CLS); detail routes publish zero `<head>` tags.

## 2. Broad strokes — ✅

The change moves markup ownership to one module and makes the browser a second renderer of it, rather than an author of its own look. Read in this order:

- [skeleton.js](../../../../WiSaw.cdk/lambda-fns/lambdas/injectMetaTagsLambdaFunction/skeleton.js) — the only place the detail page's markup is written; both sides call `detailFrameHtml` (line 224).
- [detailTemplate.generated.js](../../../src/utils/detailTemplate.generated.js) — that same module rendered into a committed ES module the app can import.
- [detailSkeleton.js:50 captureDetailSkeleton / :239 paintClientDetailFrame](../../../src/utils/detailSkeleton.js) — the seam: adopt the edge's nodes, or paint identical ones, and hand both to the enhancement layer the same way.
- [PhotosComponent.js:99 detailFrameParts / :1273 render tail](../../../src/containers/PhotosComponent.js) — supplies inputs and paints; owns no markup of its own any more.
- [detailSeoText.js](../../../src/utils/detailSeoText.js) — reads the wording the edge reads, so a navigated page does not invent copy.

## 3. Slice: one authored template, published and pinned both ways — ✅

Mechanism: `skeleton.js` builds the frame as a string; the edge prepends nothing to it and appends only its structured-data graphs, while a Node script renders the same file into an ES module committed inside the client repo. Nothing is hand-copied, so drift is possible only if the generator is skipped — which both repos' tests fail loudly on.

- [skeleton.js:224 detailFrameHtml](../../../../WiSaw.cdk/lambda-fns/lambdas/injectMetaTagsLambdaFunction/skeleton.js) — heading, description, tag links, media element and slots in one string.
- [utils.js:295 buildSeoBody](../../../../WiSaw.cdk/lambda-fns/lambdas/injectMetaTagsLambdaFunction/utils.js) — the edge's body is now this call plus two JSON-LD graphs; its own copy of the markup was deleted (79 lines out).
- [scripts/publish-detail-template.js](../../../../WiSaw.cdk/scripts/publish-detail-template.js) — renders `module.exports` into the client file, and refuses if the module's shape changes.
- [tests/detail-template-copy-once.js](../../../../WiSaw.cdk/tests/detail-template-copy-once.js) — fails on a stale committed copy, on any second `<h1>`, and against stored golden bodies so served bytes cannot move silently.
- [detailGeometry.contract.test.js](../../../src/detailGeometry.contract.test.js) — the client-side mirror: the committed generated file equals what the generator would write today.

## 4. Slice: the seam's two producers, and never repainting an adopted frame — ✅

Mechanism: one store, two writers. Capture records the nodes Lambda@Edge already painted; client paint builds the same nodes from the same template. Both publish the identical `{kind, photoId, mediaNode, mediaBox, slots…}` record, so nav buttons, overlays, below-media content and the footer need no knowledge of which produced them. An adopted edge frame is never rebuilt — its media node carries the LCP paint — and same-photo updates refresh text in place instead of replacing media the visitor is already looking at.

- [detailSkeleton.js:50 captureDetailSkeleton](../../../src/utils/detailSkeleton.js) — stamps `source: 'edge'` at line 94.
- [detailSkeleton.js:114 collectFrameNodes](../../../src/utils/detailSkeleton.js) — one traversal shared by capture and paint, so the slots cannot diverge.
- [detailSkeleton.js:239 paintClientDetailFrame](../../../src/utils/detailSkeleton.js) — in-place text refresh when the frame already describes this photo; full repaint when it does not, including a record whose kind contradicts the URL.
- [detailSkeleton.js:191 refreshFrameText](../../../src/utils/detailSkeleton.js) — moves new nodes between the media box and the below slot without touching the media element.
- [PhotosComponent.js:598 the never-repaint guard](../../../src/containers/PhotosComponent.js) — keyed on `adopted && frame.source === 'edge'`, not on path, so a mismatched frame still gets replaced.

## 5. Slice: what the page component gave up, and what it kept — ✅

Mechanism: on a detail route the component renders nothing of its own once it has a record; the paint effect fills `#root` right after that commit. It keeps only the states a frame cannot represent — still-loading placeholder, settled not-found — plus the enhancements it portals into the frame's slots.

- [PhotosComponent.js:1273 render null for a painted record](../../../src/containers/PhotosComponent.js) — the ~146-line glass card is gone, along with its load/error handlers, label row and `computeDisplayDimensions`.
- [PhotosComponent.js:99 detailFrameParts](../../../src/containers/PhotosComponent.js) — media from the record, wording from the sidecar, thumbnail while full-res paint is still gated.
- [PhotosComponent.js:458 frame subscription and adopted gate](../../../src/containers/PhotosComponent.js) — reads the same store the app shell does.
- [detailLayout.js](../../../src/utils/detailLayout.js) — geometry re-exported from the generated template rather than kept twice.

## 6. Slice: wording parity, and the deploy it depends on — ✅

Mechanism: heading, description and tag row are published text, never client-side derivation. The app reads the same `img.wisaw.com/<id>.json` object Lambda@Edge reads, prefetches neighbours' copies alongside their media, and falls back to copy authored in the shared template when none is published yet.

- [detailSeoText.js:57 fetchSeoText](../../../src/utils/detailSeoText.js) — only an HTTP 404 counts as "no wording published"; a throttled or 5xx answer is asked again, mirroring the edge reader's rule.
- [skeleton.js:183 FALLBACK_DESCRIPTIONS](../../../../WiSaw.cdk/lambda-fns/lambdas/injectMetaTagsLambdaFunction/skeleton.js) — the sentence under the heading for a record with no sidecar, now read by `photo.js` and `video.js` as well.
- [cloud-front.ts:237 SidecarCorsPolicy / :269 the `*.json` behaviour](../../../../WiSaw.cdk/lib/resources/cloud-front.ts) — what lets a browser read that object at all; not deployed yet, so navigated pages currently show the fallback sentence.
- [PhotosComponent.js:614 document.title sync](../../../src/containers/PhotosComponent.js) — written only when the edge did not already author the title, keeping head mutations at zero on an adopted page.

## 7. Slice: who owns `#root` while navigating — ✅

Mechanism: the app shell treats any detail route with a live frame as adopted, so its opaque sheet never covers a painted page mid-navigation, and it stops clearing `#root` between detail routes; the page component is the one that clears a frame describing a different photo.

- [App.js:205 adopted = frame && isDetailPath](../../../src/App.js)
- [App.js:211 clear only off detail routes](../../../src/App.js)
- [PhotosComponent.js:579 clear a stale or not-found frame](../../../src/containers/PhotosComponent.js)

## 8. Slice: the tests that hold the claim — ✅

Mechanism: the promise is "a navigated page equals a served page", so it is pinned structurally — byte-for-byte against the template, and end-to-end through a real mount — rather than by asserting intent in prose.

- [detailSkeleton.paint.test.js](../../../src/utils/detailSkeleton.paint.test.js) — what the app paints equals `detailFrameHtml` for the same inputs; stylesheet inserted once.
- [PhotosComponent.cls.test.js](../../../src/containers/PhotosComponent.cls.test.js) — real route, painted frame, fallback sentence, alt text, placeholder metrics.
- [PhotosComponent.fullMedia.test.js](../../../src/containers/PhotosComponent.fullMedia.test.js) — the full-res swap happens on the same adopted node; nav anchors to `.wsk-main`.
- [detailSkeleton.seam.test.js](../../../src/containers/detailSkeleton.seam.test.js) — adoption declines a wrong-kind frame, and the repaint replaces it.

## 9. Periphery — ✅

- [plan-detail-nav-shared-template.md](../plan-detail-nav-shared-template.md) — intent, decisions, implementation notes and the build's review triage log.
- [PhotosComponent.css](../../../src/containers/PhotosComponent.css) — dead `.crop img` / `.mainImage` / `.thumbnailImage` rules removed; `.crop` kept as the loading box.
- [tests/fixtures/edge-detail-bodies.json](../../../../WiSaw.cdk/tests/fixtures/edge-detail-bodies.json) — golden served bodies behind the byte-identity pin.
