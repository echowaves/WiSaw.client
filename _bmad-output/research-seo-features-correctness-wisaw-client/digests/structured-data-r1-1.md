# D2 structured-data — r1 digest 1 (2026-11-08)

Lead ran this dimension inline after the researcher assistant died without writing output. Sources: saved Google Video structured-data doc, saved schema.org/VideoObject, live /videos/<id> probe, media/thumbnail HEAD probes, working-tree code (WiSaw.client + WiSaw.cdk injector). ~10 tool calls.

## Findings per question

### Q1 — What JSON-LD exists and where
Two independent emitters:
1. CLIENT (src/containers/PhotosComponent.js): VideoObject (:932-967) for videos, ImageObject (:972-1004) for photos, BreadcrumbList (:1007-1031). Always inside <Helmet>.
2. SERVER (WiSaw.cdk lambda-fns/lambdas/injectMetaTagsLambdaFunction/utils.js:128-159): VideoObject for videos, **Photograph** for photos, rendered into the prerendered body next to an <h1>, media element with poster/width/height, description paragraph, label links and a <nav> link.

Client VideoObject emits name, description, thumbnailUrl [array], uploadDate (createdAt || new Date()), contentUrl=photo.videoUrl, embedUrl, url, duration **'PT0M30S' hardcoded**, width/height, videoQuality, encodingFormat, interactionStatistic(WatchAction), publisher(Organization+logo), potentialAction.
Client ImageObject emits name, description, contentUrl, thumbnailUrl, url, datePublished, width/height, encodingFormat 'image/webp', interactionStatistic(ViewAction), comment(first comment), publisher.
Server VideoObject emits name, description, thumbnailUrl (string), uploadDate, contentUrl, embedUrl, duration (**real value**: sidecar || ffprobe via readDuration, video.js:50), creator(Organization). No interactionStatistic, no width/height.
Server Photograph emits name, caption, contentUrl, license https://wisaw.com/terms, creditText, creator(+url), copyrightYear (new Date().getFullYear()), url.

### Q2 — Google's requirements today (primary doc, developers.google.com/search/docs/appearance/video + structured-data/video)
- Required VideoObject properties: **name, thumbnailUrl, uploadDate**. Recommended: contentUrl (or embedUrl alternative), duration, interactionStatistic (preferred over deprecated interactionCount), creator.
- Eligibility rules captured verbatim from the doc: "The video must have a valid thumbnail that's available at a stable URL"; "Google can process the following video file types: 3GP, 3G2, ASF, AVI, DivX, M2V, M3U, M3U8, M4V, MKV, **MOV**, MP4, MPEG, OGV, QVT, RAM, RM, VOB, WebM, WMV, and XAP"; "use a single unique and stable thumbnail URL for each video"; contentUrl "must be the URL of the video file's actual content bytes itself", not the page URL.
- Doc example uses thumbnailUrl as an array of aspect-ratio variants and interactionStatistic with WatchAction — matching the client emitter's shape.

### Q3 — Requirements vs emitted
| property | Google | server (deployed) | client (post-hydration) | verdict |
|---|---|---|---|---|
| name | required | Y unique | Y unique | OK |
| thumbnailUrl | required, stable URL | Y (img.wisaw.com/<id>.webp, 200 image/webp) | Y (photo.thumbUrl) | OK — single string is valid; array of ratios recommended |
| uploadDate | required | Y (sidecar created \|\| S3 lastModified) | Y (createdAt \|\| render date) | OK server-side; client fallback fabricates today's date |
| contentUrl | recommended, real file bytes | Y .mov → 200 video/mov, no auth | Y photo.videoUrl (shape unverified) | OK/likely-OK |
| duration | recommended | Y real ISO8601 | **hardcoded 'PT0M30S'** | client value is wrong data |
| interactionStatistic | recommended | absent | present | improvement: server lacks it |
| creator | recommended | Y | publisher instead | OK |
| type for photos | (no Google requirement) | Photograph (schema-valid) | ImageObject | both valid; inconsistent between passes |

Two-emitter risk: pre-JS HTML carries the server JSON-LD in body; after hydration Helmet appends the client block. A rendered pass can therefore see two VideoObject nodes with different duration/contentUrl/uploadDate. Not observed directly (no headless render this run) — inference from code, confidence medium.

### Q4 — Live probe
/videos/03b51380-… raw HTML: exactly **1** ld+json block, parses as JSON, has all three required props + contentUrl + embedUrl + creator; thumbnailUrl 200 image/webp (959 KB); contentUrl .mov → HTTP/2 200 video/mov 9.8 MB, `x-cache: Hit`, no auth needed. Body is prerendered crawlable content (h1, <video controls preload="none" poster width height src>, description, recognition label links, nav link). No duration in the served block for this video — either sidecar+ffprobe returned falsy or the cached object predates the duration code; not resolvable from the edge.

## Claims
- claim: Google requires exactly name, thumbnailUrl and uploadDate on VideoObject; contentUrl/duration/interactionStatistic/creator are recommended.
  source: https://developers.google.com/search/docs/appearance/video (saved) | publisher: Google Search Central | pub_date: living | accessed: 2026-11-08 | confidence: high | class: doc-spec
- claim: MOV is in Google's list of processable video file types, so the .mov contentUrl is format-eligible.
  source: same doc, "Use a supported video file type" | publisher: Google Search Central | living | accessed 2026-11-08 | confidence high | class doc-spec
- claim: Live video pages serve one valid VideoObject with all required properties; contentUrl and thumbnailUrl both return HTTP 200 without auth.
  source: curl of https://wisaw.com/videos/03b51380-054f-485b-80cf-757fdad56d26 + HEAD on .mov/.webp | publisher: live wisaw.com/img.wisaw.com probe | n/a-for-probe | accessed 2026-11-08 | confidence high | class live-probe
- claim: The deployed injector's VideoObject omits duration for at least some videos (observed served block had none) while the code path supports it.
  source: live block vs WiSaw.cdk utils.js:135 + video.js:50 | publisher: probe + repo working tree | n/a | accessed 2026-11-08 | confidence medium (cache age unresolved) | class implementation-fact
- claim: The client VideoObject hardcodes duration 'PT0M30S' and falls back uploadDate to render-time new Date(); the server emitter uses real values.
  source: src/containers/PhotosComponent.js:943,939 vs WiSaw.cdk utils.js:135 | publisher: repo working trees | n/a | accessed 2026-11-08 | confidence high | class implementation-fact
- claim: Photo structured data differs between passes (server Photograph vs client ImageObject), and BreadcrumbList exists only client-side.
  source: WiSaw.cdk utils.js:143-152 vs PhotosComponent.js:972,1007 | publisher: repo working trees | n/a | accessed 2026-11-08 | confidence high | class implementation-fact

## Leads
- Confirm duration coverage across a sample of /videos/ URLs (cheap curl loop) — decides whether "add interactionStatistic/duration server-side" is one change or two.
- Check Search Console structured-data report for VideoObject errors/warnings (not reachable from here — user action).
- Decide single source of truth for JSON-LD (server) and make the client block conditional or remove it.

## Not found / gaps
- No headless-Chromium render available, so the post-hydration duplicate-JSON-LD claim stays an inference.
- Could not call the authenticated GraphQL API to inspect photo.videoUrl shape (auth required; not attempted).
- Google's rich-results test tool paths 404'd; validation was by reading current docs + JSON parse instead.
