---
title: 'Make /search routes indexable'
type: 'feature'
ticket: ''
created: '2026-11-16'
status: 'built'
baseline_revision: '095a3ac227aa017f21c843204b16fbe798ad3f0e'
route: 'oneshot'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Every `/search` and `/search/<term>` URL is served with `x-robots-tag: noindex, follow`, `cache-control: private, no-cache` and a body robots meta of `noindex, follow`, so Google cannot index the search routes even though prerendered media bodies already link up to eight `/search/<label>` tag pages. Search results were excluded as doorway-page avoidance; the product decision is now reversed — every content route on wisaw.com must be indexable.

**Approach:** Flip the single `noindex` flag on the `/search` entry of the backend route table (`WiSaw.cdk/lambda-fns/lambdas/injectMetaTagsLambdaFunction/static.js`), which is the only site route still excluded — `/`, `/about`, `/contact`, `/terms`, `/photos/:id` and `/videos/:id` already emit `index, follow`. Re-publish the table into the app with `scripts/publish-static-seo.js` so the first byte and the hydrated head stay identical, and give a search term a description that differs from its title instead of repeating it.

## Decisions (human-confirmed)

- Search copy: keep the title template `WiSaw: searching for {term}`; author a distinct `descriptionTerm`.
- 404 documents (`public/404.html`, the edge's not-found document, `src/containers/NoMatch.js`) keep `noindex` — error pages are not content routes.
- Version control: feature branch + local commit in **each** repo; no push and no CDK deploy.

</frozen-after-approval>

## Implementation Notes

Oneshot route: ~40 lines across 4 files (2 per repo), mechanical flag flip plus the tests that pin the old value, so it is implemented directly here rather than through a coding subagent.

Facts from investigation worth carrying into implementation:
- `static.js` handler derives `cacheControl` from `head.noindex`, so flipping the flag also moves `/search/*` from `private, no-cache` to the shared `max-age=900`. No extra edit.
- Body robots meta and `X-Robots-Tag` are both derived from the same `noindex` option in `utils.js` (`injectRouteTags` / `htmlResponse`), so header and body cannot disagree.
- `escapeHtmlAttribute` already wraps injected title/description, so quoting or long terms in `descriptionTerm` stay attribute-safe; React escapes them on the app side.
- Tests that currently pin the exclusion: `WiSaw.cdk/tests/static-route-copy-once.js` (term head values + "says noindex … for every search URL") and `WiSaw.client/src/staticRouteCopy.contract.test.js` (two `/search` cases). `WiSaw.cdk/tests/inject-meta-tags.js`, `seo-crawler-contract.js`, `edge-detail-truthfulness.js` exercise generic robots/404 paths and must keep passing unchanged.
- Do not hand-edit `WiSaw.client/src/utils/staticSeo.generated.js`; regenerate it, or `tests/static-route-copy-once.js` fails on the byte-for-byte comparison.

During implementation:

- Baselines — WiSaw.client `095a3ac227aa017f21c843204b16fbe798ad3f0e`, WiSaw.cdk `1963e31484cc34af52dbed693aadd1725b75cb54`. Both repos got a `feat/index-search-routes` branch; nothing pushed, no deploy.
- Backend: `/search` flipped to `noindex: false`, `descriptionTerm` authored separately from `titleTerm`, and the doorway-pattern comment rewritten so it no longer contradicts the table. Handler untouched — the `private, no-cache` → `max-age=900` move follows from the existing `head.noindex ? … : …` expression.
- Client: `src/utils/staticSeo.generated.js` regenerated with `node scripts/publish-static-seo.js`; only `src/staticRouteCopy.contract.test.js` was hand-edited, and its description expectations now read through `staticHead('/search', term)` instead of restating authored copy.
- Pre-existing failure reproduced at baseline (change stashed): WiSaw.cdk `tests/edge-detail-truthfulness.js` → "names production when nothing is configured". Everything else passes: 79 + 102 backend, 167 client tests across 15 files; `npm run lint` adds no new problems (its 11 errors are all in `src/setupTests.js`).

## Verification

**Commands:**
- `cd ../WiSaw.cdk && node scripts/publish-static-seo.js` -- expected: `wrote .../WiSaw.client/src/utils/staticSeo.generated.js`
- `cd ../WiSaw.cdk && npx mocha --exit --require @babel/register tests/static-route-copy-once.js tests/inject-meta-tags.js --timeout 30000` -- expected: 0 failures, and the search block now asserts `index, follow` + cacheable
- `npm run lint` -- expected: no new errors
- `npx vitest run src/staticRouteCopy.contract.test.js src/seo.template.test.js` -- expected: all pass; `/search` cases expect `ROBOTS_INDEX`, 404 case still expects `noindex, follow`

**Manual checks:**
- `git -C ../WiSaw.cdk diff` and `git diff` show only the route-table flag/comment/description plus test expectations — no hand-written copy in the app repo.
- Live `curl -I https://wisaw.com/search/volleyball` still shows `noindex` until the Lambda@Edge injector is redeployed from WiSaw.cdk by the user; state that rather than treating it as a failure.

## Review Triage Log

Lens `quick` was run inline on this thread (project execution constraint: no subagents), against the plan, both repos' agent instructions and the combined diff.

- `defer` — `/search/<term>` with zero results is now served `index, follow`, so Google can call an empty result page a soft 404. Real, but it is the consequence of the human decision to index every route, and the only "fix" (client marks empty results noindex) would put the body meta against `X-Robots-Tag`, which `utils.js` explicitly forbids. Evidence: `static.js` handler has no data access; `utils.js` comment on the robots meta. Recorded in deferred work.
- `defer` — search tag pages are not in `sitemap.xml`, so indexation depends on the `/search/<label>` links prerendered into media bodies. Real but pre-existing and low impact now that those links point at indexable targets. Recorded in deferred work with what would settle it (Search Console page report).
- `false` — "`tests/edge-detail-truthfulness.js` bucket test fails". Reproduced identically at baseline with the change stashed; warn-once state in `imgBucket()`, nothing to do with this diff. Rejected.
- `false` — "lint errors introduced". The 11 remaining eslint errors are all in `src/setupTests.js`, untouched by this change; the touched files are clean. Rejected.
