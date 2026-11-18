import { describe, expect, it } from 'vitest'
import * as template from './detailTemplate.generated'
import {
  COLD_BELOW_MEDIA_RESERVE,
  DETAIL_MAX_SIDE,
  DETAIL_MOBILE_BREAKPOINT,
  HEADER_DESKTOP_PX,
  HEADER_MOBILE_PX,
  MEDIA_RADIUS_PX,
  UNKNOWN_DIMENSIONS,
  getPlaceholderDimensions
} from './detailLayout'

// The display box for a record's media is inline style built by the shared detail template now —
// the same module Lambda@Edge builds its body from — so this file only mirrors its numbers. A figure
// re-declared here would be a second answer to one question, which is what let one photo be laid out
// two ways depending on how the visitor arrived.
describe('the detail geometry is the shared template\'s', () => {
  it('re-exports every figure the template lays the frame out from', () => {
    expect(DETAIL_MAX_SIDE).toBe(template.DETAIL_MAX_SIDE)
    expect(DETAIL_MOBILE_BREAKPOINT).toBe(template.DETAIL_MOBILE_BREAKPOINT)
    expect(HEADER_DESKTOP_PX).toBe(template.HEADER_DESKTOP_PX)
    expect(HEADER_MOBILE_PX).toBe(template.HEADER_MOBILE_PX)
    expect(MEDIA_RADIUS_PX).toBe(template.MEDIA_RADIUS_PX)
    expect(COLD_BELOW_MEDIA_RESERVE).toBe(template.BELOW_MEDIA_RESERVE_PX)
  })

  it('sizes an unknown-dimension box with the template\'s own cap', () => {
    expect(UNKNOWN_DIMENSIONS).toEqual({
      width: template.DETAIL_UNKNOWN_DIMENSION_CAP_PX,
      height: template.DETAIL_UNKNOWN_DIMENSION_CAP_PX
    })
  })

  it('keeps the media radius the frame uses for both hosts', () => {
    // The box and the element inside it are rounded by the stylesheet this test file's module
    // re-exports; a second radius in app CSS would show as a visible seam at the corner.
    expect(template.SKELETON_STYLE).toContain(`border-radius:${MEDIA_RADIUS_PX}px`)
  })
})

describe('getPlaceholderDimensions', () => {
  it('mirrors the desktop max box while the aspect ratio is unknown', () => {
    expect(getPlaceholderDimensions(1280)).toEqual({ width: DETAIL_MAX_SIDE, height: DETAIL_MAX_SIDE })
  })

  it('mirrors the mobile full-width box below the breakpoint', () => {
    expect(getPlaceholderDimensions(412)).toEqual({ width: 372, height: 372 })
  })

  it('never hands out the shared fallback object on either branch', () => {
    expect(getPlaceholderDimensions(1280)).not.toBe(UNKNOWN_DIMENSIONS)

    const originalWindow = globalThis.window
    delete globalThis.window
    try {
      expect(getPlaceholderDimensions()).toEqual({ width: 300, height: 300 })
      getPlaceholderDimensions().width = 1
      expect(UNKNOWN_DIMENSIONS.width).toBe(300)
    } finally {
      globalThis.window = originalWindow
    }
  })
})

describe('COLD_BELOW_MEDIA_RESERVE', () => {
  it('is a positive, paint-free filler height for the cold skeleton', () => {
    expect(COLD_BELOW_MEDIA_RESERVE).toBeGreaterThan(0)
    expect(Number.isFinite(COLD_BELOW_MEDIA_RESERVE)).toBe(true)
  })
})
