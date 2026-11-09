# D1 head-metadata-social — r1 digest 1 (2026-11-07)

Scope: head-level SEO (title, description, canonical, Open Graph, Twitter cards) in the WiSaw.client working tree vs what wisaw.com serves to non-JS crawlers, checked against official OG spec and X card docs. ~16 tool calls used (slightly over budget; doc fetches dominated). No project files modified except this digest.

## Findings per question (Q1..Q4)

### Q1 — Per-route Helmet output in the working tree

All route components import `Helmet` from `@dr.pogodin/react-helmet` and render `<Helmet prioritizeSeoTags>`:
src/App.js:4,184 · src/containers/Home.js:3,335–405 · PhotosComponent.js:4,849–1032 · SearchComponent.js:8,433–470 · About.js:2,15–36 · Contact.js:2,15–36 · Terms.js:2,15–36 · NoMatch.js:4,11–17.

Tag matrix (working tree):

| Route | title | desc | canonical | og:title | og:desc | og:url | og:type | og:image | og:site_name | twitter:card | twitter:title/desc/image | other |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Home (Home.js:335–405) | Y | Y | Y (`https://wisaw.com`) | Y | Y | Y | `website` | Y (android-chrome-512x512.png) | Y | `summary_large_image` | Y (+twitter:url) | — |
| Photo detail (PhotosComponent.js:849–1032) | Y | Y* | Y self | Y | Y* | Y | `video.other` / `article` | Y (`photo.thumbUrl`) | Y | `player` (video) / `summary_large_image` (photo) | Y | twitter:player(+w/h); og:video:* set; JSON-LD VideoObject/ImageObject; robots `max-video-preview:30`; `video:duration 30`; `video:release_date = new Date()` (~:925) |
| Search (SearchComponent.js:433–470) | Y | Y | Y self | Y | Y | Y | **absent** | Y (512 png) | Y | `summary_large_image` | Y | — |
| About/Contact/Terms (:15–36 each) | Y | Y | Y self | Y | Y | Y | `website` | Y (512 png) | Y | `summary_large_image` | Y (+twitter:url) | — |
| NoMatch (NoMatch.js:11–17) | Y | Y | → homepage | – | – | – | – | – | – | – | – | robots `noindex, follow` |

Notes:
- PhotosComponent emits a single `<meta name='description' property='og:description'>` tag carrying both attributes (sed-excerpt lines 7–11 of the Helmet block) — crawlers may honor only one attribute.
- No og:image:width/height/alt anywhere in code or live HTML.
- `video:release_date` is fabricated from `new Date().toISOString()` at render time, not the photo's real capture date (PhotosComponent.js ~:925).
- App route table has `<Route element={<NoMatch />} />` with no path (App.js ~:210); catch-all `*` redirects to `/`, so NoMatch is effectively unreachable and unknown URLs are handled by CloudFront 404.html instead.

### Q2 — Helmet integration under React 19 + Vite: NOT broken

- package.json:15 `"@dr.pogodin/react-helmet": "3.1.0"`; react/react-dom 19.2.4 (package.json:20–21); vite 7.3.7 (:45). All Helmet imports reference exactly this installed package — no `react-helmet-async` import exists in any granted file.
- App.js:4,184 provides matching `HelmetProvider`.
- vite.config.js (whole file, 670 B) has **no alias/shim** — none needed.
- npm registry for @dr.pogodin/react-helmet@3.1.0: `peerDependencies: {"react": "19"}` → version-compatible with the installed React 19.2.4.
- Two HTML templates exist: root `index.html` (Vite entry, ships) and `public/index.html` (legacy CRA template with `%PUBLIC_URL%` placeholders and static og/twitter fallback tags; not deployed as-is). src/seo.template.test.js guards both for: no static canonical, single `<title>`, robots index/follow, `<div id="root">` preserved, plus 404.html invariants (noindex, standalone, crawlable links).

### Q3 — Live crawler HTML (curl -sL, no JS executed)

Public `/` head is server-rendered per route with `data-rh="true"` tags — consistent with the Lambda@Edge meta injector (`injectMetaTagsLambdaFunction` in WiSaw.cdk) described in the index.html comment and seo.template.test.js:9. Static template contributes og:site_name, og:locale, robots, google-site-verification (value redacted).

Static routes `/`, `/about`, `/contact`, `/terms` — present in raw HTML: per-route `<title>`, meta description, og:title, og:description, og:url, og:type `website`, self-referencing canonical, static og:site_name + og:locale. **Absent from raw HTML: og:image and every twitter:* tag.** (Working-tree Helmet would emit them at runtime; crawlers without JS never see them on these routes.)

- Live copy diverges from working tree: live home title is "Free Stock Photos & Videos, Unaltered | WiSaw" but Home.js renders "Free Stock Photos & Videos -- What I Saw"; descriptions likewise differ. Deployed head content comes from the edge injector (or a newer build), not this tree's Helmet strings.
- Duplicate `og:site_name` on every live page (static "WiSaw" + injected value; photo page injects "wisaw.com").

Deep route probe `/photos/35e99e0c-…` (URL from public/sitemap.xml, which lists 21,949 /photos|/videos URLs): raw HTML has title, description, og:image (`https://img.wisaw.com/<uuid>.webp`), og:image:title, og:description, og:title, og:url, **og:type `photo`** (tree code says `article`), twitter:title/card/image (twitter:**description missing**), self-referencing canonical, 1 JSON-LD block. og:image HEAD → HTTP/2 200, content-type image/webp. `https://wisaw.com/android-chrome-512x512.png` HEAD → 200 image/png.

### Q4 — Against official specs

- Open Graph (ogp.me, the Facebook-initiated protocol reference; living doc): "The four required properties for every page are: og:title, og:type, og:image, og:url" and "Depending on the type you specify, other properties may also be required." → **Static marketing routes fail the og:image requirement in crawler-served HTML** (only runtime-JS clients get it). Live `og:type=photo` on /photos/* is not a defined OG type namespace (music/video/article/website) — spec-invalid.
- X cards: developer.x.com card paths redirect to docs.x.com/overview (HTTP 200, JS-rendered mintlify app; no crawlable card spec retrieved); legacy `docs.x.com/x-for-websites/cards/overview/abouts-card` → HTTP 404. **Gap:** could not cite official twitter:card requirements this round. Weak corroboration only: X's own docs homepage head uses `"og:type":"website","twitter:card":"summary_large_image"`. The app's usage (summary_large_image + twitter:image; player card with twitter:player/+width/height) is internally consistent but its spec-compliance is an unverified belief this round.
- developers.facebook.com/docs/sharing/webmasters was not fetched (budget; X redirect chain consumed the doc-fetch attempts) — recorded as a gap.

## Claims

- claim: Every route component imports Helmet from `@dr.pogodin/react-helmet` and App.js wraps routes in its HelmetProvider, so the Helmet integration matches the installed package and is functional under React 19 + Vite (no dangling react-helmet-async import).
  source: package.json:15,20 · src/App.js:4,184 · src/containers/{Home,PhotosComponent,SearchComponent,About,Contact,Terms,NoMatch}.js import lines
  publisher: repo working tree
  pub_date: n/a (working tree as of 2026-11-07)
  accessed: 2026-11-07
  confidence: high
  class: implementation-fact

- claim: @dr.pogodin/react-helmet@3.1.0 declares peerDependency react "19", compatible with the repo's React 19.2.4; vite.config.js needs and has no alias/shim.
  source: https://registry.npmjs.org/@dr.pogodin/react-helmet/3.1.0 · package.json:15,20 · vite.config.js (full)
  publisher: npm registry / repo working tree
  pub_date: living (registry)
  accessed: 2026-11-07
  confidence: high
  class: version-compat

- claim: Live wisaw.com serves per-route title/description/og:title/og:description/og:url/og:type/canonical in raw JS-free HTML for /, /about, /contact, /terms (server-side injection), so those routes are not JS-dependent for core meta.
  source: curl -sL https://wisaw.com/{,about,contact,terms} probes 2026-11-07
  publisher: live wisaw.com probe
  pub_date: n/a-for-probe
  accessed: 2026-11-07
  confidence: high
  class: live-probe

- claim: BROKEN — the crawler-visible HTML for /, /about, /contact, /terms contains no og:image and no twitter:* tags at all, so social cards for these shared URLs render without images/cards despite Helmet emitting them client-side.
  source: curl -sL probes above vs src/containers/Home.js:335–405, About.js:15–36, Contact.js:15–36, Terms.js:15–36
  publisher: live wisaw.com probe + repo working tree
  pub_date: n/a-for-probe
  accessed: 2026-11-07
  confidence: high
  class: live-probe

- claim: The Open Graph spec requires og:title, og:type, og:image and og:url on every page ("four required properties"), making the missing static og:image a spec violation, not just suboptimal.
  source: https://ogp.me/
  publisher: Open Graph protocol (Facebook-initiated; Meta developers page not reachable within budget)
  pub_date: living
  accessed: 2026-11-07
  confidence: high
  class: doc-spec

- claim: Live /photos/* pages serve rich crawler HTML (og:image 200 image/webp, twitter card/image, self-canonical, JSON-LD) but inject `og:type=photo` — not a valid OG type namespace — omit twitter:description, and duplicate og:site_name with conflicting values ("wisaw.com" vs "WiSaw").
  source: curl -sL https://wisaw.com/photos/35e99e0c-03a1-4f30-80d3-405bc1f3df35 + curl -sI og:image, 2026-11-07
  publisher: live wisaw.com probe
  pub_date: n/a-for-probe
  accessed: 2026-11-07
  confidence: high
  class: live-probe

- claim: Working-tree Helmet copy diverges from deployed head content (live home title "Free Stock Photos & Videos, Unaltered | WiSaw" vs Home.js "…-- What I Saw"; live og:type 'photo' vs code 'article'), i.e., the edge injector in WiSaw.cdk is the production source of truth for meta tags.
  source: live probes above vs src/containers/Home.js:335–405, PhotosComponent.js Helmet block · index.html comment re injectMetaTagsLambdaFunction (seen in probe) · src/seo.template.test.js:6–12
  publisher: live wisaw.com probe + repo working tree
  pub_date: n/a-for-probe
  accessed: 2026-11-07
  confidence: medium (deployed bundle may simply be newer than this tree)
  class: version-compat

- claim: public/index.html is a legacy CRA template (contains %PUBLIC_URL%) whose static og:image/twitter fallback tags are NOT what production serves; seo.template.test.js pins canonical-free/single-title/robots invariants on both templates and 404.html.
  source: public/index.html · src/seo.template.test.js:12,22–60
  publisher: repo working tree
  pub_date: n/a (working tree)
  accessed: 2026-11-07
  confidence: high
  class: implementation-fact

- claim: PhotosComponent fabricates `video:release_date` as render-time `new Date().toISOString()` and merges description+og:description into one meta tag carrying both name and property attributes.
  source: src/containers/PhotosComponent.js (Helmet block ~:855–930)
  publisher: repo working tree
  pub_date: n/a (working tree)
  accessed: 2026-11-07
  confidence: high
  class: implementation-fact

- claim: X card documentation could not be retrieved as crawlable text this round (developer.x.com → docs.x.com/overview redirect; legacy paths 404), so twitter:card type requirements remain an unverified belief.
  source: curl -sIL https://developer.x.com/en/docs/x-for-websites/cards/overview/abouts-card ; https://docs.x.com/x-for-websites/cards/overview/abouts-card
  publisher: X developer docs
  pub_date: living
  accessed: 2026-11-07
  confidence: high (about the gap itself)
  class: doc-spec

## Leads (entities/threads worth chasing next round)

- WiSaw.cdk `injectMetaTagsLambdaFunction` — the actual per-route tag table deployed to production; compare its static-route set vs Helmet's (source of the missing og:image/twitter on marketing pages and the live/tree copy drift).
- Root `index.html` (Vite entry, not in granted list) — confirm whether it carries any static twitter/og fallbacks.
- Valid OG type for photo pages (`og:type=photo` invalid; consider `article`/custom `wisaw:photo`) and adding og:image:width/height/alt per Meta guidance — verify against developers.facebook.com when fetchable.
- X cards reference via an alternate official home (docs.x.com sitemap or "cards" search within docs.x.com) to confirm summary_large_image/player requirements.
- Whether Google renders JS for /search/* routes and whether og:type absence there matters; robots.txt ↔ sitemap linkage (owned by another dimension).
- `/videos/<id>` probe (only /photos/ probed); JSON-LD VideoObject field correctness on live HTML.

## Not found / gaps

- developers.facebook.com/docs/sharing/webmasters not fetched (budget spent on X redirect chain) → og:image width/height and site_name recommendations cited only from ogp.me general wording.
- Official X/Twitter card spec text (card types, required properties per type) — all attempted URLs were redirects to a JS-only docs shell or 404.
- Could not determine whether working tree is ahead of or behind the deployed build (no git inspection performed; out of granted scope).
- No /videos/ deep-page probe; no check of og:image dimensions on img.wisaw.com assets; did not verify twitter:player card support status on X today.
- Budget note: ~16 tool calls used vs ~15 cap; two oversized outputs were saved to temp files and re-grepped, costing extra calls.
