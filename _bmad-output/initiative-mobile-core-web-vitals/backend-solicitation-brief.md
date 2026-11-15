# Backend solicitation brief — static detail-page skeleton for the edge injector

- **Repo**: `WiSaw.cdk` (this work must be solicited and built there, per project rule)
- **Initiative**: mobile-core-web-vitals
- **Branch**: `refactor/static-detail-pages` (already created from clean main in both repos)
- **Companion work**: WiSaw.client branch of the same name — client cleanup commit `3d52e29` is built; the client portal-app plan follows this backend change
- **Ship order**: backend deploys FIRST (must stay backward-compatible with the currently deployed client), then the new client. No dual-format tolerance code on either side.

## 1. Why (context)

PageSpeed Insights, mobile, three live deep links:

| Page | LCP | CLS |
|------|-----|-----|
| /photos/29461ee8… | 5.0 s | 0.165 |
| /photos/2d8195e6… | 4.9 s | 0.069 |
| /videos/d3ab008a… | 19.8 s | 0.351 |

Desktop for the same pages is fine (LCP 1.2–3.3 s, CLS ≤ 0.035). Two distinct causes:

1. **Video**: the edge-served `<video>` carries `poster=` pointing at the **full-resolution `.webp` derivative (3,090,583 B)**. That fetch runs at Medium priority and *is* the LCP element — 20 s on throttled 4G.
2. **Photo/video**: the edge paints a real page at FCP ~0.8 s, but React unmounts that subtree during hydration, so the painted media is discarded as an LCP candidate and LCP falls back to first-render JS/CSS delivery (~676 KB raw ≈ the entire 5 s). Layout re-arrangement on mount drives CLS.

The agreed replacement architecture (elicited in the client repo, five methods): **"static page with enhancement slots"** — the edge emits a complete static layout skeleton whose LCP media element is owned by no framework; React portals into marked enhancement slots and never replaces the painted page; detail pages declare no client-side `<head>` tags at all (the served bytes are authoritative). This brief covers the backend half of that.

## 2. Current state (verified against the code)

Lambda@Edge `lambda-fns/lambdas/injectMetaTagsLambdaFunction/` (CommonJS, raw-zip deploy, no bundler):

- **`utils.js`**
  - `buildSeoBody` (~L278): renders the crawler-visible body into `<div id="root">` — `h1` + media + description `<p>` + label links + nav + JSON-LD (`Photograph` / `VideoObject`). Photo: full-res `<img src=…webp alt width height loading="eager">`. Video: `<video controls preload="none" poster=<FULL-RES .webp> width height src=<video file>>`.
  - `renderRootBody` (~L261): structural mount-point replacement (comments/scripts masked, nesting counted); every doubtful case returns the input byte-for-byte unchanged; `dropsBootCriticalMarkup` refuses results that lost the module script, stylesheet links, or any `<script>`.
  - `injectMetaTags` (~L362): head — title, description, robots, og:* (`og:image` is already the **thumb**), twitter:*, byte-tolerant canonical rewrite, `og:video` + `og:video:duration` for videos.
- **`photo.js` / `video.js`**: handler per route — sidecar fetch + S3 probe in parallel; text/dims/duration from the sidecar record via `seoText.buildSeoFields` → `seoRules.buildSeoFields` (~L246: `width`, `height`, numeric `duration` already stored in the record); video duration falls back to one cheap HEAD (`readDuration`) only for pre-field records.
- **Shell**: `template.js` fetches the *deployed client's* `index.html` from S3 `wisaw.com/index.html` (60 s TTL). That shell contains two inline classic scripts:
  - `data-wisaw-lcp="preload"` — derives full/thumb object URLs from the pathname, sets `window.__wisawLcp`, appends `<link rel="preload" as="image" fetchpriority="high">` for the right file (thumb below a 700 px viewport or for videos; full-res otherwise).
  - `data-wisaw-lcp="swap"` — finds the **first** `img[src]`/`video[poster]` inside `#root` that has numeric `width`+`height`, copies them (and the video `src`) into the plan, and demotes `src`/`poster` from full-res to thumb when `useThumb`.
- **Tests**: mocha + chai under `tests/`; `tests/fixtures/served-index.html` is the real served shell; relevant suites: `inject-meta-tags.js` (mount-point structural tests run against that fixture), `static-route-copy-once.js`, `seo-crawler-contract.js`, `video-duration*.js`. Lint: `ts-standard`.

## 3. Requested changes

### C1 — Video poster: thumb only, never full-res
In `buildSeoBody`, the video element's `poster` becomes `thumbUrl(imageId)` — the same file `og:image`/`twitter:image` already publish. The full-res `.webp` derivative must then appear **only** inside JSON-LD (`contentUrl`), where crawlers fetch it and browsers do not. Keep `src=` (the actual video file) and `preload="none"`.

### C2 — Full static skeleton instead of the bare h1+media block
Replace `buildSeoBody`'s output with a complete page skeleton mirroring the app's detail layout, so nothing re-arranges when React takes over:

- **Reserved header band** — fixed height matching the app's sticky header: **72 px desktop / 64 px mobile** (verified against client `src/containers/Header.css`), non-interactive.
- **Media slot** — the LCP element (photo `<img>` / video with thumb poster) inside a fixed aspect-ratio box derived from the sidecar `width`/`height` (`aspect-ratio: w/h`, capped by viewport width). When dimensions are unknown, fall back to a neutral default-ratio box rather than an auto height. The media element keeps its numeric `width`/`height` attributes and is **first in DOM order among media elements** (the deployed client's swap script depends on that — see constraint 2).
- **h1 / description / label links** — content and copy rules unchanged (same `buildSeoFields` inputs, same truncation).
- **Reserved below-fold space** — fixed-height placeholder for the comment/action block so first-view geometry matches the app.
- **Enhancement slots** — marked for React portals with `data-wisaw-slot="header"` and `data-wisaw-slot="below"`; the media element gets `data-wisaw-media` **and `data-wisaw-id="<media id, lower-case>"`**. The client's adoption check (`src/utils/detailSkeleton.js`) is strict: it adopts only when `data-wisaw-id` equals the route id exactly (case-insensitive) — a media element without a matching `data-wisaw-id` means the client renders fully client-side instead. Exact names are decided here and pinned by tests; the client plan will consume them as-is.
- **Scoped layout `<style>`** inside `#root` (keeps it self-contained; target < 2 KB; no external CSS).
- **Inline `onerror` fallback** on the media element (hide/placeholder the box) — script-local, never throws.
- **JSON-LD: `Photograph` / `VideoObject` unchanged in rules** (same fields), **plus a third graph — `BreadcrumbList`** — because the client stops publishing its own head after this work and the served bytes become authoritative. The client's current shape (from `mediaSeo.breadcrumbGraph`, deleted by the companion plan): `itemListElement[0]` = `{ position: 1, name: 'Home', item: 'https://wisaw.com/' }`; `itemListElement[1]` = `{ position: 2, name: <page title>, item: <canonical URL of this page> }`. Google requires an `item` on every crumb but the last; here both carry one.
- **Full video OG block in the head** (today's `injectMetaTags` publishes only `og:video` + `og:video:duration`; the client's Helmet published more and goes away with this work). For videos, add: `og:video:url` and `og:video:secure_url` (the video file), `og:video:type` (derived from the stored key's extension — `mov` → `video/quicktime`, `webm` → `video/webm`, otherwise `video/mp4`; hard-coding mp4 mislabelled every `.mov` object, which is what `videoObjectKey`'s fallback publishes), `og:video:width` / `og:video:height` (from the sidecar dims — absent when unknown, never guessed), and `og:video:image` (= the thumb, same file as `og:image`). Keep the existing `og:video` + `og:video:duration`.

Photo `<img src>` stays the **full-res** object: the edge cannot know the viewport, and the shell's preload+swap scripts already pick thumb vs full correctly at parse time. Do not "fix" this to thumb — it would blur desktop LCP.

### ~~C3 — Publish numeric duration in the DOM~~ (dropped)
Originally: `data-wisaw-duration="<seconds>"` on the video element so the client could seed from the DOM and delete its parser. Dropped after the client plan was frozen: the client's adoption path (`detailSkeleton.js`) reads only `data-wisaw-id`, `width`/`height` and the video `src` — nothing consumes a duration attribute. The client's ISO/clock parser later lost its last consumer too (the detail-page `<Helmet>` block that published durations was deleted with the portal-app change), so `src/utils/mediaSeo.js` and its `videoDuration.contract.test.js` are now removed: duration facts live only in the served bytes — whole seconds in `og:video:duration`, ISO 8601 in JSON-LD. Geometry copies, by contrast, got a contract test of their own (`src/detailGeometry.contract.test.js`).

## 4. Hard constraints

1. **Single-anchor contract**: exactly one `<div id="root">`; the skeleton must pass `renderRootBody`'s structural checks and `dropsBootCriticalMarkup`. The client pins this in `src/seo.template.test.js` (simulates an injection pass against `build/index.html`).
2. **Backward-compatible with the currently deployed client** (it ships after this one): that app replaces `#root` wholesale on hydration, and its shell swap script requires the first `img[src]`/`video[poster]` in `#root` to carry numeric `width`+`height`. The skeleton must satisfy both.
3. No new runtime dependencies; CommonJS only; raw-zip deploy (no bundler step).
4. Max cyclomatic complexity 8 (project rule) — extract helpers, early returns.
5. Static-route copy stays in `static.js`'s route table (pinned by `tests/static-route-copy-once.js`) — do not move or duplicate it; static routes are out of scope.
6. **No precise-location leakage**: the skeleton must not publish sidecar fields beyond what today's body already exposes. `assertNoPreciseLocation` coverage stays green.
7. **SERP-visible strings stay byte-identical** for an unchanged record — this is a layout + media change, not a copy change.

## 5. Test expectations (mocha/chai, existing conventions)

Extend `tests/inject-meta-tags.js` (or a sibling file):

- Video body: `poster` === thumb URL; the full-res `.webp` key appears only in JSON-LD `contentUrl`; no `poster=` with the full-res key.
- Skeleton: `data-wisaw-slot="header"` / `"below"`, `data-wisaw-media` and `data-wisaw-id` (equal to the route id, lower-case) present; aspect-ratio box when dims known, neutral fallback when unknown; reserved header + below-fold space present.
- Video head: full OG block — `og:video:url`, `og:video:secure_url`, `og:video:type`, `og:video:image` (= thumb), plus existing `og:video`/`og:video:duration`; `og:video:width`/`og:video:height` present iff the sidecar has dims.
- JSON-LD: three graphs on a detail page — `Photograph` or `VideoObject` (rules unchanged) and `BreadcrumbList` with Home + current-page crumbs; photo pages get no `og:video:*` at all.
- Old-client compatibility: first media element in `#root` carries numeric `width`+`height`.
- Mount-point suite stays green against `tests/fixtures/served-index.html` (update the fixture only if the client shell itself changes — coordinate with the client repo). When both repos are checked out side by side, the fixture-provenance block in `edge-detail-skeleton.js` pins mount-point count, module script and reload-guard marker between the fixture and the real `WiSaw.client/index.html`.

Keep `npm test` and `npm run lint` green; complexity ≤ 8.

## 6. Out of scope

- Client portal app, deletions of `edgeSeed.js`/`seoRecord.js`/`servedHead.js`, detail-route Helmet removal (WiSaw.client, separate plan on the matching branch).
- Static routes (`/about`, `/contact`, `/terms`, `/search`) and their copy.
- Sidecar schema changes or backfill — `width`/`height`/`duration` already exist in records.
- Sitemap / crawler-contract changes beyond what C1–C3 imply.

## 7. Acceptance criteria (measured after deploy, PSI mobile)

- Video deep link: LCP ≤ ~3 s (target 2–3 s), CLS ≤ 0.05; the full-res poster request is gone from the cold-load waterfall.
- Photo deep link: no regression from this change alone (the photo LCP win lands with the client portal app); CLS improves once the client ships.
- Crawlability parity: served HTML still contains h1, img alt, label links, JSON-LD; 404/noindex paths unchanged.

## 8. Paste-ready BMad prompt for WiSaw.cdk

> **Round 1 status (2026-11-15):** built on `WiSaw.cdk@refactor/static-detail-pages` — `5b97615` (skeleton) + `24f0a97` (`og:video:type`). Not yet deployed. Round 2 below is additive to that; nothing in C1–C3 is renegotiated.

> bmad-build (oneshot): Extend the Lambda@Edge injector (`lambda-fns/lambdas/injectMetaTagsLambdaFunction/`) so detail pages are served as a complete static skeleton instead of a bare h1+media block, per the brief in `_bmad-output/initiative-mobile-core-web-vitals/backend-solicitation-brief.md` (copied into this repo before starting). Three changes: (C1) `buildSeoBody` video `poster` becomes the thumbnail (`thumbUrl`) — the full-res `.webp` must then appear only in JSON-LD `contentUrl`; (C2) replace the body output with a full page skeleton — reserved header band (72 px desktop / 64 px mobile), media in an aspect-ratio box from sidecar width/height (neutral fallback when unknown), unchanged h1/description/labels, reserved below-fold space, enhancement slots `data-wisaw-slot="header"|"below"` + `data-wisaw-media` + `data-wisaw-id="<route id>"`, scoped inline `<style>` (<2 KB), script-local `onerror` fallback; photo `<img src>` stays full-res (the client shell's preload/swap scripts handle mobile); the JSON-LD gains a third graph, `BreadcrumbList` (Home → current page, both crumbs with `item`); video pages gain the full OG block (`og:video:url`, `og:video:secure_url`, `og:video:type`, `og:video:image` = thumb, `og:video:width/height` from sidecar dims when known) on top of the existing `og:video` + `og:video:duration`. (C3 was dropped — see brief §3.) Hard constraints: keep exactly one structural `<div id="root">` mount point passing `renderRootBody`/`dropsBootCriticalMarkup`; stay backward-compatible with the currently deployed client (first media element in #root must carry numeric width+height); no new deps, CommonJS, raw-zip deploy; cyclomatic complexity ≤ 8; static-route copy untouched (`static.js`, pinned by `tests/static-route-copy-once.js`); no precise-location leakage; SERP-visible strings byte-identical for unchanged records. Tests: extend `tests/inject-meta-tags.js` per brief §5, keep the full mocha suite and ts-standard green.

## 9. Round 2 (added 2026-11-15, after round 1 was built)

Two findings came out of the client-side portal app (`WiSaw.client@refactor/static-detail-pages`, commits `031bf26`/`6c778b4`). Both were logged in `_bmad-output/initiative-mobile-core-web-vitals/deferred-work.md` as backend-owned: each is a fact the edge already knows and could publish, where any client-side fix would mean re-deriving edge knowledge a second (or third) time in this repo.

### C4 — Keep the browser tab title truthful across client-side detail navigation

**Problem.** Detail routes declare no `<head>` tags after round 1 — the served bytes are authoritative and correct per request. Nothing then updates the tab title when the user clicks prev/next: `document.title` keeps the record the page was *first* served with, for as long as the tab lives, however far the user browses. Verified in both repos: no `document.title` / `history.replaceState` writer exists anywhere (the injector folder has none; the client's detail-route `<Helmet>` block — the previous and only writer — was deleted by this work).

**Requested.** A small script on the served page that keeps `document.title` in step with the route, using wording it **reads from the edge rather than composes**:

- On a detail-route change (`pushState`/`replaceState` + `popstate`, or a `wisaw:navigate` event — mechanism is yours; the client will happily emit one if that is cheaper), parse the media id out of `location.pathname` with the same canonical rules as `mediaUri.js`.
- Fetch the **sidecar you already publish** — `https://img.wisaw.com/<id>.json`, public by design (Lambda@Edge reads the same object for the first byte of every media page) — and set `document.title = seo.title` when `seo.kind` matches the route kind. That is the identical string this injector puts in `<title>`, so no budget or wording rule is duplicated anywhere.
- Ignore non-detail paths (leave the title to `<RouteSeo>` on `/about`, `/contact`, `/terms`, `/search`), ignore a missing/malformed sidecar, cancel a stale response when the route moves again mid-flight, and never throw — same discipline as the existing `data-wisaw-lcp` scripts.

**Why this is safe to write.** `index.html:7` ships a plain `<title>` with no `data-rh`, so React-helmet (which manages only marked tags) never removes it; the element exists on every route, and `document.title` remains writable from page-load onward. Detail routes deliberately publish no helmet title, so there is nothing to fight over.

**Test expectations.** Title script present in the served detail body/shell; sidecar URL derived from the route id (lower-cased); kind mismatch → no write; non-media path → no write; a fetch failure leaves the previous title untouched. Keep `tests/seo-crawler-contract.js` green — the script must not disturb the single-anchor contract or `dropsBootCriticalMarkup`.

**Placement.** Either in this injector's skeleton output or in the shell it fetches from S3 (`template.js` reads the deployed client's `index.html`) — your call, since both reach the same page. The one thing not on the table is a client-side re-implementation of the title rules; that is exactly the duplication round 1 removed.

### C5 — Publish media object URLs on the skeleton instead of leaving the client to derive them

**Problem.** `src/utils/detailSkeleton.js` rebuilds both media URLs from the id (`MEDIA_ORIGIN` + `<id>.webp` / `-thumb.webp`) to seed React's first commit. That naming rule now exists in three places: the shell's preload script, the shell's swap script (both pinned against each other by `src/lcpBootstrap.template.test.js`… i.e. `lcpBootstrap.template.test.js`) and that third copy in the client. Harmless while all three agree; a rename in `mediaNaming.js`/`mediaUri.js` would silently desync the seed.

**Requested.** Put the facts on the node the browser already painted: `data-wisaw-src="<absolute full-res object URL>"` and `data-wisaw-thumb="<absolute thumb URL>"` on `[data-wisaw-media]` (for videos, `data-wisaw-src` may stay the video file the element's `src` already carries — mirror whatever the client must not guess). Absolute URLs, lower-cased id, built by the same helpers that build `og:image`/`contentUrl`, so there is still exactly one naming implementation per side.

**Then the client change** (WiSaw.client, follows this): `skeletonSeededPhoto` reads the two attributes and `MEDIA_ORIGIN` plus its concatenation are deleted from `src/utils/detailSkeleton.js`. `src/detailGeometry.contract.test.js` extends to pin the attribute pair alongside `data-wisaw-id`/`width`/`height`.

**Backward compatibility.** Purely additive: the currently deployed client ignores unknown attributes, so ship edge-first exactly as in §4.2 / §ship order. Update the both-sides contract notes in `skeleton.js`'s header comment and the fixture-provenance block in `tests/edge-detail-skeleton.js` when the attribute pair is added.

### Paste-ready BMad prompt for round 2

> bmad-build (oneshot): Implement round 2 of `_bmad-output/initiative-mobile-core-web-vitals/backend-solicitation-brief.md` §9 against `lambda-fns/lambdas/injectMetaTagsLambdaFunction/`. (C4) A script on the served detail page keeps `document.title` in step with client-side navigation: detect detail-route changes, parse the media id with `mediaUri.js` rules, fetch the public sidecar `https://img.wisaw.com/<id>.json`, and set `document.title` from `seo.title` only when `seo.kind` matches the route kind — never compose title wording locally, ignore non-media paths, tolerate a missing record, cancel superseded responses, never throw. (C5) Add `data-wisaw-src` and `data-wisaw-thumb` (absolute URLs from the existing naming helpers, lower-cased id) to `[data-wisaw-media]` in `skeleton.js` so WiSaw.client can read media URLs instead of deriving them; additive only — the deployed client ignores unknown attributes. Constraints unchanged: single-anchor mount point, `dropsBootCriticalMarkup`, CommonJS + raw-zip deploy, complexity ≤ 8, static-route copy untouched, no precise-location leakage, SERP-visible strings byte-identical. Tests per brief §9 in the existing mocha/chai suites; keep `npm test` and `npm run lint` green.
