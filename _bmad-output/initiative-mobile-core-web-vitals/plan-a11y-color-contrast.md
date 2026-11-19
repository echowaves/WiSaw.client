---
title: 'Bring every text/surface pair in the app stylesheet up to WCAG AA contrast'
type: 'bugfix'
ticket: ''
created: '2026-11-18'
status: 'built'
baseline_revision: '4290fc0de7ee009094d3114aa66e504d100b359d'
route: 'full'
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

**Problem:** An axe colour-contrast audit of wisaw.com fails site-wide, and the measurements confirm it against the current palette: global link colour `--accent-light` (#b0b8ff) is **1.76:1** on the page background, so *every* inherited anchor fails — including the detail frame's `<a rel="tag">` chips and its `<nav><a href="/">` link, which carry no class of their own; white on `.button`/`.btn-primary` (#7c8cf8) is **3.02:1**; `--text-muted` is **4.30:1** on card surfaces (footer links); moderation red #f87171 is **2.46:1**; the two gradient-clipped wordmarks are **1.4–1.8:1**. WCAG 1.4.3, every route.

**Approach:** Fix it in the palette, not per-element. Add semantic *text* tokens to `src/index.css` (link, link-hover, button background + hover, danger) that are contrast-safe on the surfaces they actually sit on, correct in both light and dark themes, and repoint the failing text consumers at them — leaving `--accent-light` / `--mint` for decorative fills, borders and glows, where contrast does not apply.

## Resolved Decisions

1. **Wordmark goes solid.** `.logo-title` and `.footer-bottom .brand-text` lose the `background-clip: text` treatment entirely (all four declarations, both themes) and take one token per theme, so auditors can measure them and the reported brand-link failure clears outright.
2. **Darken the shared muted token** (`--text-muted`) rather than repointing individual consumers — one edit, every muted string site-wide reaches AA on card surfaces too.
3. **Moderation chips stop scaling text opacity.** Confidence stays encoded in font-size and weight; the `opacity` declaration comes out of the chip's inline style so the red is measured at full strength.

## Boundaries & Constraints

**Always:**
- Keep every existing brand hue recognisable; change lightness, not hue family.
- Every text/surface pair must reach **4.5:1** normal text / **3:1** large text (≥24px, or ≥18.66px bold) in *both* themes, including translucent backgrounds composited over what is behind them.
- Keep `src/index.css` `:root` as the single source of colour; components reference tokens only — no new hex literals in components.
- Keep the dark theme's existing passing values (links there are 10:1) rather than "fixing" them.

**Never:**
- No change to `src/utils/detailTemplate.generated.js`, the WiSaw.cdk skeleton, or the critical inline `<style>` block in `index.html` — the failing text is styled entirely by the async app stylesheet, and both are pinned by copy-once/template contract tests.
- No new npm dependency (no axe/jsdom contrast runner), no CSS-in-JS, no TypeScript, no class components.
- No layout, geometry, spacing or CLS-affecting edits: colour declarations only.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|--------------------------- | ----------------|
| Light theme link | `prefers-color-scheme: light`, no `data-theme` | Links, tag chips and the detail frame's home nav render at ≥4.5:1 on page, card and raised surfaces | n/a |
| Dark theme link | `prefers-color-scheme: dark`, no `data-theme` | Links keep a passing pair (≥7:1); muted text passes ≥4.5:1 on bg, raised and card | n/a |
| Forced theme | `[data-theme='light']` / `[data-theme='dark']` | Same ratios as the matching media-query block — all four theme blocks carry identical token sets | n/a |
| Pre-hydration edge paint | App stylesheet still in flight | Unchanged: UA default link colours, no FOUC of unreadable text | n/a |

</frozen-after-approval>

## Code Map

Measured ratios are computed from the literals below (WCAG relative-luminance formula), light theme unless noted.

- `src/index.css` -- **the palette.** `:root` (:6-42) defines `--accent-light #b0b8ff`, `--mint #5ee9b5`, `--text-muted #6b7280`; duplicated in the dark media block (:46-63), `[data-theme='light']` (:65-82), `[data-theme='dark']` (:84-101) — four places, all must stay in step. Global `a { color: var(--accent-light) }` (:135, **1.76 FAIL**), `a:hover { color: var(--mint) }` (:141, **1.42 FAIL**), `::selection { color:#fff }` (:177).
- `src/containers/PhotosComponent.css` -- `.button` `background:var(--accent); color:#fff` (:30-33, **3.02 FAIL**) and its @media copy (:200 geometry only, no colour — do not touch); `.recognition-tags a` (:101-115) pale-on-card **1.68 FAIL** + `:hover` white-on-accent **3.02 FAIL**; `.text-detection` (:179, 1.88); `.moderation-labels` `#f87171` (:184, 2.46); `.btn-primary` white-on-accent (:268-272, 3.02). Reuse: `.button:hover` already uses `--accent-dark` (#5a6ae0, 4.59 pass).
- `src/containers/Header.css` -- `.logo-title` gradient-clipped wordmark (:132-140, **1.4–1.8 FAIL**); `.logo-subtitle` muted on header bg; `.nav-menu a.active { color: var(--accent-light) }` on `--bg-raised` (:190-193, **1.88 FAIL**).
- `src/containers/Footer.css` -- footer bg is `--bg-card`, so `.link-group a`/`.footer-links a` muted = **4.30 FAIL** (:98), their `:hover` → `--accent-light` (**1.68**), `.hashtag` (:111, 1.68), `.copyright` (:151), `.brand-text` gradient wordmark (:157-162).
- `src/containers/PhotosComponent.js` -- inline colours: `'var(--accent-light)'` on the "Recognized Text" h3 at 18px/700 (:1073, below the large-text bar); `#f87171` moderation heading + chips (:1131, :1158) where chips also scale `opacity: max(0.6, conf/100)` — at α=0.6 the effective pair is **2.83**; `#ffffff` on `rgba(0,0,0,.75)` (:221) passes, leave it.
- `src/App.js:187` -- route fallback "Loading..." in `--accent-light` (**1.76 FAIL**).
- `src/containers/About.js:55`, `src/containers/NoMatch.js:24` -- inline `var(--accent-light)` link/code colour.
- `src/containers/detailSlotStyles.contract.test.js` -- the pattern to copy for a source-level CSS contract test (jsdom applies no stylesheet here, so assert on the file text).
- `src/lcpBootstrap.template.test.js`, `src/utils/detailTemplate.generated.js`, `index.html` critical block -- **guarded, do not edit.**

## Tasks & Acceptance

**Execution:**
- [ ] `src/index.css` -- add `--link`, `--link-hover`, `--btn-bg`, `--btn-bg-hover`, `--danger-text` (and wordmark stops if chosen) to all four theme blocks; darken light `--text-muted`; repoint `a` / `a:hover` at `--link` / `--link-hover` -- token change is the whole fix for every inherited-anchor failure in the report.
- [ ] `src/containers/PhotosComponent.css` -- point `.button`, `.button:hover`, `.btn-primary(+hover)`, `.recognition-tags a(+hover)`, `.text-detection`, `.moderation-labels` at the new tokens; keep geometry untouched.
- [ ] `src/containers/Header.css` -- `.nav-menu a.active` → `--link`; wordmark and `.logo-subtitle` per the Open Question answers.
- [ ] `src/containers/Footer.css` -- footer links/hover/hashtag/copyright/brand-text onto tokens.
- [ ] `src/containers/PhotosComponent.js`, `src/App.js`, `src/containers/About.js`, `src/containers/NoMatch.js` -- swap the inline `--accent-light` / `#f87171` text colours for the new tokens; apply the moderation-chip opacity answer.
- [ ] `src/a11yContrast.contract.test.js` (new) -- source-level contract test: parse the palette out of `src/index.css` plus the colour-bearing rules of the three component stylesheets, composite any translucent/`rgba` background over its parent, and assert every text/surface pair ≥4.5:1 (≥3:1 for the two large-text pairs), with the WCAG math written in the test itself. Must fail on the pre-fix palette.

**Acceptance Criteria:**
- Given the built stylesheet, when each light-theme pair used by real text is measured, then every ratio is ≥4.5:1 (or ≥3:1 where the text is large) — proven by `npm test`, not by eye.
- Given dark mode, when the same measurement runs against the dark token block, then every pair passes too.
- Given a `/photos/<id>` page rendered from the shared detail template, when React has painted, then `<a rel="tag">` chips and the `<nav><a href="/">` link are ≥4.5:1 with no markup change to the template.
- Given `npm run lint` and `npm test`, when the change is complete, then both pass clean, including the pre-existing CLS/geometry/slot contracts.

## Implementation Notes

Implemented on-thread: subagent dispatch is unavailable in this session (every `task` launch returns
`400 The requested model is not supported`, including one retry after the plan was approved), so the
handoff ran here rather than in a fresh context.

Files touched: `src/index.css`, `src/containers/PhotosComponent.css`, `src/containers/Header.css`,
`src/containers/Footer.css`, `src/containers/PhotosComponent.js`, `src/App.js`,
`src/containers/About.js`, `src/containers/NoMatch.js`, plus new
`src/a11yContrast.contract.test.js`.

Deviations and surprises:

- Chose `--wordmark: #3f4bd8` (light) / `#b0b8ff` (dark) as one token for both wordmarks rather than
  reusing `--link`, so the brand mark can move independently of link colour later; measured against
  the composited translucent header, not the flat page background.
- The plan named only the moderation chips, but the recognised-text chips two blocks above them
  (`PhotosComponent.js:1089`) carried the identical `opacity: max(0.6, …)` defect on a text-bearing
  pill, so they were fixed the same way. Leaving them would have shipped the bug the decision exists
  to remove.
- `::selection` moved from white to `var(--text-primary)`: white on the 30%-alpha accent fill is
  1.42:1, and selection is text.
- Added two assertions the plan did not list, to cover the frozen matrix row about the pre-hydration
  paint (`describe('paint before the application stylesheet lands')`): index.html's critical block
  must own no anchor colour, and its body pair must itself clear AA. Mutation-checked — injecting
  `a { color: #b0b8ff }` into that block fails the contract.
- Verification: `npx vitest run src/a11yContrast.contract.test.js` 12/12; the same file run against a
  restored baseline palette fails 7 of its cases, so it is a real gate; `npm test` 207/207 across 18
  files (CLS/geometry/slot contracts untouched); `npm run lint` reports only pre-existing findings in
  `src/setupTests.js` and files not touched here — zero new problems; `npm run build` green including
  the `postbuild` template contract. Built sheet confirmed to carry the four theme blocks and to hold
  no `color:#b0b8ff`.
- Known follow-up, deliberately out of scope: `.hamburger-bar`, `.loading-spinner` and focus rings use
  `--accent` #7c8cf8 as a *non-text* UI colour, which is WCAG 1.4.11 (3:1) territory at ~2.6:1. The
  reported failure was 1.4.3 text contrast; the non-text audit belongs to its own pass.

Review pass (Quick lens) added a second wave, all of it colour declarations and test code:

- `.form-control::placeholder` / `.form-select::placeholder` now take `var(--text-muted)` with
  `opacity: 1`. Without it Bootstrap's `[data-bs-theme=dark]`-scoped placeholder colour never applies
  here (the app never sets that attribute), so the search box's prompt was dark grey on a near-black
  field — 1.09:1 in dark mode. This is the one live failure the audit report did not surface, because
  an axe run against production light mode cannot see it.
- The contract grew to 14 cases: the placeholder pair in both themes, `--text-muted` pinned present in
  all four theme blocks, dormant rules labelled as such, `declaration()` reading a selector list in
  cascade order, and every `<style>` block in `index.html` guarded rather than just the first.
- Negative controls run for each new guard (delete the placeholder rule / delete the dark
  `--text-muted` / inject an anchor colour into the critical block): each mutation fails at least one
  case, and the tree returns to green afterwards.

## Plan Change Log

## Review Triage Log

Quick lens (`review: 'quick'`, pinned) over the diff at `4290fc0..working tree`. The lens ran as a
context-free subagent even though the step-03 handoff could not. All patches applied on-thread, since
the step-03 implementer never returned a session to re-engage.

| # | Finding | Disposition |
|---|---------|-------------|
| Q1 | `npm run lint` exits 1 (11 `indent` errors in `src/setupTests.js:5-15`), so AC 4's "lint passes clean" cannot be met as worded | **deferred** — verified pre-existing: every flagged line sits outside this diff, and the repo-wide problem count is identical before and after (17 problems, 6 warnings). Nothing chains lint (`build` = sitemap + `vite build`, `postbuild` = template contract), so no deploy path breaks. Recorded in deferred-work; one `--fix` away if the human wants it in this change. |
| Q2 | `.form-control::placeholder` is never coloured by this app, so Bootstrap's `[data-bs-theme=dark]`-scoped placeholder value never applies and the search box's empty-state prompt measures 1.09:1 on a dark field | **patched** — verified at `node_modules/bootstrap/dist/css/bootstrap.css:2163` with `--bs-secondary-color: rgba(33,37,41,.75)` at `:87`, and no `data-bs-theme` anywhere in `src/`, `index.html` or `public/`; both search inputs (`Home.js:157`, `SearchComponent.js:154`) are `.form-control`. Added the token-driven rule with `opacity: 1`, measured the pair in both themes, plus a dedicated test. Negative control: deleting the rule fails two cases. |
| Q3 | Three measured pairs point at classes no JSX renders, so part of "every pair used by real text" is vacuous; `.store-link { opacity: .85 }` unmeasured | **patched** (vacuity) / **false** (the opacity half). Verified by grep: `.text-detection`, `.moderation-labels` and `.store-badge` appear only in CSS, never in markup. The pairs stay — a shipped rule must not ship unreadable — but are renamed `dormant …` so the contract no longer presents them as live text. The opacity claim is refuted: `.store-link` wraps an `<img>` with an `aria-label` and no text node (`src/containers/Footer.js:22-47`), so no text rule can fail on it. |
| Q4 | `--text-muted` is never pinned present in the dark blocks, and `THEMES.dark` spreads the light base, so deleting it silently re-measures the light value | **patched** — added to a presence list covering all four blocks. Negative control: removing it from the dark media block now fails three cases; before the patch that mutation passed. |
| Q5 | Button pairs take fg from `['.button:hover', '.button']` while bg comes from `.button`, and `declaration()` returned the *first* declaring selector, contradicting its own "later rules win" comment | **patched** — `declaration()` now walks the list in cascade order and keeps the last declaring value; each state measures itself with the base rule as fallback. Latent rather than live today (neither hover rule declares `color`), which is exactly why it should not stay. |
| Q6 | Two pre-hydration assertions gate nothing: `expect(pairs.length).toBe(2)` counts a two-element literal, and only the first `<style>` block was read | **patched** — every `<style>` block is now read, and the vacuous length check became "there is a critical block to guard" plus a per-theme "the body rule was actually found". Mutation control: injecting `a { color: #b0b8ff }` into the critical block fails the contract. |

Self-caught during this pass, not from the lens: an edit of mine collapsed two blocks onto one line in
the new test file and broke `brace-style`/`indent`. Caught by linting the touched files, fixed, and the
touched-file lint is now clean — the 17 remaining repo problems are all Q1's baseline.

## Design Notes

Token shape (values are the measured-safe candidates; final set subject to the Open Question answers):

```css
:root {                       /* light */
  --link: #2f43c4;            /* 7.20 bg · 7.72 raised · 6.87 card */
  --link-hover: #1e3a8a;      /* 9.66 on bg */
  --btn-bg: #4f5fd0;          /* white text 5.41 */
  --btn-bg-hover: #3d4bb0;    /* white text 7.42 */
  --danger-text: #b91c1c;     /* 5.76 card · 6.47 raised */
  --text-muted: #5b6472;      /* 5.58 bg · 5.32 card (was 4.51 / 4.30) */
}
/* dark keeps --link: #b0b8ff (10.01), --link-hover: var(--mint) (12.39),
   --danger-text: #f87171 (5.88 card), and needs --text-muted ≥4.5 on #1a1a1c → #91919e (5.58) */
```

Keep the hover relationship monotone (hover darker than base in light mode) — that is why `--btn-bg` moves rather than only `.button:hover`.

## Verification

**Commands:**
- `npm test` -- expected: all suites pass, including the new `src/a11yContrast.contract.test.js`; run it once *before* the palette edits to confirm it fails on the current values.
- `npx vitest run src/a11yContrast.contract.test.js` -- expected: focused green.
- `npm run lint` -- expected: no new warnings (StandardJS style, no semicolons, single quotes).
- `npm run build` -- expected: build succeeds and `postbuild` template contract stays green.

**Manual checks:**
- `npm start`, open `/photos/<id>` and `/` in light and dark; confirm links, tag chips, prev/next buttons, footer links and the wordmark are legible and nothing else changed visually (no box moved).
