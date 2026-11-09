---
title: 'technical research: SEO features correctness (WiSaw.client)'
type: 'technical'
topic: 'SEO features correctness (WiSaw.client)'
decision: 'Is WiSaw.client SEO implementation correct vs current search/social crawler requirements, and what improvements are warranted? Report only.'
source: 'native run (working-tree audit + WiSaw.cdk edge injector + official docs + live wisaw.com probes)'
status: complete
preset: 'standard'
validation: 'normal'
claims_verified: 16
claims_unverified: 4
created: '2026-11-07'
updated: '2026-11-08'
---

# technical research: SEO features correctness (WiSaw.client)

**Decision this research serves:** is the SEO implementation correct, and what should change? Scope was report-only: no front-end or back-end code was touched.

## Executive summary

**Verdict: the SEO core is correct. Nothing found blocks indexing or video rich results.** Two failure modes recorded in project notes were tested live and **overturned**: `index.html` is served `max-age=900`, not a year [7], and missing assets/paths return true `HTTP/2 404`s, not a 200 HTML shell [8]. Canonicalisation, robots handling, sitemap reachability, VideoObject required properties and media fetchability all check out against live HTML and Google's own requirements [1][9][12][13].

Three findings drive what to do next:

1. **The SEO engine is not this repo.** A Lambda@Edge function in `WiSaw.cdk` — called **the injector** throughout this report — rewrites every `<head>` and prerenders crawlable bodies for 21,949 media URLs; the client's Helmet markup is stripped or overwritten in production [6]. Anyone auditing only `WiSaw.client` sees a plausible SEO layer that is not what users' crawlers receive — and client-side SEO changes can silently no-op.
2. **CloudFront caches 404s for up to a year.** The 404 document carries `cache-control: max-age=31536000`, and three never-requested paths came back already aged: `31562`, `31720` and `68186` seconds (≈9–19 h) [8]. A media page crawled in the seconds before it goes live can keep answering 404 at the edge long after publish — the only finding that can quietly suppress indexation, and worth fixing before anything else.
3. **The client fabricates video metadata.** `duration` is hardcoded to `PT0M30S` and `uploadDate` falls back to render-day [3], while the injector emits measured values from ffprobe or a per-media metadata sidecar (a small JSON file stored beside each media object) [4]; after hydration a rendered pass can therefore see two conflicting `VideoObject` nodes (reasoned from code — no headless browser was available).

Smaller gaps, all cheap: static routes share one pre-JS body and ship no `og:image`/`twitter:*` on social shares [6][9]; `/search/*` sends a `noindex` header while its body meta says `index, follow`, an interaction Google defines no precedence for [16]; the sitemap has no `<lastmod>`; duplicate `og:site_name`; dead static tags in `index.html` and an inert `public/_headers`.

**Biggest caveat:** two spec questions stayed unverified because their sources were unreachable (X card requirements, Apple's `apple-app-site-association` (AASA) content-type rule), and Google Search Console was not available — so *observed* correctness is strong, *achieved* indexation is unconfirmed. Re-check the version-compat claim by 2026-12-01 and re-probe the live findings after any CloudFront or injector deploy.

## 1. Head metadata and social cards

**Verdict: correct where it matters — one deliberate omission, two cosmetic defects, one block of dead fallback markup, and one spec (X cards) left unverified.**

**Who writes the head is the first question.** Production `wisaw.com` does not serve a bare SPA shell: the **injector** (`WiSaw.cdk …/injectMetaTagsLambdaFunction`, a Lambda@Edge function) rewrites `<head>` per route before CloudFront caches it, marking its output `data-rh="true"` [5]. The Helmet markup in the working tree and the markup actually served therefore differ (live home title "Free Stock Photos & Videos, Unaltered | WiSaw" vs `Home.js` "…-- What I Saw"; live `og:type=photo` on `/photos/*` vs code's `article`). **The injector is the production source of truth for meta tags; Helmet is the fallback for anything the edge does not handle.** The Helmet integration itself is sound under React 19.2.4 + Vite: `@dr.pogodin/react-helmet@3.1.0` declares a React 19 peer, `HelmetProvider` wraps the router at `src/App.js:4,184`, and no Vite alias is required [15]. Any SEO change made only in this repo may never reach users until it also lands in the injector.

What is right, verified against live HTML:

| Route class | title | description | canonical | og:title/desc/url/type | og:image | twitter:* |
|---|---|---|---|---|---|---|
| `/`, `/about`, `/contact`, `/terms` | per-route ✓ | per-route ✓ | self-referencing ✓ | ✓ (`website`) | **absent** | **absent** |
| `/photos/<id>`, `/videos/<id>` | per-route ✓ | per-route ✓ | self-referencing ✓ | ✓ | ✓ 200 `image/webp` + `og:image:title`/`caption` | card/title/image (description absent) |
| `/search/*` | shared "Search WiSaw" | shared | → `https://wisaw.com/search` | ✓ | stripped | stripped |

All of that is present in **raw, JS-free HTML** — the site does not depend on Google rendering JavaScript for its core metadata [9]. `x-robots-tag: index, follow` was observed on `/`, `/about` and (on a recheck probe) on both a `/photos/*` and a `/videos/*` URL; `noindex, follow` on `/search/*` and on 404 bodies; no stray `noindex` on indexable pages [9].

**The og:image gap is a design decision, not a bug.** `stripExistingMetaTags()` removes `og:image` and all four `twitter:*` tags from the shipped template on every route, then `injectRouteTags()` deliberately adds none — its comment reads "no og:image because these routes have no single representative image" [6]. Consequence: Open Graph's own reference lists `og:title`, `og:type`, `og:image`, `og:url` as "the four required properties for every page" [5], so shares of the homepage or `/about` render image-less cards in Slack, X, iMessage and WhatsApp. Fixing it needs a chosen representative image (the 512×512 logo is already referenced by the template and returns 200) — a product call about brand presentation, not a correctness repair.

**Cosmetic defects:** `/photos/*` carries `og:type=photo`, which is not one of ogp.me's namespaced types (`music.*`, `video.*`, `article`, `profile`, `website`) [5] — scrapers tolerate unknown values, so treat this as hygiene; and `og:site_name` ships twice with conflicting values ("WiSaw" from the template, "wisaw.com" injected on media pages) [6].

**Dead code worth knowing about:** root `index.html` ships static `og:image`, `twitter:card/title/description/image` fallbacks that the injector strips on every route it serves [6]. They read like a guarantee of social cards on static routes and are not one — a maintenance trap for the next person.

**Unverified:** official X card documentation is unreachable from this environment (developer.x.com → JS-only docs.x.com shell, legacy paths 404), so `summary_large_image`/`player` compliance stays an unverified belief [14]. The usage is internally consistent and no evidence of breakage was found.

## 2. Structured data (JSON-LD)

**Verdict: rich-result eligible for video; two emitters are quietly competing.**

Google requires exactly three `VideoObject` properties — `name`, `thumbnailUrl`, `uploadDate` — with `contentUrl`, `duration`, `interactionStatistic` and `creator` recommended, plus a stable thumbnail URL and a `contentUrl` that is "the URL of the video file's actual content bytes itself" [1]. MOV is explicitly in Google's processable list (3GP…MOV, MP4…XAP) [1], so the `.mov` scheme is not a problem.

Live probe of `/videos/03b51380-…`: one parseable `VideoObject` carrying all three required properties plus `contentUrl`, `embedUrl`, `creator`; `contentUrl` → HTTP 200 `video/mov` 9.8 MB with no auth; thumbnail → HTTP 200 `image/webp` [2]. **Video rich results are not blocked** — eligibility holds on format, fetchability and required fields.

Two emitters write this markup, and they disagree:

| | injector (deployed) | client (`PhotosComponent.js`) |
|---|---|---|
| video type | `VideoObject` [4] | `VideoObject` [3] |
| photo type | **`Photograph`** with license/creditText [4] | **`ImageObject`** [3] |
| duration | real: sidecar ‖ ffprobe [4] | **hardcoded `'PT0M30S'`** [3] |
| uploadDate | sidecar ‖ S3 lastModified [4] | `createdAt ‖ new Date()` — fabricates today on missing data [3] |
| interactionStatistic | absent | present (`WatchAction`) |
| BreadcrumbList | absent | present (position 2 and 3 both resolve to homepage `item` or omit it) [3] |

Pre-JS HTML contains the server block; after hydration Helmet appends the client one, so a rendered pass can see two `VideoObject` nodes with different `duration`/`uploadDate`. **No headless browser was available in this run, so this is reasoned from code, not observed** — confidence medium, and it is the one place where the client actively publishes fabricated metadata (a 30-second duration on every video whose real length is unknown). Recommend a single source of truth rather than fixing either side independently.

Also missing from the graph: `Organization`/`WebSite` markup anywhere; `BreadcrumbList` only client-side; photo pages emit no image-sitemap entries even though `sitemap.xml` declares the `image:` and `video:` namespaces while emitting only `<loc>` [13].

## 3. SPA indexability and rendering

**Verdict: far better than a typical client-rendered React SPA — the empty-app-shell problem, where a crawler sees only the loading shell, applies here to four URLs rather than 22,000.**

`vite.config.js` has no SSR or prerender plugin and route components are `React.lazy` behind `Suspense`, so in this repository it is a pure client-side SPA [17]. Production behaves differently because the edge injector renders body content: media pages arrive with an `<h1>`, a real media element (`<video controls preload="none" poster width height src>` or `<img alt loading="eager">`), a description paragraph, up to eight label links and JSON-LD — verified as 590 characters of page-specific text and 10 links on the probed video page [2][6]. Google documents that "Googlebot queues all pages with a 200 HTTP status code for rendering, unless a robots meta tag or header tells Google not to index the page" ("The page may stay on this queue for a few seconds, but it can take longer than that… Google also uses the rendered HTML to index the page") [12] — so prerendered content indexes immediately while JS-only content indexes late. The injector moves 21,949 URLs out of the late-indexing queue and into immediate indexing.

**The exception is the four static routes.** `/`, `/about`, `/contact` and `/terms` serve **byte-identical body HTML** to a JS-free crawler — the template's `<noscript>` block plus two headings — while their heads differ correctly [6]. `injectRouteTags()` rewrites the head only; no one extended the per-route body rendering that media routes get to these four. All four ship the same body document — everything below the `<title>` is identical — and none exposes an internal link until JavaScript runs.

**404 handling is correct.** Unknown paths return a genuine HTTP 404 whose served body carries `<meta name="robots" content="noindex, follow">` plus a homepage-pointing canonical — confirmed on a fresh unique path at 00:33Z; an earlier same-day capture of `/deep/nope/path` showed the same document but its `noindex` grep missed it, so the directive rests on the recheck probe [9]. Not the soft-404 pattern of a 200 shell [8], and `public/404.html` is guarded by `src/seo.template.test.js`. Missing media objects are answered 404 + noindex in code too (`photo.js:65`) [4].

**`/search/*` is deliberately consolidated, with one contradiction.** The injector maps every `/search/<anything>` to the `/search` route entry — canonical `https://wisaw.com/search`, `x-robots-tag: noindex, follow`, `cache-control: private, no-cache` — because "every search term is a machine-made page with no content of its own, which is the classic doorway pattern" [6]. Sound strategy. But the same response body still carries the template's `<meta name="robots" content="index, follow, …">`, and nothing in the pipeline reconciles the two [9]. Google documents both mechanisms but defines **no precedence for header-vs-meta disagreement** (searched the current doc: no conflict guidance) [16], so this is unspecified behaviour rather than a documented win — low severity, and a one-line injector fix: make the body meta match the header.

**Link graph:** prerendered media bodies link only to `/` and up to eight `/search/<label>` tag pages [6], every one of those targets canonicalized away and noindexed, and there are no prev/next or related-media links before hydration. What that means for discovery is worked in §5.

## 4. Serving and crawl infrastructure

**Verdict: both suspected failure modes are fixed at the status level; one new risk found.**

Two facts recorded in project notes were tested against the live edge and **overturned**:

| Hypothesis (from project docs) | Live evidence 2026-11-08 | Status |
|---|---|---|
| `index.html` served `cache-control: max-age=31536000` | `/` and `/about`: `max-age=900`, `x-cache: Hit`, `age: 389` [7] | **overturned** |
| Missing `/assets/*` returns 200 `text/html` | mutated asset → `HTTP/2 404`, `content-type: text/html`, `x-cache: Error` [8] | **overturned at status level** |

**New finding — sticky negative caching.** The 404 document itself carries `cache-control: max-age=31536000`, and CloudFront serves it from its error cache. Never-requested paths came back already aged — `/deep/nope/path` at `31562` s, a mutated asset path at `31720` s, and a third fresh path at `68186` s (≈9–19 h) [8]. The ages differ per path, so CloudFront caches each error response independently rather than sharing one object — which still means a 404 can stick for up to a year. A `/photos/<id>` crawled in the window between object upload and page publish can therefore keep answering 404 at the edge long after it goes live, and CloudFront invalidation of that URL is not automatic. This is the only infrastructure finding that can silently suppress indexation of fresh content.

**Correct and verified:** `http://wisaw.com/` → 301 → `https://wisaw.com/`; `https://www.wisaw.com/` → 301 (Lambda-generated) → apex; canonicals in raw HTML are self-referencing on `/` and `/about` and all sitemap `<loc>` values use the apex host — one consolidated origin; Google lists redirects as a strong canonical signal and sitemap inclusion as only weak [10]. `robots.txt` is permissive (`Allow: /`) with a valid `Sitemap:` line and does not block JS/CSS/images; the Google site-verification file returns 200; all spot-checked icons exist with correct content types; sitemap is live at ~10.1 MB / 21,988 URLs total (21,949 of them media URLs) with same-day `last-modified`, inside Google's 50 MB and 50,000-URL per-sitemap limits [13].

**Hygiene items:** `robots.txt` itself is served `cache-control: max-age=31536000` — a year is longer than needed for a file crawlers re-check often (the norm was not verified from a primary source, so treat as low-confidence advice). `/site.webmanifest` is an unreferenced orphan with empty `name`/`short_name` while `/manifest.json` is the one linked from HTML [13].

**Dead configuration:** `public/_headers` requests `application/json` for the AASA paths and `no-cache` for `/index.html`; live serves `binary/octet-stream` and `max-age=900` respectively — empirical proof that this Netlify-only file has zero effect on an S3/CloudFront deploy [18]. Related: both deployed AASA copies are `binary/octet-stream` and **out of sync with each other** (303 B at `/.well-known/`, 399 B at the root), while the repo copy matches the 399-byte one. Apple's documented `application/json` requirement could not be confirmed from Apple docs this run (JS-rendered page, JSON API mirror carried no content-type text) — reported as an unverified belief carried forward from prior knowledge [11]. The repo file also looks internally inconsistent about app-ID shapes; universal links are outside this run's SEO scope, so it is tracked as an open question in §7 [18].

## 5. Cross-dimension insights

The findings above matter most for how they combine. Three combinations do:

**SEO correctness here lives in the injector rather than this repo, and that inverts the risk.** The client SPA's SEO code (Helmet blocks, JSON-LD, canonicals) is largely decorative in production because the edge injector overwrites it [6]. Two consequences. First, an audit of `WiSaw.client` alone would have concluded "SEO looks good" while never finding what actually serves it — and any future client-side SEO change can silently no-op. Second, where the client *does* win the race against the edge is where it publishes fabricated data: hardcoded `duration: 'PT0M30S'` and `uploadDate` defaulting to render-day [3]. The half of the metadata that is most likely wrong is the half most likely to be seen.

**Every prerendered page spends its only crawlable link equity on pages that are canonicalized away.** Media bodies — the 21,949 pre-JS documents — link only to `/` and up to eight `/search/<label>` tag pages [6], and every one of those targets is `noindex` + canonicalized to `/search` [9]. Combined with a sitemap that has no `<lastmod>` and contains no static routes [13], the graph is: sitemap → media page → (dead end). Nothing links between media items before hydration, so discovery and recrawls depend entirely on sitemap polling. Google lists sitemap inclusion as only a *weak* canonical signal while redirects and `rel=canonical` are strong [10] — WiSaw stacks those correctly for consolidation, but weak-signal discovery is the whole graph.

**Sticky edge 404s can cancel every other SEO investment for new content.** The injector produces excellent crawlable pages, the sitemap lists them same-day, and the metadata passes spec — yet a URL that answered 404 once can keep answering 404 from CloudFront's error cache with `max-age=31536000` [8]. Publish-order races are routine (object uploaded before page published, or a link shared seconds early), so this is the single highest-leverage fix in the report and it lives entirely in infrastructure, not in either repo.

## 6. Recommendations

Ordered by value against the decision "is SEO correct, what to improve". None applied — report only. Each names where the change lives.

| # | Action | Where | Confidence |
|---|---|---|---|
| 1 | Stop caching error documents for a year: set the CloudFront error-response `Cache-Control` override (or origin header) for 404/403 to something like `public, max-age=60`, and invalidate `/photos/*`, `/videos/*` on publish so a pre-publish crawl cannot stick. | WiSaw.cdk / CloudFront config — not this repo | high (live-probed [8]) |
| 2 | Make the server the single JSON-LD source: keep the injector's `VideoObject`/`Photograph`, and gate or drop the client block in `PhotosComponent.js` so hydration cannot emit a second node with fabricated `duration`/`uploadDate`. If the client block stays, add real duration + no `new Date()` fallback. | both (frontend delete/gate; backend already correct [4]) | medium — duplicate-node behaviour is reasoned from code, not observed in a rendered pass |
| 3 | Add `interactionStatistic` and confirm the injector covers `duration` across the corpus (one probed page lacked it [2]; code supports it [4]). If #2 gates rather than deletes the client block, also switch its photo type from `ImageObject` to `Photograph` to match. | WiSaw.cdk injector + PhotosComponent.js | medium-high [1][2] |
| 4 | Give static routes a brand `og:image` (+ `twitter:card`/`image`) — the 512×512 logo already ships and returns 200. Product decision about brand presentation; restores OG's four required properties [5]. | WiSaw.cdk `injectRouteTags()` | high that it is absent; the fix is a taste call |
| 5 | Prerender per-route bodies for `/`, `/about`, `/contact`, `/terms` (they are byte-identical to a JS-free crawler today [9]) — extend the existing media body builder to static routes. | WiSaw.cdk injector | high (live-probed) |
| 6 | Reconcile robots on `/search/*`: emit `content="noindex, follow"` in the body meta there instead of relying on the header alone, since Google documents no precedence for header-vs-meta disagreement [16]. | WiSaw.cdk template/`static.js` | high (both signals observed [9]) |
| 7 | Add `<lastmod>` to sitemap entries (and plan a sitemap index before the corpus approaches 50,000 URLs; currently ~21.9k at 10.1 MB [13]). Consider prev/next or related-media links in prerendered bodies so discovery is not sitemap-only (the file currently holds 21,988 URLs at 10.1 MB [13], so an index is a plan rather than an urgent fix). | WiSaw.cdk sitemap generator + injector body | medium-high |
| 8 | Add `Organization` (or `WebSite`) JSON-LD site-wide; keep `BreadcrumbList` server-side too, and give its levels distinct `item`s [2]. | WiSaw.cdk injector | medium |
| 9 | Dedupe `og:site_name` and use a documented `og:type` (`article`/`website`) instead of `photo` on `/photos/*` [5]. | WiSaw.cdk injector | high |
| 10 | Drop the dead static `og:*`/`twitter:*` tags from root `index.html`, or comment them as always edge-stripped. | WiSaw.client | high [6][9] |
| 11 | Delete inert `public/_headers` and fix or remove the orphan `/site.webmanifest`. | WiSaw.client `public/` | high [13][18] |
| 12 | Lower `robots.txt` TTL from a year. | CloudFront/S3 config | low — the one-year norm was not primary-sourced |
| 13 | Close the verification gaps rather than assuming them away: every item is listed with what it would take in §7. | process, not code | — |

## 7. Open questions

| Question | What it would take |
|---|---|
| Does Google's rendered pass see one or two `VideoObject` nodes? | Headless render (or URL Inspection "View crawled page") of a `/videos/<id>` URL. Not possible in this environment — no browser, and the code path is Helmet appending after hydration [3]. |
| Does every video get a server `duration`, or do ffprobe misses silently drop it? | Query the sidecar store / run the injector's media resolver across the corpus; or sample N live video pages for `duration` presence. |
| Is indexation actually complete for `/photos/*` and `/videos/*`? | Search Console coverage report — no access this run. |
| Do X/Slack cards render as intended? | Run the URLs through a card validator; official docs were unreachable [14]. |
| Does `binary/octet-stream` on the AASA paths break universal links on any iOS version? | Apple doc fetch from a network that isn't blocked, plus a device test [11]. Out of SEO scope but shares the same file. |
| Do `/search/<label>` tag pages bring in any search traffic or indexation today? | Search Console query and page reports; if they do, reconsider `noindex` in favour of indexed, differentiated tag pages. |
| Do the AASA `applinks` app IDs match the shipping bundle IDs (`33P3Q88Y8K.com.echowaves` vs `…com.echowaves.Wisaw[.Clip]`)? | Compare against the App Store / Xcode project; not SEO, but it shares the file whose content-type is already suspect [18]. |

## 8. Source appendix

| # | Claim / finding it supports | Publisher | Pub date | Accessed | Confidence |
|---|---|---|---|---|---|
| [1] | VideoObject required (`name`, `thumbnailUrl`, `uploadDate`) and recommended props; `contentUrl` must be the file bytes; thumbnails need stable URLs; MOV is a processable format | [Google Search Central — structured data for video](https://developers.google.com/search/docs/appearance/structured-data/video) | living | 2026-11-08 | verified |
| [2] | Live `/videos/03b51380-…` serves one valid `VideoObject`; `.mov` contentUrl 200 `video/mov` 9.8 MB, thumbnail 200 `image/webp`, both auth-free; duration absent on this page | [wisaw.com](https://wisaw.com/videos/03b51380-054f-485b-80cf-757fdad56d26) + img.wisaw.com HEADs | n/a (live) | 2026-11-08 | verified probe; duration gap unverified as to cause |
| [3] | Client JSON-LD: hardcoded `duration: 'PT0M30S'`, `uploadDate ‖ new Date()`, `ImageObject` for photos, `BreadcrumbList` with duplicate `item`s | [echowaves/WiSaw.client `src/containers/PhotosComponent.js`](https://github.com/echowaves/WiSaw.client/blob/main/src/containers/PhotosComponent.js) :932–1031 | working tree | 2026-11-08 | verified |
| [4] | Server `VideoObject` + `Photograph`; duration from sidecar ‖ ffprobe; missing media → 404 + noindex | [echowaves/WiSaw.cdk `injectMetaTagsLambdaFunction/video.js`](https://github.com/echowaves/WiSaw.cdk/blob/main/lambda-fns/lambdas/injectMetaTagsLambdaFunction/video.js), `utils.js` :128–159 | working tree | 2026-11-08 | verified |
| [5] | `og:title`/`og:type`/`og:image`/`og:url` are the four required OG properties; namespaced type list does not include `photo` | [ogp.me](https://ogp.me/) | living | 2026-11-08 | verified |
| [6] | Injector rewrites `<head>` per route, strips shipped `og:image`/`twitter:*`, injects none for static routes by design, prerenders media bodies linking only to `/` + tag pages; `/search` ROUTES entry is `noindex` doorway avoidance | WiSaw.cdk `injectMetaTagsLambdaFunction/{static,photo,video,utils}.js` (local working tree) | working tree | 2026-11-08 | verified |
| [7] | `index.html` served `cache-control: max-age=900`, `x-cache: Hit`, `age: 389` — year-TTL hypothesis overturned | HEAD probes `/`, `/about` | n/a (live) | 2026-11-08 | verified |
| [8] | Misses return true `HTTP/2 404`; error document carries `max-age=31536000`; recorded ages on never-requested paths: `31562`, `31720` s and (recheck) `68186` s | HEAD probes `/assets/index-gvkStkWF-deadbeef.js`, `/deep/nope/path`, `/recon-probe-zq7x9m2k` | n/a (live) | 2026-11-08 | verified |
| [9] | Static-route bodies byte-identical to JS-free crawler; self-referencing canonicals; 404 body carries `noindex, follow`; `x-robots-tag: index, follow` on `/`, `/about` and (recheck) on `/photos/*` + `/videos/*`; robots header-vs-meta contradiction on `/search/*`; www→apex and http→https 301s | HEAD/GET probes of `/`, `/about`, `/contact`, `/terms`, `/photos/<id>`, `/search/arch`, `www`/`http` variants + the 00:33Z recheck in `imports/live-recheck-404-and-media.txt` | n/a (live) | 2026-11-08 | verified |
| [10] | Redirects and `rel=canonical` are strong canonical signals, sitemap inclusion weak; methods stack | [Google Search Central — consolidate duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) | living | 2026-11-08 | verified |
| [11] | Apple requires `application/json` for AASA | Apple developer docs — **unreachable this run** (JS-rendered page; JSON mirror carried no content-type text) | — | 2026-11-08 | unverified belief |
| [12] | Google queues 200-status pages for rendering (unless robots says not to index) and indexes from rendered HTML; JS-only content indexes late | [Google Search Central — JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics) | living | 2026-11-08 | verified |
| [13] | Sitemap ~10.1 MB / 21,949 media URLs (21,109 photos, 840 videos), no `<lastmod>`, no static routes, declares image/video namespaces but emits only `<loc>`; `robots.txt` permissive with valid `Sitemap:` line and served `max-age=31536000`; `/site.webmanifest` orphan with empty name fields | [wisaw.com/sitemap.xml](https://wisaw.com/sitemap.xml), [/robots.txt](https://wisaw.com/robots.txt), working-tree `public/` | n/a (live) | 2026-11-08 | verified (TTL norm advice unverified) |
| [14] | X `twitter:card` requirements — could not be retrieved | [developer.x.com](https://developer.x.com/en/docs/x-for-websites/cards/overview/abouts-card) → docs.x.com JS shell; legacy paths 404 | — | 2026-11-08 | unverified gap |
| [15] | Helmet integration sound under React 19 + Vite (`@dr.pogodin/react-helmet@3.1.0`, peer react 19, provider at `src/App.js:4,184`) | [npm registry](https://registry.npmjs.org/@dr.pogodin/react-helmet/3.1.0) + working-tree `src/App.js` | 2026-11-08 | 2026-11-08 | verified |
| [16] | Google documents robots meta and `X-Robots-Tag` but defines no precedence when they conflict (searched current doc; "conflict" absent) | [Google Search Central — block indexing pages](https://developers.google.com/search/docs/crawling-indexing/block-indexing) | living | 2026-11-08 | unverified (absence-of-guidance, not guidance of absence) |
| [17] | In this repo the app is a pure client-side SPA: `vite.config.js` carries no SSR/prerender plugin and route components are `React.lazy` behind `Suspense` | working tree [`vite.config.js`](https://github.com/echowaves/WiSaw.client/blob/main/vite.config.js), `src/App.js` | working tree | 2026-11-08 | verified |
| [18] | `public/_headers` is inert on S3+CloudFront: live serves `binary/octet-stream` for both AASA copies (303 B vs 399 B, out of sync) and `max-age=900` for `index.html`, contradicting every directive in the file | working-tree [`public/_headers`](https://github.com/echowaves/WiSaw.client/blob/main/public/_headers) + HEAD probes of both AASA paths | n/a (live) | 2026-11-08 | verified |

## 9. Staleness map

Computed by `recon_kit.py staleness` over the claims ledger behind §8, with re-check windows of 1 month for version-compat, 2 for live probes, 6 for documentation specs and 9 for implementation facts. No claim is stale today (2026-11-08).

| Class | Claims | Re-check by |
|---|---|---|
| version-compat | Helmet peer-dependency match under React 19.2.4 + Vite | **2026-12-01** |
| live-probe | index.html TTL · 404 sticky caching · static-route body identity · video rich-result probe · canonical/redirect consolidation | 2027-01-01 |
| doc-spec | VideoObject props · MOV support & stable thumbnails · og:image requiredness · robots precedence · AASA content-type · X card spec · rendering-pass behaviour | 2027-05-01 |
| implementation-fact | client fabricated duration/uploadDate · sitemap shape · `_headers` inertness | 2027-08-01 |

**Earliest re-check: 2026-12-01.** The live-probe rows age fastest in practice, though — the sticky-error-cache finding should be re-probed after any CloudFront or injector deploy rather than on the calendar.
