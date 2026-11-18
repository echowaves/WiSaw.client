# Review log: walkthrough-shared-detail-template

Target: branch `fix/detail-nav-shared-template` in two repos — WiSaw.client `43f4cf5..HEAD` (74747f4, 7d4bf72, 292f323) + WiSaw.cdk `1edaa794..HEAD` (a07ee61, c88ed04). Combined diff: ~2066 insertions / 736 deletions across 23 files.

## 1 — orientation — target selection and narrative setup

Session: 75172b46-3f17-43bc-946d-58d54d69fa09 · Timestamp: 2026-11-16T22:15-05:00

- Action: Asked the human for scope; chose both branch diffs. Read plan `../../plan-detail-nav-shared-template.md` (Intent, Boundaries, Implementation Notes, Review Triage Log) and both diffstats to build the 9-block narrative.
- Result: Intent taken verbatim from the plan's frozen section — no open questions about purpose. Narrative blocks: intent, broad strokes, 5 slices (template+publishing, seam producers/guards, page component, wording parity+CORS, AppShell ownership), tests, periphery. No findings raised yet; nothing fixed or deferred in this entry.
- Evidence: `_bmad-output/initiative-mobile-core-web-vitals/walkthrough-shared-detail-template/walkthrough-shared-detail-template.md`; anchors verified by grep (detailSkeleton.js:50/94/114/191/239, PhotosComponent.js:99/453/579/589/614/1267, App.js:205/211, detailSeoText.js:57, skeleton.js:183/224, utils.js:356, cloud-front.ts:237/269).
- Open: Constraint — repo `.github/copilot-instructions.md` forbids subagent launches (single-concurrency model endpoint), so log/narrative writing happens in the main session rather than in a background writer agent. Build-time review already ran inline with the same constraint; its 17 rows are in the plan's Review Triage Log (2 fixed, 6 false, 4 rejected-as-negligible, rest descriptive/patched).

## 2 — block 1 Intent — move: Thoughts

Session: 75172b46-3f17-43bc-946d-58d54d69fa09 · Timestamp: 2026-11-16T22:23-05:00

- Action: Checked the diff against each intent clause: single authored markup, deletion (not restyle) of the client card, producer-agnostic enhancement layer, unchanged served bytes. Searches: `mainImage|thumbnailImage|renderLabelRow|computeDisplayDimensions` across src; `.wsk` in containers/*.css; SKELETON_STYLE selector scoping via node; portal wiring at PhotosComponent.js:1238-1260.
- Result: Intent delivered. Findings, all open-by-design or cosmetic — (1) wording parity is not live until the CDK CORS behaviour deploys: today a nav page shows `wisaw photo <id>` + fallback sentence where a direct load shows published copy; accepted as-is, deploy-gated. (2) media geometry comes from the record on nav and from the sidecar at the edge, so a sidecar-less record lays out differently between paths; accepted as-is (client has the better datum), recorded in plan Implementation Notes. (3) cosmetic stray space `if ( adopted` PhotosComponent.js:1238 — open, trivial. (4) client-side drift pin skips when ../WiSaw.cdk is absent (`src/detailGeometry.contract.test.js:33`); accepted as-is, CDK suite pins the same invariant authoritatively. No new defects found; no edits made.
- Evidence: SKELETON_STYLE selectors all `.wsk`-scoped (10 rules, only @media wrappers bare) → de-scoping from `#root` leaks nothing; zero matches for deleted-card identifiers outside a comment and one negative test assertion (`src/containers/detailSkeleton.seam.test.js:682`).
- Open: Block 1 not yet accepted by the reviewer.

## 3 — block 1 Intent — move: Formal review (bmad-code-review, thorough, lenses inline)

Session: 75172b46-3f17-43bc-946d-58d54d69fa09 · Timestamp: 2026-11-16T22:35-05:00

- Action: Reviewed the combined branch diff (client 43f4cf5..HEAD, cdk 1edaa794..HEAD; 23 files) with all four lenses executed inline (repo forbids subagents). Diff staged at `$TMPDIR/cr-client-cdk.diff`, claims at `$TMPDIR/cr-client-cdk-claims.md`. Verified: sidecar contract field names against `seoRules.js` writer/reader, kind-parity rule at `seoText.js:34`, frame-store identity, producer kind convention, stylesheet scoping (programmatic selector dump), CloudFront `*.json` behaviour placement/TTL/CORS origins.
- Result: 0 decision-needed; 3 patch — all fixed in client `036a3a8` (kind gate on published wording; no `alt` written to `<video>`; dead `imageTitle`/`altText` fields dropped); 1 defer → `_bmad-output/initiative-mobile-core-web-vitals/deferred-work.md` (no CDK test asserts handler-served description text); 8 rejected, incl. hung-fetch in-flight dedupe (low, browser-bounded, fix adds a timer branch). Findings block appended to plan `## Code Review`. Client suite now 190 passing, lint clean on touched files; CDK untouched this round.
- Evidence: new tests — cls "refuses wording written for the other media type" + "wears wording published for this kind"; paint "does not give a video an alt attribute the served page never has"; detailSeoText 404-cached / 503-retried / no-title case.
- Open: Block 1 still not accepted by the reviewer; client tree now carries commit `036a3a8` beyond the walkthrough's recorded target range (narrative header lists `74747f4`, `7d4bf72`, `292f323`).

## 4 — block 1 Intent — move: Formal review, second pass

Session: 75172b46-3f17-43bc-946d-58d54d69fa09 · Timestamp: 2026-11-16T22:40-05:00

- Action: Re-ran `bmad-code-review` inline on the updated target (client 43f4cf5..HEAD incl. 036a3a8, cdk unchanged; diff restaged at `$TMPDIR/cr2-client-cdk.diff`). Traced paths not covered by pass 1: video event wiring and playsinline on painted `<video>` nodes, full-res src upgrade with capture-phase error repair, AppShell widened portal condition and the stale-frame window, `clearDetailSkeleton`, onerror parity.
- Result: ✅ Clean review — 0 decision-needed, 0 patch, 0 defer, 4 rejected (paint partial-failure blanking; seed helper edge-only; retained head stylesheet; cosmetic double space). No code changed this pass. Block 1's intent verified end to end.
- Evidence: `src/containers/PhotosComponent.js:468-506`, `:513-545`; `src/utils/detailTemplate.generated.js:139` (template emits `onerror` for both producers); `src/utils/detailSkeleton.js:254-275`; `src/App.js:205`. Block written to plan `## Code Review`.
- Open: Block 1 still awaiting the reviewer's "done"; narrative target line needs `036a3a8` added when it closes.

## 5 — block 1 Intent — review workflow closed, walkthrough resumed

Session: 75172b46-3f17-43bc-946d-58d54d69fa09 · Timestamp: 2026-11-17T06:51-05:00

- Action: Reviewer ended `bmad-code-review` (Done) and asked to resume the walkthrough. Narrative target line updated to include client `036a3a8`, the commit both review passes produced.
- Result: Block 1 remains open — no acceptance given; no code or narrative content changed beyond the target line. Both review passes recorded in plan `## Code Review`; nothing left unresolved from them (patches applied, one defer filed).
- Evidence: `_bmad-output/initiative-mobile-core-web-vitals/plan-detail-nav-shared-template.md` sections "formal code review" and "second formal pass".
- Open: Block 1 acceptance; then Blocks 2–9.

## 6 — block 1 Intent → ✅ accepted

Session: 75172b46-3f17-43bc-946d-58d54d69fa09 · Timestamp: 2026-11-17T06:58-05:00

- Action: Reviewer accepted the intent block after `thoughts` plus two formal review passes.
- Result: Block 2 (Broad strokes) presented as current; narrative checkboxes updated. Tree now carries uncommitted BMad bookkeeping (plan triage, deferred-work entry, walkthrough files) — reviewer asked whether to commit it.
- Evidence: plan `## Code Review`; narrative sections 1–2.
- Open: Block 2 walkthrough; Blocks 3–9; branches still unpushed.

## 7 — bookkeeping committed while block 2 is read

Session: 75172b46-3f17-43bc-946d-58d54d69fa09 · Timestamp: 2026-11-17T07:02-05:00

- Action: Reviewer chose to commit the uncommitted BMad artifacts; no walkthrough move requested on block 2 yet.
- Result: WiSaw.client `d0b756f` (docs only: plan review sections, deferred-work entry, narrative + log). Working tree clean; both branches still unpushed. Block 2 stays current and open.
- Evidence: commit `d0b756f`.
- Open: Blocks 2–9; push/PRs at wrap-up.

## 8 — block 2 Broad strokes → ✅; block 3 presented

Session: 75172b46-3f17-43bc-946d-58d54d69fa09 · Timestamp: 2026-11-17T18:48-05:00

- Action: Reviewer accepted the broad-strokes map with no move run on it, then was shown block 3 (template authoring, publishing, drift pins).
- Result: Narrative updated — blocks 1–2 ✅, block 3 current. No code changes; log file left dirty pending the next docs commit.
- Evidence: narrative sections 2–3; commits `a07ee61`/`74747f4` for the slice content.
- Open: Blocks 3–9; branches unpushed.

## 9 — block 3 template/publishing → ✅; block 4 presented

Session: 75172b46-3f17-43bc-946d-58d54d69fa09 · Timestamp: 2026-11-17T18:50-05:00

- Action: Reviewer accepted the template/publishing slice after hearing the two judgement points (conditional cross-repo pin; golden crawler bytes). No move run.
- Result: Narrative blocks 1–3 ✅, block 4 current; refreshed four stale line references (`utils.js` 356→295, never-repaint guard 589→598, render null 1267→1273, adopted gate 453→459) — drift from the review-pass commit.
- Evidence: `src/detailGeometry.contract.test.js:32` skip-vs-fail; `WiSaw.cdk/tests/detail-template-copy-once.js` golden-body block.
- Open: Blocks 4–9; branches unpushed.

## 10 — block 4 seam producers → ✅; block 5 presented

Session: 75172b46-3f17-43bc-946d-58d54d69fa09 · Timestamp: 2026-11-17T18:53-05:00

- Action: Reviewer accepted the seam slice after the two judgement points (guard keyed on `source` not route; refresh deliberately narrow). No move run.
- Result: Narrative blocks 1–4 ✅, block 5 current. Verified `collectFrameNodes` is shared by both producers (`detailSkeleton.js:88`, `:268`) and that `captureDetailSkeleton` runs pre-mount from `src/index.js:27`.
- Evidence: narrative section 4 bullets re-checked against source.
- Open: Blocks 5–9; branches unpushed.

## 11 — block 5 page component — `thoughts`

Session: 75172b46-3f17-43bc-946d-58d54d69fa09 · Timestamp: 2026-11-17T18:57-05:00

- Action: Ran `thoughts` on the page-component slice with source checks rather than restating it.
- Result: No orphaned CSS from the deleted card (`mainImage`/`thumbnailImage` absent from JS and CSS; surviving classes still used by the placeholder). Placeholder square vs template aspect-ratio box confirmed as an accepted divergence; the "cannot shift the page" comment at `PhotosComponent.js:1289` is true only because nothing else paints below it. Cold-nav header handoff verified coherent (`App.js:206`, `:220`). Nits filed: two exported-but-internal constants in `detailLayout.js`; stray space `PhotosComponent.js:1243`; double spaces at `:506`/`:545`. Block stays open.
- Evidence: class-by-class grep of deleted card classes; `detailLayout.js:53` vs `detailTemplate.generated.js:106`.
- Open: Block 5 acceptance; Blocks 6–9.

## 12 — full restart requested: statuses cleared, pass 2 at slow pace

Session: 75172b46-3f17-43bc-946d-58d54d69fa09 · Timestamp: 2026-11-17T19:00-05:00

- Action: Reviewer asked to resume from Block 1 and chose a full restart with a slower, question-driven pace. All narrative block marks cleared; Block 1 set current, blocks 2–9 not visited.
- Result: Acceptances given in the first pass (blocks 1–4) are withdrawn as review state; nothing was reverted in code — commits `a07ee61`, `c88ed04`, `74747f4`, `7d4bf72`, `292f323`, `036a3a8`, `d0b756f` stand. Block 5's `thoughts` findings (entry 11) remain available and still apply.
- Evidence: narrative header statuses; log entries 4–11 for the first pass.
- Open: Blocks 1–9 re-walked one at a time; cosmetic nits from entry 11 still unfixed; branches unpushed.

## 13 — all blocks closed by reviewer instruction

Session: 75172b46-3f17-43bc-946d-58d54d69fa09 · Timestamp: 2026-11-17T20:00-05:00

- Action: Reviewer asked to close every block without continuing the walkthrough. Narrative sections 1–9 all marked ✅.
- Result: Closure is by instruction, not uniform review — read the record that way. Block 1 had `thoughts` plus two formal review passes; blocks 2–4 were accepted on a fast first pass (later withdrawn, then re-accepted here); block 5 had `thoughts` with findings still open; blocks 6–9 were never presented in detail. Nothing was verified or changed in code by this closure.
- Evidence: log entries 4–12 for what each block actually received.
- Open: cosmetic nits (entry 11); push of both branches and PRs; CDK CORS deploy still pending before wording parity goes live.
