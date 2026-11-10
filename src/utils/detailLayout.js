/**
 * Geometry for the photo/video detail page.
 *
 * The detail page reserves its skeleton slots from these numbers, so any change
 * here moves real content on screen. They live apart from PhotosComponent.js so
 * the maths can be unit-tested without mounting Apollo/router-dependent JSX.
 */

export const DETAIL_MAX_SIDE = 700
export const DETAIL_MOBILE_BREAKPOINT = 700
export const DETAIL_MOBILE_GUTTER = 40

/** Used when a record carries no usable width/height (also the pre-load default). */
export const UNKNOWN_DIMENSIONS = { width: 300, height: 300 }

/**
 * Vertical space held under the cold-load media placeholder. It is deliberately
 * unpainted: an empty transparent box contributes nothing to Cumulative Layout
 * Shift, while a mismatched guess does. Sized like the content that replaces it
 * (one comment panel + a labels row) so document height barely jumps.
 */
export const COLD_BELOW_MEDIA_RESERVE = 220

/** Placeholder pills mirroring renderRecognitionsH1's `labels.slice(0, 3)`. */
export const PLACEHOLDER_LABEL_COUNT = 3

const viewportWidth = () => (typeof window === 'undefined' ? DETAIL_MAX_SIDE : window.innerWidth)

/**
 * Display box for the detail media, from the photo's natural dimensions.
 * Long side capped at DETAIL_MAX_SIDE on desktop; full width minus a gutter below
 * the mobile breakpoint.
 */
export const computeDisplayDimensions = (photo, screenOverride) => {
  if (!photo?.width || !photo?.height) {
    return { ...UNKNOWN_DIMENSIONS }
  }

  const screenWidth = screenOverride ?? viewportWidth()

  if (screenWidth < DETAIL_MOBILE_BREAKPOINT) {
    const width = screenWidth - DETAIL_MOBILE_GUTTER
    const height = (photo.height / photo.width) * width
    return { width, height }
  }

  const naturalWidth = photo.width
  const naturalHeight = photo.height

  return {
    width: naturalWidth > naturalHeight ? DETAIL_MAX_SIDE : DETAIL_MAX_SIDE * naturalWidth / naturalHeight,
    height: naturalWidth < naturalHeight ? DETAIL_MAX_SIDE : DETAIL_MAX_SIDE * naturalHeight / naturalWidth
  }
}

/** Media-box placeholder for the cold-load skeleton (aspect ratio unknown). */
export const getPlaceholderDimensions = (screenOverride) => {
  if (typeof window === 'undefined' && screenOverride == null) {
    return { ...UNKNOWN_DIMENSIONS }
  }
  const screenWidth = screenOverride ?? viewportWidth()
  const side = screenWidth < DETAIL_MOBILE_BREAKPOINT ? screenWidth - DETAIL_MOBILE_GUTTER : DETAIL_MAX_SIDE
  return { width: side, height: side }
}
