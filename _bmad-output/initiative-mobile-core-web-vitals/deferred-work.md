# Deferred Work — Mobile Core Web Vitals

Appended findings that are not this change's problem to solve. Do not rewrite existing entries.

- source_plan: `_bmad-output/initiative-mobile-core-web-vitals/plan-defer-full-res-paint-mobile.md`
  summary: Below the detail breakpoint and before any input, the only `<img>` in the media box is the ~30 KB `-thumb.webp`, so a native long-press "Save Image"/share sheet may offer the thumbnail instead of the original.
  evidence: Unverified — `pointerdown` starts a long press and opens the paint gate immediately, mounting the full-resolution overlay inside the ~500 ms hold, so the OS may already target the overlay; jsdom cannot tell which element iOS/Android pick. Settle it on a real device: open a `/photos/<id>` link cold at phone width, hold on the image without tapping first, and check which URL the save sheet resolves to (and whether the saved file is `<id>.webp` or `<id>-thumb.webp`).
