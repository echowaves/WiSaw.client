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

- **Reserved header band** — fixed height matching the app's sticky header (confirm exact px against client `src/containers/Header.css`; default 56 px), non-interactive.
- **Media slot** — the LCP element (photo `<img>` / video with thumb poster) inside a fixed aspect-ratio box derived from the sidecar `width`/`height` (`aspect-ratio: w/h`, capped by viewport width). When dimensions are unknown, fall back to a neutral default-ratio box rather than an auto height. The media element keeps its numeric `width`/`height` attributes and is **first in DOM order among media elements** (the deployed client's swap script depends on that — see constraint 2).
- **h1 / description / label links** — content and copy rules unchanged (same `buildSeoFields` inputs, same truncation).
- **Reserved below-fold space** — fixed-height placeholder for the comment/action block so first-view geometry matches the app.
- **Enhancement slots** — marked for React portals with `data-wisaw-slot="header"` and `data-wisaw-slot="below"`; the media element gets `data-wisaw-media` for discovery. Exact names are decided here and pinned by tests; the client plan will consume them as-is.
- **Scoped layout `<style>`** inside `#root` (keeps it self-contained; target < 2 KB; no external CSS).
- **Inline `onerror` fallback** on the media element (hide/placeholder the box) — script-local, never throws.
- **JSON-LD unchanged in rules** (`Photograph` / `VideoObject`, same fields).

Photo `<img src>` stays the **full-res** object: the edge cannot know the viewport, and the shell's preload+swap scripts already pick thumb vs full correctly at parse time. Do not "fix" this to thumb — it would blur desktop LCP.

### C3 — Publish numeric duration in the DOM
When known, add `data-wisaw-duration="<whole seconds>"` to the video element, from the same stored number that feeds `og:video:duration`. The client will read it from the DOM ("seed from the DOM, not a sidecar") and delete its own ISO/clock duration parser — removing a verbatim cross-stack duplicate. Do **not** add a non-standard numeric field to JSON-LD; ISO 8601 stays there.

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
- Skeleton: `data-wisaw-slot="header"` / `"below"` and `data-wisaw-media` present; aspect-ratio box when dims known, neutral fallback when unknown; reserved header + below-fold space present.
- `data-wisaw-duration` equals the `og:video:duration` seconds when known; absent when unknown.
- Old-client compatibility: first media element in `#root` carries numeric `width`+`height`.
- Mount-point suite stays green against `tests/fixtures/served-index.html` (update the fixture only if the client shell itself changes — coordinate with the client repo).

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

> bmad-build (oneshot): Extend the Lambda@Edge injector (`lambda-fns/lambdas/injectMetaTagsLambdaFunction/`) so detail pages are served as a complete static skeleton instead of a bare h1+media block, per the brief in `_bmad-output/initiative-mobile-core-web-vitals/backend-solicitation-brief.md` (copied into this repo before starting). Three changes: (C1) `buildSeoBody` video `poster` becomes the thumbnail (`thumbUrl`) — the full-res `.webp` must then appear only in JSON-LD `contentUrl`; (C2) replace the body output with a full page skeleton — reserved header band, media in an aspect-ratio box from sidecar width/height (neutral fallback when unknown), unchanged h1/description/labels, reserved below-fold space, enhancement slots `data-wisaw-slot="header"|"below"` + `data-wisaw-media`, scoped inline `<style>` (<2 KB), script-local `onerror` fallback; photo `<img src>` stays full-res (the client shell's preload/swap scripts handle mobile); (C3) add `data-wisaw-duration="<seconds>"` to the video element when known. Hard constraints: keep exactly one structural `<div id="root">` mount point passing `renderRootBody`/`dropsBootCriticalMarkup`; stay backward-compatible with the currently deployed client (first media element in #root must carry numeric width+height); no new deps, CommonJS, raw-zip deploy; cyclomatic complexity ≤ 8; static-route copy untouched (`static.js`, pinned by `tests/static-route-copy-once.js`); no precise-location leakage; SERP-visible strings byte-identical for unchanged records. Tests: extend `tests/inject-meta-tags.js` per brief §5, keep the full mocha suite and ts-standard green.
