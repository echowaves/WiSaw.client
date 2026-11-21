---
title: 'Make the pre-JS first frame on / look like the app, with no blank interlude'
type: 'feature'
ticket: ''
created: '2026-11-20'
status: 'built'
baseline_revision: '217c1146c92d7d136c559c5bfc87b595a2641c78'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiated">

## Intent

**Problem:** A cold visit to `https://wisaw.com/` shows four visually different pages before the feed appears: unstyled prose (`#root`'s static fallback, painted with only the ~2 KB critical block because the app sheet is deliberately non-render-blocking), then a full-viewport "Loading…" after `src/index.js` empties `#root`, then header + headings over an empty content column once the lazy route chunk lands, then the feed when AppSync resolves. Each swap is a visible flicker on the site's most-visited entry point.

**Approach:** Paint the app's own frame before any JavaScript runs — static header chrome, the existing intro headings styled through the design system, and a reserved feed area — from `index.html` markup plus inline critical CSS; then hand `#root` back only once React has committed the matching route content, reusing the transparent-shell mechanism already built for edge-painted detail pages so no blank or "Loading…" frame is ever shown.

## Boundaries & Constraints

**Always:**
- The pre-JS markup inside the mount point must contain **no closing `</div>`**: Lambda@Edge replaces from `<div id="root">` to the *first* `</div>`, so any nested div corrupts every detail-route document where injection happens. Use `header`/`nav`/`main`/`section`/`figure`/`span` and style them by class.
- Keep exactly one `<div id="root">` literal in the file, and never write a tag name inside angle brackets in an HTML comment (`src/seo.template.test.js`).
- Keep crawlable text in the static body: the h1/h2 copy that `Home.js` also renders stays present and visible pre-JS — it is `/`'s only JS-free content.
- The first frame's geometry must match React's final layout for everything above the feed (header height, 90 %/1120 px column, heading type scale) so replacing the frame shifts nothing measured.
- Detail-route behaviour is untouchable: an edge-painted or captured frame stays byte-intact and adopted exactly as today.

**Never:** no SSR/prerender service, no backend or `WiSaw.cdk` change, no new dependency, no Bootstrap CSS trimming, no change to the async-CSS strategy, no fake photo data or placeholder image URLs in the static markup, no second stylesheet request for the first frame.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Cold `/`, JS enabled | Static shell + critical CSS, app bundle in flight | First paint shows header chrome, styled headings, reserved feed area; frame is replaced once Header+Home commit — never a blank or "Loading…" screen | If the route chunk never arrives, `lazyWithRetry`/error boundary behaviour is unchanged |
| Cold `/photos/:id`, edge painted frame | `#root` holds the edge skeleton | Identical to today: captured, adopted, `#root` byte-intact, app transparent shell | Unchanged |
| Detail route, no injected frame (old cache) | Static app-shaped fallback in `#root` | No capture → app renders normally; static frame removed at handoff, no double heading or double header | Fallback removal guarded when the node is absent |
| `/about`, `/contact`, `/terms`, `/search` | Same single template shell | Frame matches the app chrome; each route's own content replaces it on commit without a blank interlude | Unchanged |
| No JavaScript | Static shell only | Header, headings and prose remain readable and crawlable in both colour schemes | `noscript` block unchanged |
| Stale bundle | Entry script fails to load | Inline reload guard still fires exactly as today; the static frame is what stays visible meanwhile | Unchanged |

## Decisions (human-confirmed)

- Plan size: keep the full plan despite exceeding the 1600-token target — one cohesive goal, splitting would separate coupled first-paint concerns.
- Feed area in the first frame: **neutral placeholder cards** sized by the real column math (`FEED_BREAKPOINT_COLS`, 20 px gutter), no images, `aria-hidden`. No build-time snapshot of feed page 1, and no empty reserved column.
- Header pre-JS: **logo plus nav links as plain anchors** — full chrome at first paint, links functional before hydration.

</frozen-after-approval>

## Code Map

- `index.html` — mount point currently holds `<main><h1><h2>` only; critical `<style>` (~2 KB) already mirrors body colours, `img` rules and header geometry (`#header` sticky, `.header-container` 72 px / 64 px / 480 px padding). Everything here is the first frame.
- `src/index.js:28-35` — clears `#root.innerHTML` at module scope when no skeleton was captured; `captureDetailSkeleton()` runs first; app mounts into `#wisaw-app`.
- `src/utils/detailSkeleton.js` — `captureDetailSkeleton`, `getActiveDetailFrame`, `subscribeDetailSkeleton`, `clearDetailSkeleton`, `isDetailPath`; slot lookup by `[data-wisaw-slot=…]`. Reuse its subscription model rather than adding new state.
- `src/App.js:180-193` — `renderLoadingFallback()` is the 100vh "Loading…" screen; `AppShell:210-310` decides portal/adopted mode, sets `className={adopted ? 'App App--adopted' : 'App'}`, holds the `Suspense` boundary shared by Header + routes, and has `SlotMountNotice` (a sibling that reports its own commit) plus a `useLayoutEffect` that clears the frame on non-detail paths.
- `src/containers/Home.js:209-229` — the real h1/h2 inline styles (`clamp(1.75rem,4vw,2.5rem)`/`--text-primary`; `clamp(1.1rem,2.5vw,1.5rem)`/`--text-secondary`) then the search row; text is identical to the static fallback's.
- `src/containers/FeedGrid.js:130-176` — final feed DOM: `<main>` flex/centered → wrapper `max-width:1120px;width:90%` → children → `.masonry-grid`/`.masonry-grid-column`.
- `src/containers/PhotosComponent.css:214-232,344-368` — `.home-thumb-card` (`--radius-xl`, `--bg-card`, `--shadow-thumb`); `.masonry-grid{margin-left:-20px}`; columns `flex:1 0 0%;padding-left:20px`; `column>div{margin-bottom:20px}`.
- `src/utils/imageUtils.js:10-41` — `FEED_BREAKPOINT_COLS {default:4,1100:3,700:2,500:1}`, 20 px gutter, 90 %/1120 px container: the column math a reserved grid must agree with.
- `src/containers/Header.js:28-46` + `Header.css:99-148` — `<header id="header"><div class="header-container">` → `.logo-link` (flex, gap 12) → `.logo-icon` 44×44 `--radius-md`/`--bg-raised`/`1px solid var(--border)`, `.logo-title` 1.5rem/800 `--wordmark`, `.logo-subtitle` .7rem/500 `--text-muted`.
- `src/index.css:6-56,58-80` — tokens the critical block must spell out literally (`var()` is undefined pre-sheet): `--bg #f5f7fb`, `--bg-raised #fff`, `--bg-card #eef2f8`, `--border rgba(15,23,42,.12)`, `--text-primary #111827`, `--text-secondary #4b5563`, `--wordmark #3f4bd8`, `--radius-md 10px`, `--radius-xl 18px`, plus dark counterparts.
- **Pins to update deliberately:** `src/a11yLandmarks.test.js:300-321` (fallback shape regex `^<div id="root">\s*<main>\s*<h1>`, critical-CSS selector pins, injector-span test), `src/index.boot.test.js:80-92` ("no skeleton → `#root` empty at boot"), `src/lcpBootstrap.template.test.js:135-183` (critical block must keep `scrollbar-gutter:stable`, `img{max-width:100%}`, dark scheme, `#f5f7fb`/`#111113`, sticky `#header`, both header border values, `.header-container` heights equal to `HEADER_DESKTOP_PX`/`HEADER_MOBILE_PX`).
- **Do not change:** `src/build/vite-plugin-async-css.js`, `src/seo.template.test.js` invariants (single mount literal, no tag names in comments), the LCP preload/swap scripts, `src/utils/detailSkeleton.js` capture semantics.

## Tasks & Acceptance

**Execution:**
- [ ] `index.html` — replace the mount-point fallback with app-shaped chrome + styled intro headings + reserved feed area using non-div elements only; extend the critical `<style>` with the tokens and geometry those nodes need (light + dark). Keep the single mount literal and every existing script block byte-identical.
- [ ] `src/index.js` — stop clearing `#root` at module scope on the no-skeleton path; mark the fallback so ownership can be handed back after React commits, and keep clearing when a frame was captured impossible/absent per the boot tests.
- [ ] `src/App.js` — while the static frame is still live for a non-detail route, use the transparent shell (`App--adopted`) and do not paint the 100vh "Loading…" over it; remove the fallback in one step once the shared Suspense boundary has committed Header + route content (reuse `SlotMountNotice`-style signalling), and leave detail-route behaviour alone.
- [ ] `src/index.boot.test.js` — re-pin the no-skeleton branch for the new handoff (frame handed back, app still mounts into `#wisaw-app`, boot survives with no mount point).
- [ ] `src/a11yLandmarks.test.js` — update the fallback-shape and critical-CSS pins to the new markup, and add a pin that the injector's replaceable span is still exactly the mount point (no closing div inside the static body) plus one landmark only.
- [ ] `src/lcpBootstrap.template.test.js` — extend the critical-block pins to cover the new first-frame rules while keeping every existing assertion green.

**Acceptance Criteria:**
- Given a cold load of `/` with JavaScript enabled, when the first frame paints, then header chrome and the intro headings are visible in the app's own type scale and colours (no unstyled prose), and no full-viewport "Loading…" screen is ever painted before the feed arrives.
- Given the same load, when React's route content commits, then the static frame is gone in that same frame — a visitor never sees an empty page or two headers or two h1s at once.
- Given everything above the feed, when comparing the static frame with the hydrated page, then header height, column width and heading positions match, so no element above the feed moves.
- Given `/photos/:id` served with an edge-painted frame, when the app boots, then behaviour is byte-for-byte what it is today (captured, adopted, `#root` untouched).
- Given JavaScript disabled, when `/` is fetched, then the h1/h2 copy and site chrome text are still present in the served HTML.

## Implementation Notes

Full route: ~300–400 lines across 6 files (index.html markup + critical CSS, boot handoff in index.js/App.js, three test re-pins), touching the first-paint path of every route — hence a coding subagent plus review lenses. Risk `medium`: a mistake here is visible site-wide on first paint or corrupts edge-injected detail documents, but it is bounded by contract tests that already pin the injector's span and the critical block.

**Frame chrome is frame-scoped.** Everything the frame owns is named `ff-*` (`ff-bar`, `ff-logo-link/-icon/-text/-title/-subtitle`, `ff-nav`, `ff-nav-link`, `ff-actions`, `ff-hamburger`, `ff-search`, `ff-page`, `ff-column`, `ff-title`, `ff-lede`, `ff-feed`, `ff-card`). Only `#header` and `.header-container` keep their app names, because the edge-painted detail path styles the real header from this block; the frame's wrapper carries both classes (`class="ff-bar header-container"`) so both sheets give it the same box. A pin asserts the critical block no longer mentions `.logo-link/.logo-icon/.logo-title/.logo-subtitle`.

**Four header children, in Header.js's order.** `.header-container` distributes with `justify-content: space-between`, so positions depend on child count: two children put the nav flush right, and it slid left when React painted three. The frame now reserves logo, nav, actions and hamburger like `Header.js` does. Sizes are pinned to `Header.css` (`.theme-dropdown-icon` 30×30 → 28×28 at ≤768px, `.theme-dropdown{gap:8px}` → 6px, `.header-actions{margin-left:12px}`, `.hamburger-menu` 26×18 with 4px padding, hidden above 768px). Two values cannot be derived from CSS because the app sizes them by content, and are documented approximations instead of pins: the theme `<select>`'s width (`.ff-actions-control`, 68/62px from its 12+34px horizontal padding) and the search field/button widths.

**The hamburger is painted, not built**: one `span` with a `repeating-linear-gradient` of three 2px bars in `--accent` (#7c8cf8, not redefined in dark mode), so the reservation costs no extra nodes inside the injector's span.

**The search row is reserved** between the lede and the grid at the height Bootstrap computes (1.5em line box + .75rem padding + 2px border = 38px) over Home.js's 10px bottom padding, right-aligned — without it everything from that row down stepped ~48px at handoff.

**The feed reservation is route-aware.** A parser-inserted `data-wisaw-feed` script in `<head>` marks any path that never renders a grid and the critical block hides `.ff-feed` there; classic and inline on purpose, since a deferred or module script would let the cards paint first and then vanish. The intro copy deliberately stays on every route: `HEAD:index.html` already served that same h1/h2 inside `#root` on every path, so the frame introduces no new crawlable text anywhere — only the placeholder gallery needed hiding.

**Handing the frame back is idempotent and reachable from three places**: the layout effect, its cleanup, and `AppErrorBoundary.componentDidCatch`. The third is not redundant — a chunk that fails during the *first* commit never mounts `StaticFrameHandoff`, so nothing else can clear the frame before the error panel renders. The helpers moved to `src/utils/staticFrame.js` so the boundary can reach them without importing App.js (no cycle; App re-exports the attribute name for existing test imports). The boundary only clears `#root` while the frame attribute is set, so edge-painted detail markup still survives a late crash.

**Critical block cost**: ~7.5 KB of rules (4.4 KB gzipped including comments) inlined into every served document; the size pin was raised 6500 → 8000 to cover the reserved chrome and pre-grid geometry it now mirrors.

**Not verified in a browser here.** Puppeteer cannot start Chrome inside this sandbox (`bootstrap_check_in … Permission denied`), so the layout-level claims (space-between distribution, flex heights, gradient bars) rest on the value-for-value pins against `Header.css`, not on measured boxes. `files/hff-check.mjs` in the session folder compares frame vs hydrated rectangles for `/`, `/about` and `/search/lake` at 1440/500/380px — run it against `npx vite preview --port 4187` from outside the sandbox for the numbers.

## Plan Change Log

- 2026-11-20, patch pass after the `quick` lens (iteration 0): applied G1–G6. Frame chrome renamed to `ff-*`; header reserves all four `Header.js` children and nav links carry their transparent border; the search row is reserved at its real height; a parser-inserted script hides the feed reservation on routes without a grid; the wrapper is a `section`, not a `span`; the release now also runs from the handoff's cleanup and from `AppErrorBoundary.componentDidCatch` via new `src/utils/staticFrame.js`. No intent or scope change — same acceptance criteria, more of them covered. Suite 256 → 259 tests; critical block 7.5 KB of rules.

## Review Triage Log

Lens `quick` run as a subagent (pass 1, iteration 0) against the plan, the agent instructions and the staged diff. 9 findings, grouped into 6 entries by root cause; no intent_gap or bad_plan, so all route to `patch`.

- **G1 `medium`** (nav flush right / nav box 2px smaller / no mobile header control / search row not reserved) — the frame mirrors only part of what React paints above the grid. `.header-container` is `justify-content: space-between`, but the frame has two children where `Header.js` has three (`.logo-container`, `nav.nav-menu`, `.header-actions`), so the nav slides sideways at handoff; `.ff-nav-link` omits `.nav-menu a`'s 1px transparent border; below 768px the app paints a hamburger the frame does not reserve; and `Home.js:230` renders the search row between the h2 and the grid, which the frame skips, so everything from that row down steps ~48 px. Violates AC3 for header chrome and the pre-grid content.
- **G2 `medium`** (route-blind feed reservation) — one template serves every route, so `/about`, `/contact` and `/terms` ship ~600 px of placeholder gallery that collapses in one step at handoff and reads as a fake gallery to a no-JS crawler. Those routes render no `FeedGrid`.
- **G3 `medium`** (frame stranded above the error panel) — `StaticFrameHandoff` releases only on mount; when a lazy chunk fails after the reload cooldown, `AppErrorBoundary` replaces `AppShell` and `#root` keeps the frame, which is exactly what `AppErrorBoundary.js:4-6` promises cannot happen and contradicts matrix row 1. Verified: the boundary never touches `#root`, and `window.__wisawBooted` is set at `index.js:11`, so the inline guard's safety net cannot fire either.
- **G4 `low`** (invalid nesting) — `<nav>` inside `<span class="header-container">`: `span` accepts phrasing content only, so the served document fails content-model validation even though it renders correctly.
- **G5 `low`** (frame rules on app-owned classes) — `.logo-link/.logo-icon/.logo-title/.logo-subtitle` in the critical block outlive hydration: a class rule beats `index.css`'s `a { color: var(--link) }`, and its dark counterparts follow `prefers-color-scheme` while the app's theme is `[data-theme]`. Masked today because the title/subtitle set their own colours, but it breaks the block's own "stay inert post-hydration" rule.
- **G6 `low`** (prose contradicts markup) — the frame comment and two test comments say "no image URLs of any kind" while the logo `<img>` is one.

All six applied in the patch pass recorded above: G1 (four header children, nav border, hamburger and search-row reservations), G2 (`data-wisaw-feed` route marking), G3 (idempotent release from three call sites), G4 (`section.ff-bar` wrapper), G5 (`ff-*` scoping plus a pin against app-owned selectors), G6 (comments now say "photo or media URLs"). Each carries a pin: `src/lcpBootstrap.template.test.js` for the served geometry, `src/a11yLandmarks.test.js` for the handoff and the error path, `src/index.boot.test.js` for boot.

## Verification

**Commands:**
- `npx vitest run src/index.boot.test.js src/a11yLandmarks.test.js src/lcpBootstrap.template.test.js src/seo.template.test.js src/feedLayoutParity.contract.test.js src/detailGeometry.contract.test.js` -- expected: all pass
- `npx vitest run` -- expected: full suite green (baseline 2026-11-20 is green)
- `npm run lint` -- expected: no new errors in touched files (11 pre-existing errors live in `src/setupTests.js`)
- `npm run build` -- expected: build succeeds and `postbuild` edge-injector template contract test passes

**Manual checks:**
- DevTools Network throttled to Slow 3G + hard reload of `/`: first frame shows chrome + headings, then the feed; no unstyled-text frame, no "Loading…" screen, no blank flash.
- Same load on `/photos/<id>`: edge-painted page unchanged (media paints pre-JS, header takes over its slot without jumping).
- Disable JavaScript: `/` still shows header text, h1 and intro prose readably in light and dark.
