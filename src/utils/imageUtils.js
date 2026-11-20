// Server-generated feed thumbnails are always 300px tall (WiSaw.cdk
// processUploadedImage sharp resize({ height: 300 })), so the natural thumb
// width is 300 × photo aspect ratio. Verified against production thumbs.
const FEED_THUMB_HEIGHT = 300

// Single source of truth for the feed masonry layout, on `/` and `/search/:term` alike: consumed
// by <Masonry breakpointCols> in containers/FeedGrid.js and by getFeedColumnWidth below.
// Keys other than 'default' are max-viewport breakpoints, matching
// react-masonry-css `windowWidth <= breakpoint` semantics.
export const FEED_BREAKPOINT_COLS = { default: 4, 1100: 3, 700: 2, 500: 1 }

const FEED_GUTTER = 20 // .masonry-grid margin-left / column padding-left in PhotosComponent.css
const FEED_CONTAINER_RATIO = 0.9 // FeedGrid content wrapper width: 90%
const FEED_CONTAINER_MAX = 1120 // FeedGrid content wrapper maxWidth

const getFeedColumnCount = (viewportWidth) => {
  for (const key of Object.keys(FEED_BREAKPOINT_COLS)) {
    if (key !== 'default' && viewportWidth <= Number(key)) {
      return FEED_BREAKPOINT_COLS[key]
    }
  }
  return FEED_BREAKPOINT_COLS.default
}

/**
 * Content width of one feed masonry column, mirroring the real layout in
 * containers/FeedGrid.js: .masonry-grid is widened by its -20px margin, each
 * column loses a 20px padding-left gutter, and the container is 90% of the
 * page content width capped at 1120px. Column count follows
 * FEED_BREAKPOINT_COLS against the viewport width (same measure
 * react-masonry-css uses). Change FeedGrid's wrapper with this.
 * @param {number} viewportWidth - window.innerWidth equivalent
 * @param {number} pageContentWidth - scrollbar-free page width (clientWidth)
 * @returns {number} Column content width in pixels
 */
export const getFeedColumnWidth = (viewportWidth, pageContentWidth) => {
  const containerWidth = Math.min(pageContentWidth * FEED_CONTAINER_RATIO, FEED_CONTAINER_MAX)
  const columns = getFeedColumnCount(viewportWidth)

  return (containerWidth + FEED_GUTTER) / columns - FEED_GUTTER
}

/**
 * Display box for a feed thumbnail — the same helper backs `/` and
 * `/search/:term` through containers/FeedGrid.js: never larger than the
 * thumb's natural size, never wider than its column. Use for width/height
 * attrs so lazy-loaded images keep a stable box (no layout shift). When photo
 * dims are unknown, naturalWidth is null and callers should fall back to
 * full-column sizing instead of guessing.
 * @param {Object} photo - Photo with width/height from GraphQL
 * @returns {{width: number|null, height: number|null, naturalWidth: number|null}} Sizes in pixels; null when the photo's aspect ratio is unknown
 */
export const getFeedThumbSize = (photo) => {
  if (typeof window === 'undefined') {
    return { width: null, height: null, naturalWidth: null }
  }

  const columnWidth = getFeedColumnWidth(
    window.innerWidth,
    document.documentElement.clientWidth || window.innerWidth
  )

  if (!photo?.width || !photo?.height) {
    return { width: null, height: null, naturalWidth: null }
  }

  const aspectRatio = photo.width / photo.height
  const naturalWidth = Math.round(FEED_THUMB_HEIGHT * aspectRatio)
  const width = Math.min(columnWidth, naturalWidth)

  return { width, height: Math.round(width / aspectRatio), naturalWidth }
}
