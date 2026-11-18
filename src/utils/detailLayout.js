/**
 * Geometry for the photo/video detail page.
 *
 * The numbers come from the shared detail template — the module the edge paints
 * its body from and publishes into this repository verbatim — because a navigated
 * detail page is painted by that same template now. Two copies of these figures
 * is how a page drifted into two looks; see
 * WiSaw.cdk/tests/detail-template-copy-once.js for the pin on the source side.
 */

import {
  DETAIL_MAX_SIDE,
  DETAIL_UNKNOWN_DIMENSION_CAP_PX,
  DETAIL_MOBILE_BREAKPOINT,
  BELOW_MEDIA_RESERVE_PX,
  HEADER_DESKTOP_PX,
  HEADER_MOBILE_PX,
  MEDIA_RADIUS_PX
} from './detailTemplate.generated'

export {
  DETAIL_MAX_SIDE,
  DETAIL_UNKNOWN_DIMENSION_CAP_PX,
  DETAIL_MOBILE_BREAKPOINT,
  HEADER_DESKTOP_PX,
  HEADER_MOBILE_PX,
  MEDIA_RADIUS_PX
}

/** Kept under the app's own name so its cold-load placeholder reads as what it is. */
export const COLD_BELOW_MEDIA_RESERVE = BELOW_MEDIA_RESERVE_PX

/** Gutter the app's own detail container keeps at each side below the breakpoint. */
export const DETAIL_MOBILE_GUTTER = 40

/** Used when a record carries no usable width/height (also the pre-load default). */
export const UNKNOWN_DIMENSIONS = {
  width: DETAIL_UNKNOWN_DIMENSION_CAP_PX,
  height: DETAIL_UNKNOWN_DIMENSION_CAP_PX
}

/** Placeholder pills mirroring renderRecognitionsH1's `labels.slice(0, 3)`. */
export const PLACEHOLDER_LABEL_COUNT = 3

const viewportWidth = () => (typeof window === 'undefined' ? DETAIL_MAX_SIDE : window.innerWidth)

// There is no `computeDisplayDimensions` here any more. The display box for a record's media is
// inline style built by the shared template (`mediaBoxStyle` in detailTemplate.generated.js), which
// the edge and this app paint identically; an app-side second answer for the same question is what
// let one photo be sized two different ways depending on how the visitor arrived.

/** Media-box placeholder for the cold-load skeleton (aspect ratio unknown). */
export const getPlaceholderDimensions = (screenOverride) => {
  if (typeof window === 'undefined' && screenOverride == null) {
    return { ...UNKNOWN_DIMENSIONS }
  }
  const screenWidth = screenOverride ?? viewportWidth()
  const side = screenWidth < DETAIL_MOBILE_BREAKPOINT ? screenWidth - DETAIL_MOBILE_GUTTER : DETAIL_MAX_SIDE
  return { width: side, height: side }
}
