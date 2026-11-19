---
title: 'Stop detail-page layout shift at its measured causes'
type: 'bugfix'
ticket: ''
created: '2026-11-18'
status: 'built'
baseline_revision: '2f5bbde0af18196b8186431387843f5473667fbc'
route: 'oneshot'
route_source: 'pinned'
risk: 'medium'
review: 'thorough'
review_source: 'pinned'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap']
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Mobile CLS on `/photos/:id` measures **0.1941** (local repro of `c8df5cf`) / 0.1595 in production. Headless-Chrome measurement attributes it to three mechanisms: (1) **±64 px header churn, 0.1409 total** — the edge reserves `min-height:72/64px` on `[data-wisaw-slot="header"]`, React's adoption sets that slot to `display:contents` which deletes the floor while `.header-container{height:72/64px}` still lives in the async app stylesheet, so the whole frame jumps up then back down; (2) **0.0345** — `<footer>` is painted into the below slot before recognitions hydrate, then `.recognition-tags` grows 30 px → 1356 px and pushes the already-painted footer ~1.3k px; (3) **0.0186** — sidecar wording replaces the edge's shorter fallback copy and moves content below it. Separately, a **91 px transparent dead block** sits above the AI tags panel on any photo without comments (`CommentSlotSkeleton`), which the user has asked to remove.

**Approach:** Make the header's height exist at first paint regardless of when the app stylesheet lands; stop painting the footer until the content above it in the below slot is final (bounded, never indefinite); delete the dead reserve. Accept the 0.0186 wording shift for now — it is the only one that cannot be removed without changing what the edge paints. Must hold for **both** the edge-painted direct visit and React prev/next navigation.

</frozen-after-approval>

## Implementation Notes

Measurement oracle (already built, persisted at `/Users/dmitry/.copilot/session-state/9aa3f22d-2340-4af1-af46-84115a9106c7/files/cls-harness/`): detached headless Chrome on `:9333`, `cls-probe.mjs <url>` for mobile-emulated + PSI-throttled CLS with per-element sources, `mklocal.py <buildDir> <outDir>` + `serve.py <dir> 8900` to serve a local build under production's edge-painted HTML. **Nothing ships unless its number moves.** Baselines: portrait 0.1941 (4 shifts), landscape 0.0186 (1 shift).

**1. Header geometry must be render-blocking — `index.html`, `src/lcpBootstrap.template.test.js`.** Add to the existing critical `<style>` block (the one documented as "everything needed to paint the first frame"): `#header{position:sticky;top:0;z-index:1000;border-bottom:1px solid rgba(15,23,42,.12)}` plus `.header-container{box-sizing:border-box;display:flex;justify-content:space-between;align-items:center;max-width:1200px;margin:0 auto;height:72px;padding:0 24px}` and the `@media screen and (max-width:768px)` twin with `height:64px;padding:0 16px`. Values mirror [Header.css](file:///Users/dmitry/hacks/wisaw/WiSaw.client/src/containers/Header.css) lines 5–25 and 223–227 exactly; the literal border colour replaces `var(--border)` because `:root` is in the async sheet. Do **not** add background/backdrop (visual only, dark-mode dependent). Extend `lcpBootstrap.template.test.js` to assert these numbers equal the values parsed out of `Header.css`, so drift fails CI — that test already guards this block's content. This alone should remove both 0.0699 and 0.0710 shifts on both render paths, since adoption is shared.

**2. Footer waits for final below-slot content — `src/containers/PhotosComponent.js`.** The below slot currently portals `<BelowMediaContent>` and `<Footer>` independently (lines ~1256–1262), and the record is seeded as `{photo, comments: [], recognitions: []}` (line 64) before GraphQL hydrates recognitions — so the footer paints against a 30 px tags panel. Gate **only** the Footer portal on the current photo's record having been hydrated from GraphQL (`detailsSettled`-style flag set where `getPhotoAllCurr` results are applied, cleared on photoId change), with a bounded timeout (~4 s) so a hung request can never strand the footer — that closes deferred-work entry (a). Do **not** re-add pass 1's wording gate or its below-content portal gate: the measured cause is recognitions, and gating wording was what regressed.

**3. Remove the dead reserve — `src/containers/PhotosComponent.js`, `src/containers/PhotosComponent.css`, `src/containers/detailSlotStyles.contract.test.js`, `src/containers/PhotosComponent.cls.test.js`.** Comments and recognitions are both final in the same commit as `BelowMediaContent`'s mount, so `CommentSlotSkeleton`'s 91 px invisible row is pure dead space above `.recognition-tags` — stop rendering it (drop the `:283` fallback branch). Then retire `.comments-section.comments-section--slot` from the compound rule at CSS line ~150 and the `.comments-section .skeleton-comment` rule, keeping `.recognition-tags.recognition-tags--slot` (still used by the cold placeholder at line ~1298); drop only the comments half of the contract assertion, and update `PhotosComponent.cls.test.js:164-165` to assert no reserve is rendered instead.

### Pass 1 notes (implementation)

Measured result after all three fixes, same harness and URL: **portrait CLS 0.1941 → 0.0186**, 4 shifts → 1 (the accepted wording reflow); landscape unchanged at 0.0186. `npx vitest run` 193/193 (baseline at `2f5bbde` was 190; +3 new cases), eslint clean on changed files, `npm run build` + postbuild green.

**Surprise worth keeping:** the plan assumed the critical-CSS block alone would kill the header churn. It did not — measured still 0.0699 + 0.0710 after step 1. The geometry timeline showed why: at the moment `display:contents` lands there is **no header element in the slot at all** (`Header-*.js` is a lazy chunk that arrives ~2.3 s later), so no stylesheet value could help — an empty slot has no height. Two independent things are needed and both are now in place: the height must exist before the async sheet (critical block) **and** the reservation must survive until the Header actually renders (`headerInSlot` gate in `App.js`, set by a `SlotMountNotice` sharing the Header's Suspense boundary). The critical block still earns its place: it covers the window where the header DOM exists but `Header-*.css` has not applied (~16 px instead of 0).

Pinning: the handoff is guarded by a new case in `detailSkeleton.seam.test.js`, which reuses that file's proven `<App/>` boot harness; the Header mock gained a gate so one test can hold the module out of reach. Verified as a real guard by negative control — reverting only the `headerInSlot` condition makes that test fail. A standalone `src/App.headerSlot.test.js` was attempted first and abandoned: its fresh fixture never let the sibling lazy route commit, which proved nothing about the behaviour under test.

## Verification

**Commands:**
- `node <harness>/cls-probe.mjs http://127.0.0.1:8900/photos/7b839cf4-4676-4d12-9cd0-220f26515ad2 out.json` after `npm run build && python3 <harness>/mklocal.py build <outDir>` -- expected: CLS **< 0.02** (baseline 0.1941) with the ±64 px and ~880 px shifts gone
- same probe on `/photos/2f3c38f7-9c2d-4c8b-9098-894070265dd7` -- expected: CLS ≤ 0.0186, no new shifts
- `npx vitest run` -- expected: all suites green (baseline 198 tests / 17 files)
- `npx eslint src/containers/PhotosComponent.js src/containers/PhotosComponent.cls.test.js src/containers/detailSlotStyles.contract.test.js` -- expected: clean
- `npm run build && npm run postbuild` -- expected: build + edge-injector contract test green

**Manual checks:**
- Prev/next navigation between two photos shows no jump and the footer is present after navigation (both paths share the gate).
- On a photo without comments, no blank band sits above the AI tags panel; on a photo with comments they render normally.

### Final measurement (post-review build)

Re-measured from the shipped `build/` with the harness after the review patches, using production's own edge-painted frame grafted onto this build (`mklocal2.py`): **landscape `2f3c38f7…` CLS 0.0156 (1 shift)** and a portrait record (`a8697b17…`, 2250x3000) **CLS 0.0156 (1 shift)**. The single remaining entry is the accepted wording reflow (`p`/`h1`/`nav` moving dy=53.6 when published copy replaces the edge fallback, t≈3.3-3.9 s). Both header churn entries and the footer push are absent from the trace in both orientations.

Note on the portrait sample: only `2f3c38f7…` is served as a deep link by CloudFront today — other feed ids answer 404 at the edge (separate production issue, not this change) — so the portrait run reuses that frame and loads the portrait record through the app. The adoption path being measured is identical; only the seed wording/aspect differ.

## Review Triage Log

Loop iteration 1, three lenses over the diff at `2f5bbde..working tree` (blind-hunter 15 findings, edge-case-hunter 4 + ruled-out list, verification-gap 3). Fixed in this pass, with negative controls where a claim was testable:

| # | Finding | Disposition |
|---|---------|-------------|
| B1/E4 | Header gate has no bound or failure path; chunk that never loads leaves an empty reserved band forever | **patched** — `HEADER_SLOT_FINAL_WAIT_MS` (8 s) releases the handoff; new seam case pinned by negative control (removing the timer fails it). Reset-on-frame-change variant rejected: `SlotMountNotice`'s effect keys on a stable callback, so resetting would strand the reservation. Deferred with reasoning. |
| E1 | Timer marker is never cleared, so revisiting a photo whose request hung paints the footer mid-fetch (re-opens the 880 px push) | **patched** — `setBelowSlotWaitedFor(null)` on every `photoId` change. Not directly testable in either harness (see deferred-work entry with the verification-gap mutant recipe). |
| B4 | Both footer tests pass without the gate (lazy Footer makes synchronous absence vacuous) | **patched** — the withheld case now waits for a painted frame plus a macrotask before asserting absence; control run: deleting `belowSlotIsFinal` from the portal fails it *and* the bounded-wait case. |
| V2 | That same assertion was order-dependent on earlier tests warming the lazy chunk | **patched** by the same change (barrier is the painted `.wsk-box`, not test order). |
| B6 | A rejected/failing record silently pays the full 4 s wait | **patched** — `paintCurrentPhoto`'s failure path now marks the below slot settled. |
| B7 | Critical CSS hardcodes the light border while dark mode uses another | **patched** — dark `prefers-color-scheme` override added; new pin compares against both `--border` values in `src/index.css`. |
| B8 | The mirror stops at 768 px; `Header.css` narrows padding again at 480 px | **patched** — 480 px padding rule inlined and pinned. |
| B9/V3 | The pin asserts only the two heights while padding, max-width, box-sizing and the border are also duplicated | **patched** — the test now compares full declaration sets at desktop/768/480 between `index.html` and `Header.css`; control run: changing only `Header.css` padding to `0 32px` fails with a named message. |
| B11 | Contract test's negative assertion misses grouped selectors / `:where()` | **patched** — comments are stripped first, then any occurrence of the removed class is a failure; control run: re-adding the rule fails it. |
| B14 | Seam `headerGate` leaks a settled thenable into later tests | **patched** — `afterEach` resets `open`/`promise`/`release`. |
| E2/B13 | Plan and an in-code comment claim `requestComplete` is "keyed on the id" / cleared on navigation; deferred-work still lists two items this diff implements | **patched** — comment reworded to what the code does, both deferred-work entries closed with dates, four new deferred entries added. |
| E3 | "Mounts once with its final height" overstates reality (seeded `{comments:[],recognitions:[]}` grows after mount) | **patched** — `BelowMediaContent`'s doc now cites the footer gate as the protection instead of a false invariant. |
| B5 | Gate waits on neighbours (`requestComplete`) rather than the record alone, so the footer can trail the real settle time by up to 4 s | **deferred** — conservative direction (delay, never shift); tightening it wants an Apollo request timeout too. Recorded in deferred-work. |
| B2/B3 | `headerInSlot` not reset on frame swap; no prev/next handoff coverage | **false / deferred** — the seam file already pins the header slot across a navigation (`display` returns to `''` at handoff, and the portal keeps working after `pushState`); the reset itself is unsafe as written. Deferred with reasoning. |
| B10 | Two contract tests duplicate pinning logic | **declined** — they guard different artifacts (generated template vs. app CSS); sharing a helper across them couples unrelated contracts for no added safety. |
| B12 | Empty reserved band visible up to 4 s is undocumented | **patched in place** — the gate's comment states the trade and its bound; a placeholder there would reintroduce the dead space this pass deleted. |
| B15 | `waitForBox` no longer awaits the footer, so later assertions could race the paint | **false** — every case that asserts below-media content awaits its own node (`findByText('site footer')`, `findByText('great shot')`); waiting on the footer is what made the helper wrong once the footer became conditional. |
| V4 | No automated check covers the acceptance criterion (CLS itself), and nothing pins that 4 s exceeds a cold round trip | **accepted** — the plan makes the external headless-Chrome harness the oracle and its commands are recorded here; the 4 s bound is empirical (PSI-throttled record settles ~3.3-3.9 s) and can only be pinned by an Apollo timeout, already deferred. |
