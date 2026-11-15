---
title: 'Stop the prev/next buttons jumping position at the skeleton handoff'
type: 'bugfix'
ticket: ''
created: '2026-11-15'
status: 'built'
baseline_revision: '437cd3d64f66ff0a86b0014c1ec00bd313a9ef69'
route: 'oneshot'
route_source: 'pinned'
risk: 'medium'
review: 'thorough'
review_source: 'pinned'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
context: ['.github/copilot-instructions.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The prev/next links are absolutely positioned with the same inline offsets in both detail render paths, but they anchor to different boxes. Client-rendered mode anchors them to `<main class="content-container" style={{position:'relative'}}>` (the page column's top corners); adopted mode portals them into `skeleton.mediaBox` (`.wsk-box`, the picture's own box). So on the first prev/next after a cold deep link — the one-time handoff — the two buttons visibly jump from the corners of the card down into the corners of the photograph. `.wsk-box` also has `overflow:hidden`, so the buttons are clipped by the media box they sit in.

**Approach:** Make the anchor *semantic* rather than incidental: both paths anchor navigation to the page column that holds the content, not to the media box. `detailSkeleton.js` captures one more node — the media box's positioned ancestor (the edge's `.wsk-main`, which already mirrors `.content-container`: `max-width:1100px; margin:0 auto; padding:20px 20px 28px`) — and guarantees it is a positioning context. `PhotosComponent.js` portals navigation into that node while video overlays (centred on the media) keep portaling into the media box. No CSS class names are hardcoded in JS, nothing about the shipped offsets changes, and the server-painted LCP media node is still never touched.

**Decisions:**
1. Capture structurally (`mediaBox.parentElement`), never by class name: the edge owns `wsk-*` naming (WiSaw.cdk `skeleton.js`) and renaming it must not silently break adoption.
2. When that ancestor is `#root` itself (a degenerate skeleton shape — media wrapped exactly once), fall back to the media box instead of rejecting adoption or anchoring to the mount point.
3. Make the container a positioning context imperatively at capture time, only when its computed `position` is `static`. `position:relative` with no offsets cannot shift layout or create a stacking context, so this cannot cost CLS or LCP; the guard means an edge-side `position:sticky|relative` is never overwritten.
4. Accept the residual vertical delta rather than compensating it in pixels: `.PhotosComponent` adds `padding-top:24px` above `<main>` that `.wsk` does not have, so the adopted buttons land ~24 px (desktop) / ~32 px (mobile, `.content-container{margin:8px}`) higher than the client-rendered ones. That is 10× smaller than today's jump and stays inside one breakpoint; hardcoding `top: calc(72px + …)`-style offsets would trade a visible bug for two magic numbers that drift.

</frozen-after-approval>

## Implementation Notes

Oneshot route: one mechanism across three files plus tests, so the plan is the design. Investigation findings that shape it:

- `renderNavigationButtons` (PhotosComponent.js:1092) is already shared by both paths — only the portal target differs. Keep it shared; do not fork per-path offsets.
- Adopted branch returns a fragment with one `createPortal` carrying nav + `VideoOverlays` into `skeleton.mediaBox` (PhotosComponent.js:1170-1181). Split into two portals inside the same `<Suspense>`: nav → `skeleton.navContainer`, `VideoOverlays` → `skeleton.mediaBox`. `VideoOverlays` are `top/left:50%` centred, so the media box is correct for them in both paths.
- `captureDetailSkeleton` (detailSkeleton.js:41) already rejects a skeleton whose media node has no wrapper (`mediaBox === root`), so `navContainer` only ever needs the second-order guard.
- Side benefit: `.wsk-box{overflow:hidden}` currently clips the buttons; nav above the media box is no longer clipped.
- Known residual (Decision 4) plus two pre-existing container mismatches — mobile `margin:8px` and `padding:14px` on `.content-container` vs `20px` on `.wsk-main` — are geometry drift between the app card and the edge card, not part of this fix. The cross-repo geometry contract (`src/detailGeometry.contract.test.js`) is where they belong if they are ever closed.
- Test fixture honesty: `src/containers/detailSkeleton.seam.test.js` builds its fake skeleton with the *app's* class names (`.content-container`, `.crop`), not the edge's real output (`.wsk`, `.wsk-main`, `.wsk-box`). Since this change depends on `mediaBox.parentElement`, the fixture must mirror real edge markup or it green-lights a shape production never serves. Rebuilt both fixtures in that file (and the one in `src/index.boot.test.js`) from `WiSaw.cdk skeleton.js`'s actual structure.
- Landed as: `detailSkeleton.js` captures `navContainer` (anchor node inserted into the column) alongside `mediaBox`; `PhotosComponent.js` splits the adopted portal pair; three test files updated plus one new client-rendered anchor test in `fullMedia`. Suite: 152 tests green (was 149 at baseline); eslint clean on every changed file (`src/setupTests.js` keeps its 11 pre-existing indent errors, untouched by this change).
- Review pass then changed the mechanism once (see triage log entry 1): nav portals into a dedicated out-of-flow anchor inserted ahead of the media box instead of the column itself, so DOM/tab order survives. The column is still the containing block and still gets `position:relative` when it has none.

## Review Triage Log

Pass 1 (thorough; lenses run inline and sequentially on the main thread — single-model endpoint, no subagents): `blind-hunter`, `edge-case-hunter`, `verification-gap`, `intent-alignment`. Verdict counts: high 0, medium 2, low 3, false 2, maybe-false 1.

- `medium` **patch** — Portalling nav straight into the column appends it after the below-fold slot, so prev/next became the last tabbable elements on an adopted page (they are the first children of `<main>` once the page is client-rendered). Real: portals append; DOM order is tab order. Fixed by inserting an empty out-of-flow anchor (`[data-wisaw-nav]`, `position:absolute;top:0;left:0;width:100%`) ahead of the media box at capture time and portalling into it — same containing block, so geometry is unchanged. (Blind hunter + intent alignment.)
- `medium` **patch** — Verification gap: nothing pinned the *client-rendered* half of the contract, so moving nav out of `<main class="content-container">` would reopen the jump with a green suite. Added a `fullMedia` test asserting prev/next are direct children of that `<main>` and that it carries `position:relative`.
- `low` **patch** — `index.boot.test.js` asserted byte-equal `#root.innerHTML`; capture now legitimately adds two things (the anchor node and the column's `position:relative`). Rewrote the assertion to undo exactly those two sanctioned additions and then demand byte equality, so any other mutation still fails. Its fixture also moved from a degenerate single-wrapper shape to the real `.wsk/.wsk-main/.wsk-box` structure.
- `low` **patch** — The degenerate-shape capture test asserted only parentage; now also asserts the anchor is empty and lands inside the media box.
- `false` — "Hardcoding `.wsk-main` in JS contradicts Decision 1." Production capture remains purely structural (`mediaBox.parentElement`); the class name appears only in tests and in the cross-repo geometry contract, which is exactly what a contract test must name.
- `false` — "`getComputedStyle().position` can be empty so the column may never be positioned." The guard is `!columnPosition || columnPosition === 'static'`, and the seam test asserts the computed position after capture.
- `maybe-false` **defer** — Mobile drift between the two anchor columns: `.content-container{margin:8px;padding:14px 14px 20px}` at ≤768 px vs `.wsk-main` keeping `padding:20px 20px 28px`, so on a phone the buttons would sit ~8–14 px further from the edge on one side of the handoff. Pre-existing skeleton/app geometry mismatch, not caused by this change; settled only by measuring at 375 px (or aligning both rules under `detailGeometry.contract.test.js`). Recorded in `deferred-work.md`.
- `low` **rejected** — Seam nav lookup keys on `/prev|next/` button copy. Renaming the copy fails three tests loudly; an abstraction over two links is not worth it.

## Design Notes

The anchor node rather than the column itself, because a portal's position in DOM order is its container's *last child* — and the column's last child is the below-fold slot holding comments and footer.


## Verification

**Commands:**
- `npx vitest run src/containers/detailSkeleton.seam.test.js src/index.boot.test.js src/detailGeometry.contract.test.js` -- expected: all green, including new cases below
- `npx vitest run` -- expected: full suite green (243+ tests), no regressions in `PhotosComponent.fullMedia.test.js` / `.cls.test.js`
- `npm run lint` -- expected: clean on changed files

**New checks to prove the fix:**
- Capture over real-shape skeleton markup returns `navContainer` = the media box's parent, and that node's inline `position` is `relative` after capture; a skeleton whose ancestor is `#root` still adopts with `navContainer === mediaBox`.
- Mounting `<App/>` over a simulated skeleton puts both prev/next links inside `navContainer` and **not** inside `mediaBox`, while the play-button overlay stays inside `mediaBox`; the painted `[data-wisaw-media]` node is still the same DOM node object after the first commit.
- Geometry contract: `.wsk-main`'s rule in `skeleton.js` keeps the declarations that make it the twin of `.content-container` (`max-width:1100px`, `padding:20px 20px 28px`) — a one-sided edit fails here instead of re-opening the jump.

**Manual checks (jsdom cannot measure painted geometry):**
- After deploy, open a cold `/photos/<id>` at desktop width, click next once, and watch the two buttons: they may nudge up by ≤32 px at the handoff but must no longer move into or out of the photograph. Repeat at 375 px width and on a portrait video (`/videos/<id>`) where the media box is narrower than the column — that is the case where today's jump is worst.
