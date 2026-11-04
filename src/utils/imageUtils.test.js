import { describe, expect, it } from 'vitest'
import { FEED_BREAKPOINT_COLS, getFeedColumnWidth, getFeedThumbSize } from './imageUtils'

// jsdom default viewport: window.innerWidth = 1024. Note Element.clientWidth is 0 in jsdom,
// so getFeedThumbSize exercises its `|| window.innerWidth` fallback unless clientWidth is stubbed.

// Mirror of the production layout for expected values:
// container = min(pageContentWidth * 0.9, 1120); column = (container + 20) / cols - 20
const columnFor = (viewportWidth, pageContentWidth) => {
  const container = Math.min(pageContentWidth * 0.9, 1120)
  const columns = viewportWidth <= 500 ? 1 : viewportWidth <= 700 ? 2 : viewportWidth <= 1100 ? 3 : 4

  return (container + 20) / columns - 20
}

describe('getFeedColumnWidth', () => {
  it('matches the masonry content width on desktop (4 columns)', () => {
    expect(getFeedColumnWidth(1440, 1440)).toBeCloseTo(columnFor(1440, 1440), 6)
    // container = min(1296, 1120) = 1120 → (1120+20)/4 − 20 = 265
    expect(getFeedColumnWidth(1440, 1440)).toBeCloseTo(265, 6)
  })

  it('equals the container width for a single narrow column (gutter excluded)', () => {
    // iPhone-width viewport: container = 390*0.9 = 351 → (351+20)/1 − 20 = 351
    expect(getFeedColumnWidth(390, 390)).toBeCloseTo(351, 6)
  })

  it('uses two columns at the 700px breakpoint boundary', () => {
    // react-masonry-css matches `windowWidth <= breakpoint`
    expect(getFeedColumnWidth(700, 700)).toBeCloseTo(columnFor(700, 700), 6)
    expect(getFeedColumnWidth(701, 701)).toBeCloseTo(columnFor(701, 701), 6)
  })

  it('switches column counts at the shared breakpoints', () => {
    for (const vw of [1440, 1101, 1100, 1099, 701, 700, 699, 501, 500, 499, 320]) {
      expect(getFeedColumnWidth(vw, vw)).toBeCloseTo(columnFor(vw, vw), 6)
    }
  })

  it('pins the container at maxWidth on wide viewports despite page width changes', () => {
    // both 1425 and 1440 exceed 1120/0.9 after the 90% ratio, so the cap holds
    expect(getFeedColumnWidth(1440, 1425)).toBeCloseTo(getFeedColumnWidth(1440, 1440), 6)
    expect(getFeedColumnWidth(1440, 1425)).toBeCloseTo(265, 6)
  })

  it('follows the page content width below the maxWidth cap (e.g. scrollbar)', () => {
    const full = getFeedColumnWidth(900, 900)
    const withScrollbar = getFeedColumnWidth(900, 885) // 15px scrollbar

    expect(withScrollbar).toBeLessThan(full)
    // container 796.5 vs 810 → (x+20)/3 − 20
    expect(withScrollbar).toBeCloseTo((796.5 + 20) / 3 - 20, 6)
  })

  it('exposes the breakpoint map consumed by Masonry', () => {
    expect(FEED_BREAKPOINT_COLS).toEqual({ default: 4, 1100: 3, 700: 2, 500: 1 })
  })
})

describe('getFeedThumbSize', () => {
  // jsdom: innerWidth/clientWidth = 1024 → container 921.6, 3 cols, column ≈ 293.87
  const jsdomColumn = columnFor(1024, 1024)

  it('keeps portrait thumbs at their natural size when the column is wider', () => {
    // portrait 750x1000 → thumb is 300*(750/1000) = 225 wide naturally
    const size = getFeedThumbSize({ width: 750, height: 1000 })

    expect(size.naturalWidth).toBe(225)
    expect(size.width).toBeCloseTo(225, 6)
    expect(size.height).toBe(300)
  })

  it('caps landscape thumbs at the column width and preserves the aspect ratio', () => {
    const size = getFeedThumbSize({ width: 4000, height: 3000 })

    expect(size.naturalWidth).toBe(400)
    expect(size.width).toBeCloseTo(jsdomColumn, 6)
    expect(size.height).toBe(Math.round(jsdomColumn * (300 / 400)))
  })

  it('never upscales: display width never exceeds the natural thumb width', () => {
    const size = getFeedThumbSize({ width: 900, height: 1200 }) // natural 225 wide

    expect(size.width).toBeLessThanOrEqual(size.naturalWidth)
  })

  it('prefers documentElement.clientWidth over innerWidth when available', () => {
    // Stub a scrollbar-reduced page width (jsdom reports 0, which would hit the fallback)
    Object.defineProperty(document.documentElement, 'clientWidth', {
      value: 900,
      configurable: true
    })

    try {
      const size = getFeedThumbSize({ width: 4000, height: 3000 }) // natural 400 wide, capped

      // container = min(900*0.9, 1120) = 810; 3 cols → (830)/3 − 20 ≈ 256.67
      expect(size.width).toBeCloseTo(830 / 3 - 20, 6)
    } finally {
      delete document.documentElement.clientWidth
    }
  })

  it('returns nulls when the aspect ratio is unknown', () => {
    expect(getFeedThumbSize({ width: null, height: 300 })).toEqual({
      width: null,
      height: null,
      naturalWidth: null
    })
    expect(getFeedThumbSize(null)).toEqual({ width: null, height: null, naturalWidth: null })
  })
})
