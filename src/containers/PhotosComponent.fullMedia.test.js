/* eslint-disable react/react-in-jsx-scope */
import { createElement } from 'react'

import { act, fireEvent, render, screen } from '@testing-library/react'
import { HelmetProvider } from '@dr.pogodin/react-helmet'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// A variable-aware stand-in for AppSync: the same query is issued for curr/next/prev, so the answer
// has to follow `variables.photoId` for a navigation to land on a different record.
const api = vi.hoisted(() => ({ pages: null }))
vi.mock('../consts', () => ({
  gqlClient: {
    query: ({ query, variables }) => {
      const page = api.pages?.[variables.photoId]
      if (page === undefined) {
        return new Promise(() => {})
      }
      // The component issues three operations per page; answer each from its own field so a test
      // can hold next/prev open while curr settles.
      const operation = query?.definitions?.[0]?.name?.value
      return Promise.resolve({ data: { [operation]: page[operation] ?? null } })
    }
  }
}))
vi.mock('react-ga4', () => ({ default: { initialize: vi.fn(), send: vi.fn() } }))
vi.mock('./Footer', () => ({ default: () => createElement('footer', null, 'site footer') }))

const PhotosComponent = (await import('./PhotosComponent')).default
const { FULL_MEDIA_WARM_DELAY_MS } = await import('../utils/mediaUpgrade')
const { DETAIL_MOBILE_BREAKPOINT } = await import('../utils/detailLayout')

const record = (id) => ({
  photo: {
    id,
    imgUrl: `https://img.wisaw.com/${id}.webp`,
    thumbUrl: `https://img.wisaw.com/${id}-thumb.webp`,
    videoUrl: '',
    video: false,
    watchersCount: 10,
    duration: 0,
    width: '2250',
    height: '3000',
    createdAt: '2026-10-01T10:00:00.000Z'
  },
  comments: [{ id: `c-${id}`, comment: `comment ${id}` }],
  recognitions: []
})

const FEED_PHOTO = record('777').photo
const FULL_777 = FEED_PHOTO.imgUrl
const THUMB_777 = FEED_PHOTO.thumbUrl
const FULL_888 = `https://img.wisaw.com/888.webp`

const setViewport = (width) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
}

const renderDetail = (state = { feedPhoto: FEED_PHOTO }) => render(
  <HelmetProvider>
    <MemoryRouter initialEntries={[{ pathname: '/photos/777', state }]}>
      <Routes>
        <Route path='/photos/:photoId' element={<PhotosComponent />} />
      </Routes>
    </MemoryRouter>
  </HelmetProvider>
)

const mainImage = () => document.querySelector('.mainImage')
const thumbImage = () => document.querySelector('.thumbnailImage')

// The mocked GraphQL call settles on microtasks only, so a burst of awaits flushes hydration
// without depending on timers (which are faked for the warm-delay cases).
const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 12; i++) {
      await Promise.resolve()
    }
  })
}

describe('detail page full-resolution media budget', () => {
  let requested

  beforeEach(() => {
    vi.useFakeTimers()
    window.scrollTo = vi.fn()
    api.pages = null

    requested = []
    class TrackedImage {
      set src (value) {
        requested.push(value)
      }
    }
    window.Image = TrackedImage
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('paints only the thumbnail on a cold mobile link, and asks for no original', () => {
    setViewport(DETAIL_MOBILE_BREAKPOINT - 310)
    renderDetail()

    expect(thumbImage()?.getAttribute('src')).toBe(THUMB_777)
    expect(mainImage()).toBeNull()
    expect(requested).toContain(THUMB_777)
    expect(requested).not.toContain(FULL_777)
  })

  it('warms the original after load plus the quiet delay without painting it', () => {
    setViewport(390)
    renderDetail()

    act(() => {
      vi.advanceTimersByTime(FULL_MEDIA_WARM_DELAY_MS - 1)
    })
    expect(requested).not.toContain(FULL_777)

    act(() => {
      vi.advanceTimersByTime(1)
    })

    expect(requested).toContain(FULL_777)
    expect(mainImage()).toBeNull()
  })

  it('paints the warmed original on the first pointer press', () => {
    setViewport(390)
    renderDetail()
    act(() => {
      vi.advanceTimersByTime(FULL_MEDIA_WARM_DELAY_MS)
    })

    fireEvent.pointerDown(window)

    expect(mainImage()?.getAttribute('src')).toBe(FULL_777)
    expect(thumbImage()).not.toBeNull()
    // The sharp image fades in instead of being rastered inside the input's own frame (INP).
    expect(mainImage()?.style.opacity).toBe('0')
  })

  it('upgrades at once when the visitor interacts before the delay is due', () => {
    setViewport(390)
    renderDetail()

    fireEvent.keyDown(window, { key: 'Escape' })
    act(() => {
      vi.advanceTimersByTime(FULL_MEDIA_WARM_DELAY_MS)
    })

    expect(mainImage()?.getAttribute('src')).toBe(FULL_777)
  })

  it('keeps the original painted when the viewport narrows again', () => {
    setViewport(390)
    renderDetail()

    fireEvent.wheel(window)
    expect(mainImage()?.getAttribute('src')).toBe(FULL_777)

    setViewport(DETAIL_MOBILE_BREAKPOINT - 200)
    fireEvent.resize(window)
    expect(mainImage()?.getAttribute('src')).toBe(FULL_777)
  })

  it('paints the original at hydration at or above the breakpoint', () => {
    setViewport(DETAIL_MOBILE_BREAKPOINT + 324)
    renderDetail()

    const overlay = mainImage()
    expect(overlay?.getAttribute('src')).toBe(FULL_777)
    expect(overlay?.getAttribute('fetchpriority')).toBe('high')
    expect(overlay?.getAttribute('decoding')).toBe('async')
  })

  it('opens the gate at or above the breakpoint after a rotation', () => {
    setViewport(390)
    renderDetail()
    expect(mainImage()).toBeNull()

    setViewport(DETAIL_MOBILE_BREAKPOINT + 100)
    fireEvent.resize(window)

    expect(mainImage()?.getAttribute('src')).toBe(FULL_777)
  })

  it('paints the next record in full once a tap on next navigates', async () => {
    api.pages = {
      777: { getPhotoAllCurr: record('777'), getPhotoAllNext: record('888'), getPhotoAllPrev: null },
      888: { getPhotoAllCurr: record('888'), getPhotoAllNext: null, getPhotoAllPrev: record('777') }
    }
    setViewport(390)
    renderDetail()
    await flush()

    // Neighbours obey the same gate: the next record's original is not even fetched yet.
    expect(mainImage()).toBeNull()
    expect(requested).not.toContain(FULL_888)

    const nextButton = screen.getByText(/next/)
    // A real tap is a pointerdown before it is a click, and that pointerdown is the interaction.
    fireEvent.pointerDown(nextButton)
    fireEvent.click(nextButton)
    await flush()

    expect(mainImage()?.getAttribute('src')).toBe(FULL_888)
  })

  it('paints only the thumbnail on a cold deep link, with no router state to lean on', async () => {
    api.pages = { 777: { getPhotoAllCurr: record('777'), getPhotoAllNext: null, getPhotoAllPrev: null } }
    setViewport(390)
    renderDetail(null)
    await flush()

    expect(thumbImage()?.getAttribute('src')).toBe(THUMB_777)
    expect(mainImage()).toBeNull()
    expect(requested).not.toContain(FULL_777)
  })

  it('paints the current record as soon as its own query settles, without waiting on neighbours', async () => {
    api.pages = { 777: { getPhotoAllCurr: record('777') } }
    setViewport(390)
    renderDetail(null)

    // Before hydration the cold deep link shows the reserved skeleton frame.
    expect(document.querySelector('.loading-spinner')).not.toBeNull()

    await flush()

    // Its neighbours never settle, yet the current record's media is already on screen - the LCP
    // candidate no longer waits for a neighbour round-trip.
    expect(thumbImage()?.getAttribute('src')).toBe(THUMB_777)
    expect(mainImage()).toBeNull()
    expect(document.querySelector('.loading-spinner')).toBeNull()
  })

  it('asks for the original once, not once per re-render', () => {
    setViewport(390)
    renderDetail()

    act(() => {
      vi.advanceTimersByTime(FULL_MEDIA_WARM_DELAY_MS)
    })
    fireEvent.resize(window)
    fireEvent.resize(window)

    expect(requested.filter((src) => src === FULL_777)).toHaveLength(1)
  })

  it('paints at hydration when the visitor interacted before this lazy chunk was even loaded', () => {
    Object.defineProperty(window.navigator, 'userActivation', {
      configurable: true,
      value: { hasBeenActive: true }
    })
    setViewport(390)

    try {
      renderDetail()

      expect(mainImage()?.getAttribute('src')).toBe(FULL_777)
      expect(requested).toContain(FULL_777)
    } finally {
      Object.defineProperty(window.navigator, 'userActivation', { configurable: true, value: undefined })
    }
  })
})
