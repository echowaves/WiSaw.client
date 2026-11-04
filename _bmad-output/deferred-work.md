# Deferred Work

Log of review findings and observations deliberately not addressed in the current build. Add an entry per item; do not delete history.

## 2026-11-03 — mobile-thumb-no-upscale (quick lens pass 1)

- **Legacy dimension helpers are duplicated knowledge.** `getOptimizedThumbnailDimensions` / `getSearchGridDimensions` in `src/utils/imageUtils.js` hardcode their own caps and breakpoints, independent of the feed layout, and are still used by `SearchComponent.js`. The new `FEED_BREAKPOINT_COLS` / `getFeedColumnWidth` / `getFeedThumbSize` helpers are the single source of truth for Home. Migrating SearchComponent onto the new helpers (and deleting or reworking the legacy ones) is a separate change with its own manual QA on the search page.
