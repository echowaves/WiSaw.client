# Deferred Work — Mobile Core Web Vitals

Appended findings that are not this change's problem to solve. Do not rewrite existing entries.

- source_plan: `_bmad-output/initiative-mobile-core-web-vitals/plan-defer-full-res-paint-mobile.md`
  summary: Below the detail breakpoint and before any input, the only `<img>` in the media box is the ~30 KB `-thumb.webp`, so a native long-press "Save Image"/share sheet may offer the thumbnail instead of the original.
  evidence: Unverified — `pointerdown` starts a long press and opens the paint gate immediately, mounting the full-resolution overlay inside the ~500 ms hold, so the OS may already target the overlay; jsdom cannot tell which element iOS/Android pick. Settle it on a real device: open a `/photos/<id>` link cold at phone width, hold on the image without tapping first, and check which URL the save sheet resolves to (and whether the saved file is `<id>.webp` or `<id>-thumb.webp`).

- source_plan: `_bmad-output/initiative-mobile-core-web-vitals/plan-static-detail-pages-portal-app.md`
  summary: After a client-side prev/next navigation on detail pages, the browser tab keeps the previous page's title — the edge serves the correct title per request, but nothing updates it during SPA navigation now that detail-route `<Helmet>` is gone.
  evidence: Real (verified by reading the diff): the deleted Helmet block was the only writer of `document.title` on detail routes. Proper fix belongs in the backend skeleton's inline script (`history.replaceState` with the record title after client navigation, or a small injected title-sync hook) — coordinate through `backend-solicitation-brief.md`; a client-side patch would re-introduce head ownership this plan removes.

- source_plan: `_bmad-output/initiative-mobile-core-web-vitals/plan-static-detail-pages-portal-app.md`
  summary: `detailSkeleton.js` rebuilds media URLs from the id (`MEDIA_ORIGIN` + `<id>.webp` / `-thumb.webp`), duplicating object-naming knowledge already encoded twice in the `index.html` inline scripts; a third copy.
  evidence: Real but low harm today — the derived URLs only seed the pre-hydration paint and are replaced by GraphQL values moments later; all three copies live in this repo and drift is caught for the inline pair by `lcpBootstrap.template.test.js`. The clean fix is the edge publishing `data-wisaw-src`/`data-wisaw-thumb` on the media node so the client reads, not derives — add to the brief when it is next amended.

- source_plan: `_bmad-output/initiative-mobile-core-web-vitals/plan-static-detail-pages-portal-app.md`
  summary: The real boot sequence in `src/index.js` (skeleton capture → conditional `#root` clear → sibling-container mount) has no test executing it; seam tests replicate the steps by hand.
  evidence: Real — repo search for imports of `index.js` finds none (only HTML references). Closing it means importing the entry module under jsdom with globals mocked, which is disproportionate against a 15-line script whose branches are individually pinned (`captureDetailSkeleton` unit paths via seam fixtures; the null-`#root` guard now exists after review).
