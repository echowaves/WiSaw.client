import { describe, expect, it } from 'vitest'
import {
  COLD_BELOW_MEDIA_RESERVE,
  DETAIL_MAX_SIDE,
  UNKNOWN_DIMENSIONS,
  computeDisplayDimensions,
  getPlaceholderDimensions
} from './detailLayout'

// The detail page reserves its skeleton slots from these numbers, so a change in
// the aspect maths silently moves visible content on screen (Cumulative Layout
// Shift). Pinned against the pre-extraction implementation of PhotosComponent.js.
describe('computeDisplayDimensions', () => {
  it('falls back to a 300x300 box when the record has no usable size', () => {
    expect(computeDisplayDimensions({ width: null, height: 1080 }, 1280)).toEqual(UNKNOWN_DIMENSIONS)
    expect(computeDisplayDimensions(undefined, 1280)).toEqual(UNKNOWN_DIMENSIONS)
  })

  it('returns a fresh object so callers can never mutate the shared fallback', () => {
    const first = computeDisplayDimensions({}, 1280)
    first.width = 1
    expect(computeDisplayDimensions({}, 1280)).toEqual(UNKNOWN_DIMENSIONS)
  })

  it('caps the long side at 700px on desktop, landscape', () => {
    expect(computeDisplayDimensions({ width: 1920, height: 1080 }, 1280))
      .toEqual({ width: DETAIL_MAX_SIDE, height: 393.75 })
  })

  it('caps the long side at 700px on desktop, portrait', () => {
    expect(computeDisplayDimensions({ width: 1080, height: 1920 }, 1280))
      .toEqual({ width: 393.75, height: DETAIL_MAX_SIDE })
  })

  it('uses the full viewport minus a 40px gutter below the breakpoint', () => {
    expect(computeDisplayDimensions({ width: 1920, height: 1080 }, 412))
      .toEqual({ width: 372, height: 209.25 })
  })

  it('keeps a square photo square at the mobile width', () => {
    expect(computeDisplayDimensions({ width: 1000, height: 1000 }, 412))
      .toEqual({ width: 372, height: 372 })
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
