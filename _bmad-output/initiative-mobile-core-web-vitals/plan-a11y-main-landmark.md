---
title: 'Give every route exactly one main landmark so axe landmark-one-main passes'
type: 'bugfix'
ticket: ''
created: '2026-11-20'
status: 'built'
baseline_revision: '14d105005da70cd71859376df4c3739029ea8cf3'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: ['.github/copilot-instructions.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** An axe audit of wisaw.com fails `landmark-one-main`: every route except `/photos/:id` and `/videos/:id` renders its page body in plain `<div>`s, so a screen-reader user has no main landmark to jump to. Only the detail route exposes one (`<main className='content-container' role='main'>`).

**Approach:** Promote each route's existing outermost content element from `<div>` to `<main>` — same node, same classes and inline styles, new tag name — rather than inserting a wrapper, and move each page's `<Footer />` out of that element so `contentinfo` stays top-level. Wrap the no-JS fallback inside `#root` in `index.html` too, extending the critical-CSS guards that key on `#root > …`.

## Resolved Decisions

1. **Route root becomes `<main>`; `<Footer />` leaves the landmark** and becomes a fragment sibling, as it already is on `/about`, `/contact` and `/terms`. The footer band on `/search` and on `NoMatch` therefore goes full-bleed instead of sitting inside the 90%/1120px column; its inner content stays centred.
2. **Pre-hydration detail pages are out of scope.** `.wsk-main` is a `<div>` in the shared edge template, so a cold `/photos/:id` deep link still has no landmark until React commits — recorded in `deferred-work.md` as coordinated cross-repo work, not patched client-side.
3. **Pinned by a jsdom route-render test** that mounts the real `<App />` per route using the seam test's mock harness; no source-text-only contract test.

## Boundaries & Constraints

**Always:**
- Exactly one main landmark per document in every rendered state (loading, results, empty, 404), and no `contentinfo`/`banner` nested inside it.
- Tag-name promotion only: keep every className, inline style and DOM position so no box changes — this initiative's CLS work must not regress.
- Keep `<main className='content-container' role='main'>` in the detail view byte-identical; it is the anchor several geometry tests measure against.
- StandardJS style (no semicolons, single quotes, 2-space indent), plain CSS, JavaScript only.

**Never:**
- No new wrapper element and no `display:contents` — deferred-work already flags older WebKit dropping a `display:contents` subtree from the a11y tree.
- No edit to `src/utils/detailTemplate.generated.js`, the WiSaw.cdk skeleton, or any `<style>`/`<script>` block in `index.html` beyond the fallback markup and its selector guards.
- No change to the single `<div id="root">` anchor or to any comment that mentions it — `src/seo.template.test.js` pins both.
- No new npm dependency (no axe runner), no CSS-in-JS, no TypeScript, no class components.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|--------------------------- | ----------------|
| Home hydrated | `/` with feed loaded | one `<main>` wrapping the h1/h2/search/feed column; no footer on this route | n/a |
| Search, all three states | `/search`, `/search/<term>` loading → results → "Nothing found" | a main landmark exists in each state, including `initial-loading-container` | GraphQL failure still renders the empty state inside main |
| Static routes | `/about`, `/contact`, `/terms` | `<main class="container">` wraps the copy; `<Footer />` is a sibling of main, not a descendant | n/a |
| 404 | `/photos/<id>` whose record is missing → `NoMatch` (an unknown URL redirects to `/`, so this is the only route to `NoMatch`) | one `<main>` around the message, footer outside it | n/a |
| Detail deep-link placeholder | `/photos/<id>`, record still in flight, no edge skeleton in the mount point | exactly one main — the existing `content-container` carrying `role="main"`; nothing new added | n/a |
| Detail page with no record | `getPhotoAllCurr` answers `photo: null` | one main, contributed by `NoMatch`, footer outside it | n/a |
| Settled detail page | full record painted from the shared template | **unchanged by this plan**: zero landmarks — `.wsk-main` is a `<div>` in `detailTemplate.generated.js`; tracked as cross-repo work in `deferred-work.md` | n/a |
| Pre-hydration fallback | JS off or bundle in flight | `<main>` wraps the `#root` h1/h2 and keeps its column width; the first `</div>` after the mount anchor is still `#root`'s own, so an injection pass replaces the same span | n/a |

</frozen-after-approval>

## Code Map

- `src/containers/Home.js:325` — the route's only root child: a full-width flex `<div>` holding `RouteSeo`, JSON-LD `Helmet` blocks and the 1120px column. Home renders no Footer.
- `src/containers/SearchComponent.js:381` — settled-page root div (same flex wrapper) whose inner column ends with `<Footer />`; `:441` — the `requestComplete === false` branch, root `<div className='initial-loading-container'>`. `.initial-loading-container` is styled by class only (`PhotosComponent.css:312`).
- `src/containers/About.js:14`, `Contact.js:14`, `Terms.js:14` — fragment whose first child is `<div className='container'>` and whose last is a lazy `<Footer />`; the footer is already outside the container here.
- `src/containers/NoMatch.js:21` — one centred `<div style={{textAlign:'center', padding:'60px 20px'}}>` holding the h2 **and** `<Footer />`.
- `index.html:47-59` — critical-CSS guards `#root > h1, #root > p, #root > nav`, `#root > h1 { margin-top }`, `#root > img`: direct-child selectors that style both the edge's flat static-route body and this fallback. `:257-262` — the fallback `<h1>/<h2>` inside `#root`; `:263` — sibling `<div id="wisaw-app">`.
- `src/seo.template.test.js:45-97` — pins exactly one `<div id="root">`, forbids `</?div` inside any comment, and simulates the injector by cutting from the anchor to the **first** `</div>`. A `<main>` adds no `</div>`, so the span is unchanged.
- `src/containers/detailSkeleton.seam.test.js:12-43` — the harness to copy for a route-render test: `vi.mock('../consts')` with a stub `gqlClient.query`, mock `react-ga4`/`./Header`/`./Footer`, `window.history.pushState`, then `render(<App />, { container: document.getElementById('wisaw-app') })`.
- **Do not touch:** `src/utils/detailTemplate.generated.js`, `src/utils/detailSkeleton.js`, `src/containers/detailSkeleton.seam.test.js`, `src/containers/PhotosComponent.fullMedia.test.js`, `src/containers/PhotosComponent.css` (`.content-container` geometry), `WiSaw.cdk/tests/static-route-copy-once.js` inputs.

## Tasks & Acceptance

**Execution:**
- [ ] `src/containers/Home.js` — root flex `<div>` → `<main>`, styles unchanged.
- [ ] `src/containers/SearchComponent.js` — both rendered roots → `<main>`; move `<Footer />` out of main into the returned fragment so it sits beside main.
- [ ] `src/containers/NoMatch.js` — centred div → `<main>`; `<Footer />` becomes a fragment sibling after it.
- [ ] `src/containers/About.js`, `Contact.js`, `Terms.js` — `<div className='container'>` → `<main className='container'>`; footer already outside.
- [ ] `index.html` — wrap the fallback h1/h2 in `<main>`; extend the three critical-CSS guard groups to also match `#root > main > …` (keep the direct-child forms for edge-injected flat markup); update that block's comment without ever writing a `div` tag into it.
- [ ] `src/a11yLandmarks.test.js` (new) — render real `<App />` per route in jsdom and assert one main landmark, no landmark nested inside it, and the detail route still yields exactly one; must fail before the JSX edits.

**Acceptance Criteria:**
- Given each of `/`, `/search`, `/search/<term>`, `/about`, `/contact`, `/terms` and an unknown path, when `<App />` renders, then the document holds exactly one main landmark and no `contentinfo` inside it — proven by `npm test`.
- Given `/photos/:id` in its deep-link placeholder and missing-record states, when they render, then exactly one main exists and no second is added. The settled page is deliberately untouched by this plan — it keeps zero landmarks until the shared edge template moves (deferred) — and every pre-existing geometry/seam test stays green.
- Given `index.html`, when the injector's cut-to-first-`</div>` simulation runs, then the entry script, stylesheet link and all guard attributes survive and the fallback text keeps its 1100px column.
- Given `npm run lint` and `npm test`, when the change is complete, then both pass with no new problems beyond the recorded `src/setupTests.js` baseline.

## Implementation Notes

Planning decision: the plan lands at ~2,700 tokens, over the 1,600 guideline. The human chose to keep it whole rather than split the `index.html` work off — one axe rule, one deploy. Respect that; do not re-propose a split.

Implemented on-thread: subagent dispatch is unavailable in this session (every `task` launch returns `400 The requested model is not supported`, same failure recorded in plan-a11y-color-contrast.md), so the handoff ran here rather than in a fresh context.

**Premise error found while testing, reported to the human before review.** The frozen block states the detail route already exposes one main and only its loading placeholder turned out to. A settled `/photos/<id>` page — adopted or client-painted — renders its column as `<div class="wsk-main">` from `src/utils/detailTemplate.generated.js:162`, so it has **zero** main landmarks. Measured in jsdom with a fully resolved record: `mainCount: 0`, `.wsk-main` present, tagName `DIV`. The matrix row "Detail route, client-rendered → exactly one main" is therefore false for the settled page; the two detail states that do pass are the deep-link placeholder (`content-container`) and the missing-record state (NoMatch's own main). Fixing the settled page means the shared edge template, which this plan's **Never** list forbids touching — hence the question put to the human.

Test harness notes: route chunks are dynamic imports, so `flush` polls real task turns until a landmark appears; `react-loader-spinner` cannot mount under jsdom and is stubbed as in `src/staticRouteCopy.contract.test.js`; Header/Footer are stand-ins so any landmark inside `<main>` must come from a route component. Negative control run: reverting Home's root, the search loading container, About's container and the `index.html` fallback to `<div>` fails exactly those four tests plus the feed-failure case; restored afterwards and green. the plan lands at ~2,700 tokens, over the 1,600 guideline. The human chose to keep it whole rather than split the `index.html` work off — one axe rule, one deploy. Respect that; do not re-propose a split.

## Plan Change Log

## Review Triage Log

Quick lens (`review: 'quick'`, pinned) over the diff at `14d1050..working tree`. Unlike the step-03 handoff, the lens subagent did launch this time; it reported one finding.

| # | Finding | Disposition |
|---|---------|-------------|
| Q1 | The critical-CSS guards cover `#root > main > h1 / p / nav / img` but not the fallback's `<h2>`, so the matrix row's "keeps its column width" held only for the `h1`; the new test asserted just the three guarded groups and could not see the gap | **patched** — verified at the cited lines: `git show HEAD:index.html` never guarded an `h2` either, so a full-bleed fallback `<h2>` is pre-existing, but this change is what moves that `<h2>` inside the landmark the guards exist to cover, and the intent line promises the fallback keeps its column. Fix kept to the `main` form only (`#root > main > h2`), so no edge-injected flat markup changes shape, and the test's guard assertion now pins the full selector list — deleting the added selector fails it. Re-verified after patching: 223 tests green, lint at the recorded 17-problem baseline, `vite build` + postbuild contract green |

## Design Notes

The outer wrapper is a flex **row**, so `<Footer />` cannot stay inside it as a second flex item — it would sit beside the content column. Hence footer leaves main entirely and the route returns a fragment:

```jsx
<>
  <main style={{ display: 'flex', width: '100%', position: 'relative', justifyContent: 'center' }}>
    …existing children unchanged…
  </main>
  <Footer />
</>
```

## Verification

**Commands:**
- `npx vitest run src/a11yLandmarks.test.js` — expected: green after the edits; run it once **before** them to confirm it fails.
- `npm test` — expected: all suites pass, including `seo.template.test.js`, `index.boot.test.js`, `detailSkeleton.seam.test.js`, `detailGeometry.contract.test.js`, `a11yContrast.contract.test.js`.
- `npm run lint` — expected: no new problems (baseline is 17 pre-existing repo problems).
- `npm run build` — expected: build succeeds and `postbuild` template contract stays green.

**Manual checks:**
- `npm start`, then `/`, `/search/cat`, `/about`, a bogus path: footer band renders as on `/about` (full-bleed, content centred) and no element moved versus the pre-change page; WAVE/axe reports zero `landmark-one-main` findings.
