/* eslint-disable react/react-in-jsx-scope */
/**
 * Layout-parity contract for the two feed routes.
 *
 * `/` and `/search/:term` used to carry their own copy of the masonry card, and the copies drifted
 * (Search upscaled, cropped with object-fit and could show a different column count). Both now
 * render `FeedGrid`, so this mounts the real App on both routes with one record and compares the
 * cards: same classes, same width/height attrs, same inline sizing — differing only in alt text.
 * It also pins the guards that keep them from drifting again: no page may grow its own grid markup
 * or import the legacy search sizing helpers.
 */
import { readFileSync } from 'fs'
import { createElement } from 'react'

import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ feed: null, fail: false }))

vi.mock('./consts', () => ({
  gqlClient: {
    query: ({ query }) => {
      const operation = query?.definitions?.[0]?.name?.value
      if (operation === 'feedRecent' || operation === 'feedForTextSearch') {
        if (api.fail) {
          return Promise.reject(new Error('AppSync unreachable'))
        }
        return Promise.resolve({
          data: { [operation]: api.feed ?? { photos: [], batch: '0', noMoreData: true } }
        })
      }
      return new Promise(() => {})
    }
  }
}))
vi.mock('react-ga4', () => ({ default: { initialize: vi.fn(), send: vi.fn() } }))
// react-loader-spinner cannot mount under jsdom (same stand-in a11yLandmarks.test.js uses).
vi.mock('react-loader-spinner', () => ({ Bars: () => null }))
vi.mock('./containers/Header', () => ({
  default: () => createElement('header', { id: 'test-header' }, 'site header')
}))
vi.mock('./containers/Footer', () => ({
  default: () => createElement('footer', null, 'site footer')
}))

const App = (await import('./App')).default
const { FEED_BREAKPOINT_COLS, getFeedThumbSize } = await import('./utils/imageUtils')

// A landscape record wider than its column (so the box must cap at the column) carrying a comment
// (so the card's caption row is compared too), and a portrait record whose natural thumb width is
// narrower than the column (so nothing may upscale it). Same objects feed both routes.
// A third record so every column of the 3-column desktop breakpoint is occupied: react-masonry-css
// renders one column div per occupied column, so fewer items would hide the column-count check.
const LANDSCAPE_ID = 'a1e5c0de-0000-4000-8000-000000000001'
const PORTRAIT_ID = 'a1e5c0de-0000-4000-8000-000000000002'
const SQUARE_ID = 'a1e5c0de-0000-4000-8000-000000000003'
const RECORDS = [
  {
    id: LANDSCAPE_ID,
    video: false,
    width: 4000,
    height: 3000,
    thumbUrl: `https://img.wisaw.com/${LANDSCAPE_ID}-thumb.webp`,
    imgUrl: `https://img.wisaw.com/${LANDSCAPE_ID}.webp`,
    lastComment: 'A lake at dusk'
  },
  {
    id: PORTRAIT_ID,
    video: true,
    width: 750,
    height: 1000,
    thumbUrl: `https://img.wisaw.com/${PORTRAIT_ID}-thumb.webp`,
    imgUrl: `https://img.wisaw.com/${PORTRAIT_ID}.webp`
  },
  {
    id: SQUARE_ID,
    video: false,
    width: 1000,
    height: 1000,
    thumbUrl: `https://img.wisaw.com/${SQUARE_ID}-thumb.webp`,
    imgUrl: `https://img.wisaw.com/${SQUARE_ID}.webp`
  }
]

const recordById = (id) => RECORDS.find((record) => record.id === id)

// The search page's first frame already carries a <main>, so every round must run: stopping at the
// first landmark (as the a11y harness's flush does) could compare cards that were never drawn.
const settle = async (rounds = 40) => {
  for (let round = 0; round < rounds; round++) {
    await act(async () => {
      await new Promise((resolveTask) => { setTimeout(resolveTask, 5) })
    })
  }
}

const mountRoute = async (path) => {
  document.body.innerHTML = "<div id='root'></div><div id='wisaw-app'></div>"
  window.history.pushState({}, '', path)
  const view = render(<App />, { container: document.getElementById('wisaw-app') })
  await settle()
  return () => view.unmount()
}

const cardFor = (id) => {
  const link = document.querySelector(`main a[href^="/photos/${id}"], main a[href^="/videos/${id}"]`)
  return link?.closest('.home-thumb-card') ?? null
}

/**
 * Everything the two cards must agree on. alt and href are left out on purpose — the search route
 * owns its "{term} - WiSaw" copy — and normalising whitespace keeps the comparison about structure,
 * attributes and inline sizing rather than source formatting.
 */
const cardSignature = (card) => {
  const clone = card.cloneNode(true)
  for (const anchor of clone.querySelectorAll('a')) {
    anchor.removeAttribute('href')
  }
  for (const image of clone.querySelectorAll('img')) {
    image.removeAttribute('alt')
  }

  return {
    html: clone.outerHTML.replace(/\s+/g, ' ').trim(),
    classes: [...card.classList],
    imgAttrs: [...card.querySelectorAll('img')].map((image) => ({
      width: image.getAttribute('width'),
      height: image.getAttribute('height'),
      loading: image.getAttribute('loading'),
      styleWidth: image.style.width,
      styleMaxWidth: image.style.maxWidth,
      objectFit: image.style.objectFit || ''
    })),
    cardStyleWidth: card.style.width,
    cardStyleMarginInline: card.style.marginInline
  }
}

const columnCount = () => document.querySelectorAll('main .masonry-grid-column').length
const setViewportWidth = (width) => {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true })
}

const sourceOf = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8')

describe('feed layout parity between / and /search/:term', () => {
  beforeEach(() => {
    api.feed = { photos: RECORDS, batch: '0', noMoreData: true }
    api.fail = false
    setViewportWidth(1024)
  })

  afterEach(() => {
    api.feed = null
    api.fail = false
    setViewportWidth(1024)
    document.body.innerHTML = ''
    window.history.pushState({}, '', '/')
  })

  it('draws an identical card on both routes for the same record', async () => {
    const unmountFeed = await mountRoute('/')
    const feedCards = {}
    for (const { id } of RECORDS) {
      const card = cardFor(id)
      expect(card, `feed renders a card for ${id}`).not.toBeNull()
      feedCards[id] = cardSignature(card)
    }
    const feedColumns = columnCount()
    unmountFeed()

    const unmountSearch = await mountRoute('/search/lake')
    for (const { id } of RECORDS) {
      const searchCard = cardFor(id)
      expect(searchCard, `search page renders a card for ${id}`).not.toBeNull()
      // Identical down to the inline px box; only alt text and href may differ.
      expect(cardSignature(searchCard)).toEqual(feedCards[id])
    }
    // Same column count at the same viewport — the old inline literal could disagree with the
    // shared map. jsdom's viewport is 1024, i.e. the 1100 breakpoint.
    expect(feedColumns).toBe(FEED_BREAKPOINT_COLS[1100])
    expect(columnCount()).toBe(feedColumns)
    unmountSearch()
  })

  it('keeps each route its own alt text while the card stays shared', async () => {
    const unmountFeed = await mountRoute('/')
    expect(cardFor(PORTRAIT_ID).querySelector('img').getAttribute('alt')).toBe('Free stock video on WiSaw')
    expect(cardFor(LANDSCAPE_ID).querySelector('img').getAttribute('alt')).toBe('A lake at dusk')
    unmountFeed()

    // Layout parity must not cost the search route its SEO copy.
    const unmountSearch = await mountRoute('/search/lake')
    expect(cardFor(PORTRAIT_ID).querySelector('img').getAttribute('alt')).toBe('lake - WiSaw')
    expect(cardFor(LANDSCAPE_ID).querySelector('img').getAttribute('alt')).toBe('A lake at dusk')
    unmountSearch()
  })

  it('keeps search thumbs inside getFeedThumbSize so nothing upscales or crops', async () => {
    // Narrow viewport: the column is wide (one column), so the portrait box must stay at its
    // natural thumb width, and the object-fit cropping the old search card used must be gone.
    setViewportWidth(700)
    const unmount = await mountRoute('/search/lake')

    for (const record of RECORDS) {
      const img = cardFor(record.id).querySelector('img')
      const expected = getFeedThumbSize(record)

      expect(Number(img.getAttribute('width'))).toBeCloseTo(expected.width, 6)
      expect(Number(img.getAttribute('height'))).toBeCloseTo(expected.height, 6)
      expect(img.style.width).toBe(`${expected.width}px`)
      expect(img.style.objectFit).toBe('')
    }

    const portrait = cardFor(PORTRAIT_ID).querySelector('img')
    expect(Number(portrait.getAttribute('width'))).toBeLessThanOrEqual(225) // natural 300 * 750/1000
    unmount()
  })

  it('re-measures search card boxes when the viewport crosses a breakpoint', async () => {
    const unmount = await mountRoute('/search/lake')
    const img = cardFor(LANDSCAPE_ID).querySelector('img')
    const beforeWidth = img.getAttribute('width')
    expect(columnCount()).toBe(FEED_BREAKPOINT_COLS[1100])

    setViewportWidth(500)
    await act(async () => {
      window.dispatchEvent(new Event('resize'))
      await new Promise((resolveTask) => { setTimeout(resolveTask, 20) })
    })

    expect(columnCount()).toBe(FEED_BREAKPOINT_COLS[500])
    // Masonry alone would restack the columns; only a re-measure changes the inline box.
    expect(img.getAttribute('width')).not.toBe(beforeWidth)
    // One column at 500px is wider than three at 1024px, so the box now stops at the natural width.
    expect(Number(img.getAttribute('width'))).toBeCloseTo(getFeedThumbSize(recordById(LANDSCAPE_ID)).width, 6)
    unmount()
  })

  it.each([
    ['the empty search prompt', '/search', 'Search WiSaw'],
    ['the nothing-found state', '/search/zzznothing', 'Nothing found']
  ])('leaves %s alone and renders no feed markup for it', async (_label, path, expected) => {
    api.feed = { photos: [], batch: '0', noMoreData: true }
    const unmount = await mountRoute(path)

    const main = document.querySelector('main')
    expect(main).not.toBeNull()
    expect(main.textContent).toContain(expected)
    expect(document.querySelectorAll('main')).toHaveLength(1)
    expect(main.querySelector('.masonry-grid')).toBeNull()
    expect(main.textContent).not.toContain('Yay! You have seen it all')
    unmount()
  })

  it.each(['/', '/search/lake'])('still renders %s with a single main when the query fails', async (path) => {
    api.fail = true
    const unmount = await mountRoute(path)

    expect(document.querySelectorAll('main')).toHaveLength(1)
    expect(document.querySelector('.masonry-grid')).toBeNull()
    unmount()
  })

  it.each([
    ['./containers/Home.js'],
    ['./containers/SearchComponent.js']
  ])('keeps %s free of its own feed markup and legacy sizing', (relativePath) => {
    const source = sourceOf(relativePath)

    for (const marker of ['masonry-grid', 'home-thumb-card', 'Masonry', 'InfiniteScroll', 'Bars']) {
      expect(source, `${relativePath} must not draw ${marker} itself`).not.toContain(marker)
    }
    for (const dead of ['getOptimizedThumbnailDimensions', 'getSearchGridDimensions']) {
      expect(source).not.toContain(dead)
    }
  })

  it('retires the legacy search sizing helpers from imageUtils', () => {
    const utils = sourceOf('./utils/imageUtils.js')

    expect(utils).not.toContain('getOptimizedThumbnailDimensions')
    expect(utils).not.toContain('getSearchGridDimensions')
    expect(utils).toContain('getFeedThumbSize')
  })
})
