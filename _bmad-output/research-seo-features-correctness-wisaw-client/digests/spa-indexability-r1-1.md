# D3 spa-indexability — r1 digest 1 (2026-11-08)

Lead ran this dimension inline after the researcher assistant died without output. Sources: vite.config.js, index.html, live probes of /, /about, /contact, /terms, /videos/<id>, Google JavaScript SEO doc, public/sitemap.xml. ~9 tool calls.

## Findings per question

### Q1 — Rendering model in the working tree
Pure client-side SPA: vite.config.js has only @vitejs/plugin-react + vite-plugin-svgr (no SSR/prerender/hydration plugin), build.outDir 'build', sourcemap false. Route components are React.lazy behind Suspense. index.html ships a static marketing body inside <div id="root"> (h1 "Unaltered Photos and Videos, Taken with Phone Cameras." + h2 paragraph) plus a <noscript> block with an h1, two paragraphs and one link — a deliberate crawlable floor for the homepage.

### Q2 — What crawlers actually get on the live site (measured, not inferred)
- Media routes (/photos/<id>, /videos/<id>): **server-prerendered by Lambda@Edge** — head meta + body with h1, media element (video poster/width/height or img alt/loading=eager), description paragraph, recognition-label links, nav link, JSON-LD. Verified live: 590 chars of real page-specific text, 10 links, valid ld+json on the probed video page. These routes are fully indexable pre-JS.
- Static routes (/, /about, /contact, /terms): head is per-route (title/description/OG/canonical injected), **body is byte-identical across all four** — the template's noscript block + the same two headings. A JS-free crawler (and Google's first crawl pass) sees four pages with one body and no internal links beyond one self-referential nav link.
- 404 behaviour: unknown paths return a true HTTP 404 with a noindex'd custom document (public/404.html, guarded by src/seo.template.test.js), canonical → homepage. Matches Google guidance; not a soft-404 pattern.

### Q3 — Google's documented JS behavior (primary doc)
developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics: "Googlebot queues all pages with a 200 HTTP status code for rendering, unless a robots meta tag or header tells Google not to index the page. The page may stay on this queue for a few seconds, but it can take longer than that… Google also uses the rendered HTML to index the page." Consequence: content present only after JS is indexed late and links discovered late; app-shell pages are explicitly called out as the case where "Google needs to execute JavaScript before being able to see the actual page content".

### Q4 — Body visibility on live media pages
See Q2. The prerendered body also carries `<video controls preload="none" poster=… width height src>` / `<img … loading="eager">` (WiSaw.cdk utils.js:120-126), which is the surface Google's automatic-thumbnail and image indexing read.

### Q5 — Sitemap & robots
public/sitemap.xml (fetched into the tree at build time from production): 21,949 URLs — 21,109 /photos/ + 840 /videos/. **No <lastmod> on any URL**; no static routes and no /search/ URLs in the sitemap; declares image/video/news namespaces but emits only <loc>. Live: 200 application/xml, ~10.1 MB, cache-control max-age=300, same-day last-modified (D4). robots.txt: User-agent: * / Allow: / / Sitemap: https://wisaw.com/sitemap.xml — nothing harmful blocked; assets not disallowed.

## Claims
- claim: Media routes are server-prerendered with page-specific crawlable body content, so the SPA is not an app-shell for 21,949 of its URLs.
  source: curl https://wisaw.com/videos/03b51380-… + WiSaw.cdk utils.js buildSeoBody | publisher: live probe + repo working tree | n/a-for-probe | accessed 2026-11-08 | confidence high | class live-probe
- claim: /, /about, /contact, /terms serve identical body HTML (noscript block + template h1/h2) to a JS-free crawler while their heads differ.
  source: curl probes of the four routes 2026-11-08 | publisher: live wisaw.com probe | n/a-for-probe | accessed 2026-11-08 | confidence high | class live-probe
- claim: Google renders all 200-status pages in a second queue pass, so JS-only content is indexed late rather than never.
  source: https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics | publisher: Google Search Central | living | accessed 2026-11-08 | confidence high | class doc-spec
- claim: sitemap.xml lists 21,949 URLs (21,109 photos / 840 videos) with no lastmod and no static routes; robots.txt is permissive and points at the sitemap.
  source: public/sitemap.xml counts + public/robots.txt + live header check | publisher: repo working tree + live probe | n/a | accessed 2026-11-08 | confidence high | class implementation-fact
- claim: Unknown paths return true 404 with a noindex'd document, avoiding soft-404 classification.
  source: curl -I https://wisaw.com/recon-probe-<unique> → HTTP/2 404 + public/404.html + WiSaw.cdk photo.js:65 (noindex on miss) | publisher: live probe + repos | n/a | accessed 2026-11-08 | confidence high | class live-probe

## Leads
- Whether the edge injector could emit per-route body copy for /about, /contact, /terms (it already has a route-head injector; body parity is one step away).
- Internal link graph: prerendered media bodies link to "/" and label pages only — no prev/next or related-photo links pre-JS, so deep-graph discovery depends on the sitemap.

## Not found / gaps
- No Search Console access: cannot report indexed-vs-crawled counts for the four static routes or coverage of the 21,949 media URLs.
- Rendered-DOM state (post-hydration) not observable without a headless browser in this sandbox.
