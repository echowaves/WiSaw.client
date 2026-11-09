# D3 spa-indexability — r2 digest 1 (2026-11-08)

Round 2 followed two leads from round 1: the /search/* route class, and the prerendered internal link graph. Sources: WiSaw.cdk static.js + utils.js htmlResponse, SearchComponent.js Helmet block, live probes of /search/arch, Google robots-meta/X-Robots-Tag doc.

## Findings

### /search/* is deliberately excluded — with two contradictory signals
static.js ROUTES['/search'] sets `canonical: https://wisaw.com/search` and `noindex: true`; routeFor() maps any `/search/<anything>` to that entry by first path segment, so every search-term URL canonicalizes to the single /search page. Comment states the reason: "every search term is a machine-made page with no content of its own, which is the classic doorway pattern."
- Live `https://wisaw.com/search/arch`: HTTP/2 200, `x-robots-tag: noindex, follow`, `cache-control: private, no-cache`, canonical `https://wisaw.com/search` (not self-referencing). Correct consolidation for a thin page class.
- **Contradiction:** the same response body carries `<meta name="robots" content="index, follow, max-image-preview:large, ...">` — inherited from index.html's static tag; injectRouteTags rewrites title/description/OG/canonical but never touches robots, and SearchComponent.js emits no robots tag either. So header says noindex, meta says index. utils.js htmlResponse is the only place that decides (x-robots-tag), so the meta tag is a stale default nobody owns.
- Google's "Robots meta tag, data-nosnippet, and X-Robots-Tag" doc documents both mechanisms but defines **no precedence rule for header-vs-meta disagreement** (string search for 'conflict' in the fetched page: 0 hits). Practically noindex dominates; leaving the pair contradictory is avoidable risk rather than a live defect.

### Prerendered internal link graph
buildSeoBody emits, per media page: one `<nav><a href="/">` and up to eight label links `href="/search/<label>" rel="tag"`. So every one of the 21,949 prerendered pages hands links only to the homepage and to a route class that is canonicalized away and noindexed. No prev/next, related-media or category links exist pre-JS; deep-graph discovery rests entirely on sitemap.xml. (Client-side prev/next navigation exists but only after hydration.)

### Static-route body duplication (round-1 finding, mechanism now identified)
injectRouteTags rewrites the head only; /, /about, /contact, /terms all serve index.html's static body (noscript block + template h1/h2). Four URLs, one body, no per-route copy — while their heads are correctly distinct.

## Claims
- claim: Every /search/<term> URL is served with x-robots-tag 'noindex, follow' and canonical https://wisaw.com/search, deliberately consolidating machine-made search pages.
  source: WiSaw.cdk static.js ROUTES['/search'] + routeFor(); live probe of /search/arch | publisher: repo working tree + live wisaw.com probe | n/a-for-probe | accessed 2026-11-08 | confidence high | class implementation-fact
- claim: Those same responses carry a body-level `<meta name="robots" content="index, follow">`, contradicting the header directive; nothing in the pipeline reconciles them.
  source: live /search/arch body grep + static.js (no robots handling) + index.html static tag | publisher: live probe + repos | n/a-for-probe | accessed 2026-11-08 | confidence high | class implementation-fact
- claim: Google's robots-meta/X-Robots-Tag documentation defines no precedence for header-vs-meta conflict, so the contradiction is unspecified behavior rather than a documented win for either.
  source: https://developers.google.com/search/docs/crawling-indexing/block-indexing (fetched; 'conflict' absent) | publisher: Google Search Central | living | accessed 2026-11-08 | confidence high (about the absence) | class doc-spec
- claim: Prerendered media pages link only to '/' and up to eight /search/<label> tag pages — no prev/next or related links before JS.
  source: WiSaw.cdk utils.js buildSeoBody:112-115,157-158 + live body probe | publisher: repo working tree + live probe | n/a-for-probe | accessed 2026-11-08 | confidence high | class implementation-fact

## Leads
- Whether making tag pages real indexable galleries (prerendered, self-canonical, in sitemap) is worth more than the doorway risk — a product call, not a correctness one.
- Search Console URL-inspection on one /search/<term> to confirm Google honored the header noindex despite the meta index.

## Not found / gaps
- No documented precedence rule for conflicting robots directives (searched the current doc).
- Cannot observe Google's rendered DOM or its chosen canonical for /search/* URLs from here.
