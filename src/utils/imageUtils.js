/**
 * Helper function to calculate optimized thumbnail dimensions
 * Uses width and height from GraphQL to calculate efficient thumbnail sizes
 */
export const getOptimizedThumbnailDimensions = (photo, containerWidth = 244) => {
  if (!photo.width || !photo.height) return { width: containerWidth, height: 200 }

  const aspectRatio = photo.width / photo.height
  const maxHeight = 300 // Maximum height for thumbnails
  const minWidth = 150 // Minimum width for thumbnails

  let width = Math.min(containerWidth, photo.width)
  let height = width / aspectRatio

  if (height > maxHeight) {
    height = maxHeight
    width = height * aspectRatio
  }

  // Ensure minimum width for better layout
  if (width < minWidth) {
    width = minWidth
    height = width / aspectRatio
  }

  return {
    width: Math.round(width),
    height: Math.round(height)
  }
}

// Server-generated feed thumbnails are always 300px tall (WiSaw.cdk
// processUploadedImage sharp resize({ height: 300 })), so the natural thumb
// width is 300 × photo aspect ratio. Verified against production thumbs.
const FEED_THUMB_HEIGHT = 300

// Single source of truth for the Home masonry layout: consumed by
// <Masonry breakpointCols> in Home.js and by getFeedColumnWidth below.
// Keys other than 'default' are max-viewport breakpoints, matching
// react-masonry-css `windowWidth <= breakpoint` semantics.
export const FEED_BREAKPOINT_COLS = { default: 4, 1100: 3, 700: 2, 500: 1 }

const FEED_GUTTER = 20 // .masonry-grid margin-left / column padding-left in PhotosComponent.css
const FEED_CONTAINER_RATIO = 0.9 // Home content wrapper width: 90%
const FEED_CONTAINER_MAX = 1120 // Home content wrapper maxWidth

const getFeedColumnCount = (viewportWidth) => {
  for (const key of Object.keys(FEED_BREAKPOINT_COLS)) {
    if (key !== 'default' && viewportWidth <= Number(key)) {
      return FEED_BREAKPOINT_COLS[key]
    }
  }
  return FEED_BREAKPOINT_COLS.default
}

/**
 * Content width of one Home masonry column, mirroring the real layout:
 * .masonry-grid is widened by its -20px margin, each column loses a 20px
 * padding-left gutter, and the container is 90% of the page content width
 * capped at 1120px. Column count follows FEED_BREAKPOINT_COLS against the
 * viewport width (same measure react-masonry-css uses).
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
 * Display box for a Home feed thumbnail: never larger than the thumb's
 * natural size, never wider than its column. Use for width/height attrs so
 * lazy-loaded images keep a stable box (no layout shift). When photo dims
 * are unknown, naturalWidth is null and callers should fall back to
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

/**
 * Helper function specifically for search component flexible grid layout
 * Calculates dimensions that work well in a flexible grid with variable sizes
 */
export const getSearchGridDimensions = (photo, maxWidth) => {
  if (!photo.width || !photo.height) return { width: 200, height: 150 }

  // Responsive max width based on screen size
  if (!maxWidth) {
    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1200
    maxWidth = screenWidth < 768 ? 160 : screenWidth < 1024 ? 220 : 280
  }

  const aspectRatio = photo.width / photo.height
  const maxHeight = typeof window !== 'undefined' && window.innerWidth < 768 ? 200 : 250
  const minWidth = typeof window !== 'undefined' && window.innerWidth < 768 ? 120 : 160
  const minHeight = typeof window !== 'undefined' && window.innerWidth < 768 ? 90 : 120

  let width = Math.min(maxWidth, photo.width * 0.3) // Scale down for grid display
  let height = width / aspectRatio

  // Apply height constraints
  if (height > maxHeight) {
    height = maxHeight
    width = height * aspectRatio
  }

  if (height < minHeight) {
    height = minHeight
    width = height * aspectRatio
  }

  // Apply width constraints
  if (width < minWidth) {
    width = minWidth
    height = width / aspectRatio
  }

  return {
    width: Math.round(width),
    height: Math.round(height)
  }
}
