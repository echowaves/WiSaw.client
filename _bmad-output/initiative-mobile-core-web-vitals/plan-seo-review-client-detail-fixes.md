---
title: 'Adopted detail page: fix the regressions the edge-skeleton review surfaced (client)'
type: 'bugfix'
ticket: ''
created: '2026-11-15'
status: 'in-progress'
baseline_revision: '0884af3269cc5b1728d5fa62d70fa9594975b01c'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context:
  - '`_bmad-output/initiative-mobile-core-web-vitals/deferred-work.md`'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A four-lens review of the edge-skeleton change (`refactor/static-detail-pages`, now in `main`) found that the SPA adoption path regressed on the very pages it exists to protect: when Lambda@Edge serves a cached build that publishes no `data-wisaw-src`/`data-wisaw-thumb`, the client clears `#root` on its first commit and destroys the painted LCP node; the sticky header loses all travel once portalled into the edge's 72 px slot; a failed full-resolution swap leaves `.wsk-box--broken` (which hides the media) forever; native `<video>` controls bypass React state, leaving the play overlay over a playing video; and a failed image in the client-rendered path shows a broken icon instead of the thumbnail.

**Approach:** Adopt only on evidence, never on absence — hand `#root` back only when the loaded record positively contradicts the skeleton, not while it is still loading. Keep every adopted-node side effect (class cleanup, play/pause sync, inline attributes) attached in the same effect that attaches its handlers, and give the client-rendered image an actual fallback rather than a comment claiming one.

## Boundaries & Constraints

**Always:**
- `#root`'s server-painted media node is never mounted, cloned or replaced by React while adopted; every fix works on the existing node.
- The object-naming rule stays out of this repo: read published attributes, never derive `<id>.webp`.
- A handoff to the fully client-rendered page must stay reachable and idempotent for every mismatch (wrong id, wrong kind, no capture).
- New guards are proven by tests that fail without the fix.

**Never:**
- No changes in `WiSaw.cdk` — backend skeleton/sidecar findings are recorded as G2/G3 in `deferred-work.md`.
- No re-introduction of detail-route `<Helmet>` or any client-side head ownership (that is blocked brief §9 C4).
- Do not touch the two `index.html` inline LCP scripts' URL derivation — they run before any published attribute exists.
- No TypeScript, no new state libraries, no CSS-in-JS.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Old edge, no published URLs | skeleton captured, `data-wisaw-*` absent, record still in flight | keep adopting; no `#root` clear until the record arrives | if the record never arrives, stay on the static page (no crash, no clear) |
| Record contradicts skeleton | loaded record's id or kind differs from the captured node | hand `#root` back once, render the full client page | existing path, unchanged |
| Full-res swap fails on adopted `<img>` | `src` rewritten to `photo.imgUrl`, object 404s | revert the node to `photo.thumbUrl`, remove `wsk-box--broken`, media stays visible | one-shot listener; a second failure leaves the thumb |
| Native play/pause on adopted `<video>` | visitor uses the edge node's own controls | React state follows (`showVideoPlayer` true/false); overlay hides when playing | existing error path still sets the unavailable message |
| Client-rendered image errors | full-res or thumb fails to load | fall back to the thumbnail; never leave a broken icon at opacity 1 | if the thumb also fails, keep the current no-crash behaviour |

## Resolved Decisions

- **Sticky header:** client-only — set `display:contents` on the captured header slot while adopted, so the portalled header's containing block is the tall `.wsk` and it keeps its travel. No backend solicitation for this; if the ~1 px reserve delta ever measures as real CLS, that becomes a G2 item, not a revert of the rest of this plan.
- **`playsinline`:** set it defensively on the adopted `<video>` node in the existing handler effect, so iOS playback matches the client-rendered path today; G2 may later make the edge markup the single writer.
- **Critical CSS:** keep `#root > h1|p|nav|img` as they are and rewrite their comment to state what they still guard (static routes and any cached pre-skeleton flat body). Do not extend them to the nested skeleton and do not delete them.

</frozen-after-approval>

## Code Map

- `src/containers/PhotosComponent.js` — adoption gate `adopted` (:416-423); adopted `<video>` handler effect (:426-448) is where play/pause sync and `playsinline` belong; full-res swap effect (:456-466) is where the broken-class revert belongs; handoff effect (:473-481) holds the premature-clear bug; `handleImageError` (:502-507) is the client-rendered fallback that currently does nothing; single `<img>` at :1304-1335.
- `src/utils/detailSkeleton.js` — `captureDetailSkeleton` guards (:60-115), `skeletonSeededPhoto` returns null with no published URLs by design (:172-200), `clearDetailSkeleton` (:206-213). Do not loosen capture; the fix is in who calls clear.
- `src/App.js` — `AppShell` portal into `skeleton.headerSlot` (:219-227) and its own route-change clear (:204-208). Header sticky travel is decided here.
- `index.html` — critical CSS `#root > h1|p|nav|img` (:39-52); the two inline LCP scripts (:155-186) stay untouched.
- `src/containers/detailSkeleton.seam.test.js` — integration harness (`buildSkeletonDom`, `bootWithSkeleton`, `flush`) plus existing cases at :133-430 and seed cases at :432-480; new integration pins go here.
- `src/containers/PhotosComponent.fullMedia.test.js` — client-rendered image/gate cases (:87-330); the thumbnail-fallback pin belongs here.
- `WiSaw.cdk .../skeleton.js:43,51` — read-only fact: `.wsk-box--broken .wsk-media{visibility:hidden}` and `MEDIA_ONERROR` add that class to the media **box** (parentNode).

## Tasks & Acceptance

**Execution:**
- [ ] `src/containers/PhotosComponent.js` — gate the handoff on a contradicted record rather than on `!adopted`; sync `showVideoPlayer` from the adopted node's `play`/`pause` events and set `playsinline`; on a failed full-res swap revert to the thumbnail and drop `wsk-box--broken`; make `handleImageError` actually revert to the thumbnail.
- [ ] `src/App.js` — give the portalled Header its sticky travel back, per the resolved Open Question #1.
- [ ] `index.html` — restate in the critical-CSS comment what those rules now guard (static routes and legacy flat bodies, not the nested skeleton), so nobody deletes the static-route safety net or expects it to cover detail pages.
- [ ] `src/containers/detailSkeleton.seam.test.js` — add integration pins: no-seed boot keeps the painted node through first commit; failed swap restores thumb + removes the broken class; native play/pause flips the overlay; capture declines (id mismatch, non-numeric size, src-less `<video>`, missing below slot) still render the full client page.
- [ ] `src/containers/PhotosComponent.fullMedia.test.js` — pin that an image load error falls back to the thumbnail instead of a broken icon.

**Acceptance Criteria:**
- Given an edge build that publishes no media URLs, when the SPA boots on `/photos/<id>`, then the server-painted `<img>` node is still in `#root` after the first commit and is only replaced once the record contradicts it.
- Given an adopted photo whose full-resolution object fails, when the swap errors, then the visible media is the thumbnail and `.wsk-box--broken` is absent from the media box.
- Given an adopted video, when its native controls start playback, then the React play overlay is gone without any React-initiated `load()`.
- Given an adopted detail page at desktop width, when the visitor scrolls, then the header stays pinned.
- `npm test` and `npm run lint` pass with the new pins failing on the pre-fix tree.

## Implementation Notes

- **Handoff gate** (`PhotosComponent.js`): clear now requires `!onSkeletonPage || (recordKnown && !adopted)`, with `recordKnown` = the loaded record carries an id. The kind-mismatch handoff still fires because it is exactly the `recordKnown && !adopted` case; the dep array gained `internalState.currPhoto` so the gate re-evaluates when the record lands.
- **Full-res swap failure** (`PhotosComponent.js`): implemented as a capture-phase listener on the media box rather than a one-shot listener on the node. Two reasons found while testing: an error event does not bubble (capture still reaches an ancestor), and the edge's inline `onerror` is registered at parse time, so a target-phase listener added later runs *after* it — which left `.wsk-box--broken` applied. Capturing on the box runs first, so the client reverts the node to the thumb and `stopPropagation()` keeps the marker from ever firing. The class is also dropped when a new source is published, in case the edge had marked the box for the object being replaced. A failure of anything other than the URL this effect wrote (the thumb itself, an object never pointed at) still reaches the edge rule.
- **Native play/pause** (`PhotosComponent.js`): `play`/`pause` listeners mirror the node's state, and the `showVideoPlayer` effect's stop branch is now gated on `!videoRef.current.paused`. Without that gate a native pause rewound the visitor to 0 and cleared readiness — and since a buffered source does not re-fire `loadeddata`, the next play showed the spinner over live playback. The client-rendered path is unaffected: nothing sets `showVideoPlayer` false there except the navigation handler, which pauses explicitly.
- **`playsinline`** is written as an attribute (not the IDL property) because that is what iOS reads at playback time and it is observable in tests; skipped when the edge already published it.
- **Client-rendered image error**: reverts the failing node's `src` to `photo.thumbUrl` by direct DOM write, then fades in. React's next render compares its own previous prop (`imgUrl`) with the same value and writes nothing, so the fallback survives a re-render. Known bound: if an effect dep changes after a revert, the swap effect republishes the original once more and reverts again — one wasted request per page view, self-correcting; left un-latched rather than shipping an untested guard.
- **Header sticky** (`App.js`): `display:contents` on the captured slot while adopted, with an inline-style reset in the effect cleanup so nothing survives the handoff. jsdom paints nothing, so this is pinned structurally (inline style present while adopted, empty after handoff), not visually — the ~1 px reserve question stays a G2/field-measurement item per the resolved decision.
- Lint: `npx eslint` on all four touched files is clean; `npm run lint` still reports 17 pre-existing problems in `About.js`, `Contact.js`, `Home.js`, `NoMatch.js`, `SearchComponent.js`, `Terms.js`, `setupTests.js` — untouched by this change and left alone.

## Plan Change Log

## Review Triage Log

## Design Notes

The handoff bug is a missing distinction between *unknown* and *contradicted*:

```js
const recordKnown = Boolean(internalState.currPhoto?.photo?.id)
// in the handoff effect: clear only when the skeleton positively does not describe this page
if (!onSkeletonPage || (recordKnown && !adopted)) clearDetailSkeleton()
```

`currPhoto` stays null until GraphQL settles, so today's `!adopted` fires on every cold deep link that lacks a seed. Keep the existing kind-mismatch handoff working — it is the case `recordKnown && !adopted` is meant to keep.

## Verification

**Commands:**
- `npx vitest run src/containers/detailSkeleton.seam.test.js src/containers/PhotosComponent.fullMedia.test.js src/index.boot.test.js src/detailGeometry.contract.test.js` -- expected: all pass, including the new pins
- `npm test` -- expected: full suite green (157 tests before this change)
- `npm run lint` -- expected: no new warnings
- `git stash && npx vitest run src/containers/detailSkeleton.seam.test.js; git stash pop` -- expected: the new pins fail without the fix
