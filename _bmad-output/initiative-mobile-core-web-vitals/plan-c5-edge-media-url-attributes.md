---
title: 'Publish media object URLs on the edge skeleton (brief §9 C5)'
type: 'refactor'
ticket: ''
created: '2026-11-15'
status: 'built'
baseline_revision: 'a4a0300ac5779417769f07f0a028badaf8393951'
route: 'oneshot'
route_source: 'pinned'
risk: 'medium'
review: 'thorough'
review_source: 'default'
lenses_ran: ['edge-case-hunter', 'verification-gap', 'adversarial', 'structure-prose']
review_loop_iteration: 1
context: ['.github/copilot-instructions.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The rule "a media object is called `<id>.webp` / `<id>-thumb.webp` under `https://img.wisaw.com/`" is spelled out in three places: the shell's preload script, the shell's swap script (both pinned against each other by `lcpBootstrap.template.test.js`) and a third copy in WiSaw.client `src/utils/detailSkeleton.js`, which concatenates them to seed React's first commit. All three live where nobody can see the other two; a rename in the edge's `mediaNaming.js` would silently desync the seed that paints the LCP media.

**Approach:** The edge publishes the facts instead of leaving the client to derive them. `mediaElement()` adds `data-wisaw-src` (the full-resolution `.webp` derivative) and `data-wisaw-thumb` (the thumbnail) to `[data-wisaw-media]`, built by the same `imgUrl()`/`thumbUrl()` helpers that already produce `og:image` and JSON-LD `thumbnailUrl` — one naming implementation per side, as the brief requires. WiSaw.client's `skeletonSeededPhoto` then reads those two attributes and `MEDIA_ORIGIN` plus its string concatenation are deleted from `detailSkeleton.js`.

**Decisions:**
1. **C4 is deferred by the human** (2026-11-15): production `img.wisaw.com` sends no CORS headers, and live sidecars carry no stored `seo.title` (`buildSeoRecord` emits it, but the prod backfill predates the field), so a browser cannot read the edge's title today. Only C5 is built here; C4 stays an open solicitation and is logged in `deferred-work.md`.
2. `data-wisaw-src` names **the image that page may safely paint**, never the video file (the brief allowed either): the full-resolution `.webp` on a photo, the thumbnail on a video. A seeded video record still needs an image URL, and letting it derive `<id>.webp` would keep the very naming knowledge this change removes — but publishing the derivative on a video page collides with the backend invariant pinned by `tests/edge-detail-skeleton.js` › 'leaves the full-resolution image out of a video page entirely' (that object as an LCP candidate cost 20 s on a throttled phone), so it is not published there. The video's own object URL stays where it already is: the element's `src`.
3. **Strict read, no dual-format tolerance** (project stance): if either attribute is missing or is not an absolute `https://` URL, the client publishes no seed record and paints its own loading state rather than falling back to derivation. Adoption of the painted node itself is unaffected.
4. Purely additive on the edge: the currently deployed client ignores unknown attributes, so ship order stays backend-first (§4.2 unchanged).

</frozen-after-approval>

## Implementation Notes

Oneshot route: two small cross-repo edits plus tests; the contract is pinned by `_bmad-output/initiative-mobile-core-web-vitals/backend-solicitation-brief.md` §9 C5. Baselines — WiSaw.client `a4a0300ac5779417769f07f0a028badaf8393951`, WiSaw.cdk `24f0a97c7c1c6c2c386643fdb04dd2d45f000225` (round 1's plan lives beside the code it built: `WiSaw.cdk/_bmad-output/seo-indexing/plan-edge-detail-skeleton.md`).

- Backend: `utils.js` `mediaElement()` gains `srcUrl`/`thumbUrlValue` params and emits both attributes inside the existing `adoption` string (so they inherit `escapeHtmlAttribute`); `buildSeoBody` already computes exactly these as `imageUrl` and `previewUrl`, so it passes them through — no new URL logic, no second escaper.
- Client: `skeletonSeededPhoto()` reads `data-wisaw-src` / `data-wisaw-thumb`; `MEDIA_ORIGIN` and both template literals go away.
- Tests: cdk `tests/edge-detail-skeleton.js` pins both attributes on photo and video nodes, their exact values, and that they carry no precise-location or record text; client `detailSkeleton.seam.test.js` fixtures gain the attributes plus a case proving a skeleton without them yields no seed, and `src/detailGeometry.contract.test.js` gains the attribute-name parity line so a one-sided rename fails.
- Separately authorised ops action (not part of this diff): republish prod SEO sidecars (`npm run seo-sidecars`) so records carry `seo.*`; dry-run first and diff one live page's title before/after, because stored strings override derived ones in `buildSeoFields`.

## Verification

**Commands:**
- `cd /Users/dmitry/hacks/wisaw/WiSaw.cdk && npx mocha --exit --require @babel/register tests/edge-detail-skeleton.js tests/inject-meta-tags.js tests/seo-crawler-contract.js tests/static-route-copy-once.js` -- expected: all pass, including new attribute assertions
- `cd /Users/dmitry/hacks/wisaw/WiSaw.cdk && HOME="$TMPDIR/lint-home" npx ts-standard lambda-fns/lambdas/injectMetaTagsLambdaFunction/utils.js tests/edge-detail-skeleton.js` -- expected: clean (the one pre-existing violation is in `tests/inject-meta-tags.js:129`)
- `cd /Users/dmitry/hacks/wisaw/WiSaw.cdk && npm test` -- expected: green except the 5 documented `getSeasonBoundaries` timezone failures
- `cd /Users/dmitry/hacks/wisaw/WiSaw.client && npx vitest run` -- expected: full suite green
- `cd /Users/dmitry/hacks/wisaw/WiSaw.client && npx eslint src/utils/detailSkeleton.js src/containers/detailSkeleton.seam.test.js src/detailGeometry.contract.test.js` -- expected: clean

**Manual checks:**
- After the edge deploys: `curl -s https://wisaw.com/photos/<id> | grep -o 'data-wisaw-[a-z]*="[^"]*"'` shows `src` and `thumb` as absolute `https://img.wisaw.com/...` URLs matching the page's `og:image` thumb and JSON-LD `contentUrl` host.
- Cold mobile deep link still paints the thumbnail first (the shell's swap script is untouched).

## Review Triage Log

Run inline and sequentially — this repo's execution rule allows one model execution at a time, so no
lens subagents were launched.

**Edge-case hunter**

1. *Publishing the full-resolution derivative on a video page collides with a real backend invariant.*
   Caught by the pre-existing test 'leaves the full-resolution image out of a video page entirely'
   (that object as an LCP candidate cost 20 s on a throttled phone). Resolution: `data-wisaw-src` is
   the thumbnail on video pages, the derivative only on photo pages; both attributes are always present
   so the client keeps one contract instead of a per-kind one. Plan Decision 2 rewritten to record it.
2. *An edge that publishes nothing.* The URL check sits in `skeletonSeededPhoto`, not in the capture, so
   adoption (and with it the LCP win) survives an older cached edge while the seed simply returns null.
   Pinned by 'seeds nothing when the edge published no URLs, and still adopts the paint'.
3. *A published value that is relative or has another scheme* is treated as absent rather than trusted —
   a relative URL would resolve against the page origin and 404. Test added.
4. *Trust surface.* Seeded URLs now come from markup instead of a UUID-derived string. Every consumer was
   followed: the preload effect bails on `video === true`, the full-resolution swap bails on videos, and
   the `<img>` render path is photo-only (`isVideo !== true`), so the thumb-valued video `imgUrl` cannot
   promote a multi-megabyte fetch. Values are attribute-parsed (entities decoded, cannot break out of the
   attribute) and React escapes them at render; only absolute https is accepted. Accepted — pinning an
   exact origin would re-add the constant this change exists to delete.
5. *`index.html` still derives `-thumb.webp` in its `<head>` script.* Not drift: that script runs before
   `<body>` parses, so no published attribute exists yet; making it depend on one would drop the
   below-breakpoint thumb demotion on every page until the edge ships. Deliberately untouched.

**Verification gaps**

- The new backend assertions failed twice on first run: `og:image` is a head tag and absent from
  `buildSeoBody` output (test rewritten to go through `injectMetaTags(SERVED_SHELL, …)`), and the video
  expectation contradicted invariant 1. Both fixed before commit, not by loosening the assertions.
- `grep -rn "img.wisaw.com" src public --include=*.js --include=*.html` excluding tests returns nothing:
  `detailSkeleton.js` held the last URL derivation in shipped client code, so the new contract assertion
  is now a repo-wide property for detail media, not just one file.
- `window.__wisawLcp` has no consumer left (only `lcpBootstrap.template.test.js` asserts its absence
  off-detail). Left in place — removing it is unrelated to this contract and its preload link still works.

**Adversarial / structure / prose**

- Both attributes are emitted once, guarded by a count assertion; values go through the existing
  `escapeHtmlAttribute`. One added ternary, so complexity stays well under the repo ceiling of 8.
- Seam fixtures were rebuilt to what the edge now actually emits (video `data-wisaw-src` = thumbnail), so
  the client pins production bytes rather than an idealised shape.

**Loop:** converged in one iteration. Client suite 157 passing; cdk targeted set 144 passing; full cdk
suite unchanged except the 5 documented `getSeasonBoundaries` timezone failures; ts-standard clean on both
changed backend files; eslint clean on changed client files; `npm run build` + postbuild template contract
green.
