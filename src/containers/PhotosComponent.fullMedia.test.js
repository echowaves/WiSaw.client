/* eslint-disable react/react-in-jsx-scope */
import { createElement } from 'react'

import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// A variable-aware stand-in for AppSync: the same query is issued for curr/next/prev, so the answer
// has to follow `variables.photoId` for a navigation to land on a different record. Operations
// listed in `api.hang` never settle, which is how a test holds next/prev open while curr answers.
const api = vi.hoisted(() => ({ pages: null, hang: null }))
vi.mock('../consts', () => ({
  gqlClient: {
    query: ({ query, variables }) => {
      const operation = query?.definitions?.[0]?.name?.value
      if (api.hang?.includes(`${variables.photoId}:${operation}`)) {
        return new Promise(() => {})
      }
      const page = api.pages?.[variables.photoId]
      if (page === undefined) {
        return new Promise(() => {})
      }
      // The component issues three operations per page; answer each from its own field so a test
      // can hold next/prev open while curr settles.
      return Promise.resolve({ data: { [operation]: page[operation] ?? null } })
    }
  }
}))
vi.mock('react-ga4', () => ({ default: { initialize: vi.fn(), send: vi.fn() } }))
vi.mock('./Footer', () => ({ default: () => createElement('footer', null, 'site footer') }))

const PhotosComponent = (await import('./PhotosComponent')).default
const { FULL_MEDIA_WARM_DELAY_MS } = await import('../utils/mediaUpgrade')
const { DETAIL_MOBILE_BREAKPOINT } = await import('../utils/detailLayout')

// This suite exercises the fully client-rendered page: no edge skeleton is captured here, so the
// single-img media model and its two gates (warm after quiet, paint after first input) are what
// get pinned. The adopted-skeleton path is covered by detailSkeleton.seam.test.js.
const record = (id, overrides = {}) => ({
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
    createdAt: '2026-10-01T10:00:00.000Z',
    ...overrides
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
  <MemoryRouter initialEntries={[{ pathname: '/photos/777', state }]}>
    <Routes>
      <Route path='/photos/:photoId' element={<PhotosComponent />} />
    </Routes>
  </MemoryRouter>
)

const mainImage = () => document.querySelector('img.mainImage')
const thumbLayer = () => document.querySelector('.thumbnailImage')

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
    api.hang = null

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

  it('paints only the thumbnail on a cold mobile deep link, and asks for no original', async () => {
    api.pages = { 777: { getPhotoAllCurr: record('777'), getPhotoAllNext: null, getPhotoAllPrev: null } }
    setViewport(390)
    renderDetail(null)

    expect(document.querySelector('.loading-spinner')).not.toBeNull()
    expect(mainImage()).toBeNull()

    await flush()

    // One media node, at the thumb source - there is no second layer to swap in later.
    expect(mainImage()?.getAttribute('src')).toBe(THUMB_777)
    expect(thumbLayer()).toBeNull()
    expect(requested).toContain(THUMB_777)
    expect(requested).not.toContain(FULL_777)
  })

  it('paints the current record as soon as its own query settles, without waiting on neighbours', async () => {
    // Only curr answers; next/prev hang open forever. The LCP paint must not wait for them.
    api.pages = { 777: { getPhotoAllCurr: record('777') } }
    api.hang = ['777:getPhotoAllNext', '777:getPhotoAllPrev']
    setViewport(390)
    renderDetail(null)

    expect(document.querySelector('.loading-spinner')).not.toBeNull()

    await flush()

    expect(mainImage()?.getAttribute('src')).toBe(THUMB_777)
    expect(document.querySelector('.loading-spinner')).toBeNull()
  })

  it('paints the decoded thumbnail immediately when the feed card passed its record', () => {
    setViewport(390)
    renderDetail()

    // The feed card just displayed this thumbnail, so the first commit paints it - no spinner.
    // Below the breakpoint the load effect still starts it transparent: the raster happens on the
    // img's own load event, not inside React's commit frame.
    expect(document.querySelector('.loading-spinner')).toBeNull()
    const media = mainImage()
    expect(media?.getAttribute('src')).toBe(THUMB_777)
    expect(media?.style.opacity).toBe('0')
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
    // Warming is a background pull only - the painted source stays the thumb.
    expect(mainImage()?.getAttribute('src')).toBe(THUMB_777)
  })

  it('paints the warmed original on the first pointer press', () => {
    setViewport(390)
    renderDetail()
    act(() => {
      vi.advanceTimersByTime(FULL_MEDIA_WARM_DELAY_MS)
    })

    fireEvent.pointerDown(window)

    expect(mainImage()?.getAttribute('src')).toBe(FULL_777)
    // The sharp image fades in instead of being rastered inside the input's own frame (INP).
    expect(mainImage()?.style.opacity).toBe('0')
  })

  it('upgrades at once when the visitor interacts before the delay is due', () => {
    setViewport(390)
    renderDetail()

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(mainImage()?.getAttribute('src')).toBe(FULL_777)
    expect(requested).toContain(FULL_777)
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

    const media = mainImage()
    expect(media?.getAttribute('src')).toBe(FULL_777)
    expect(media?.getAttribute('fetchpriority')).toBe('high')
    expect(media?.getAttribute('decoding')).toBe('async')
  })

  it('opens the gate at or above the breakpoint after a rotation', () => {
    setViewport(390)
    renderDetail()
    expect(mainImage()?.getAttribute('src')).toBe(THUMB_777)

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
    expect(mainImage()?.getAttribute('src')).toBe(THUMB_777)
    expect(requested).not.toContain(FULL_888)

    const nextButton = screen.getByText(/next/)
    // A real tap is a pointerdown before it is a click, and that pointerdown is the interaction.
    fireEvent.pointerDown(nextButton)
    fireEvent.click(nextButton)
    await flush()

    expect(mainImage()?.getAttribute('src')).toBe(FULL_888)
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

  it('never upgrades a video to an image source; the player keeps its poster', async () => {
    api.pages = {
      777: { getPhotoAllCurr: record('777', { video: true, videoUrl: 'https://img.wisaw.com/777.mp4' }), getPhotoAllNext: null, getPhotoAllPrev: null }
    }
    setViewport(390)
    renderDetail(null)
    await flush()

    const poster = thumbLayer()
    expect(poster?.getAttribute('src')).toBe(THUMB_777)
    expect(document.querySelector('video.mainImage source')?.getAttribute('src'))
      .toBe('https://img.wisaw.com/777.mp4')
    expect(mainImage()).toBeNull()

    // No warm, no input: a video page has no full-resolution image to pull at all.
    act(() => {
      vi.advanceTimersByTime(FULL_MEDIA_WARM_DELAY_MS)
    })
    fireEvent.pointerDown(window)

    expect(requested).not.toContain(FULL_777)
    expect(mainImage()).toBeNull()
  })

  it('falls back to the thumbnail when a painted image source fails, never leaving a broken icon', async () => {
    // The single media node carries the original below-deck until the paint gate swaps it, so its
    // error path must re-point that very node at the thumb and fade it in - otherwise a 404 shows
    // the browser's broken-image placeholder at full opacity.
    api.pages = { 777: { getPhotoAllCurr: record('777'), getPhotoAllNext: null, getPhotoAllPrev: null } }
    setViewport(390)
    renderDetail(null)
    await flush()

    fireEvent.pointerDown(window)
    expect(mainImage()?.getAttribute('src')).toBe(FULL_777)

    fireEvent.error(mainImage())

    expect(mainImage()?.getAttribute('src')).toBe(THUMB_777)
    expect(mainImage()?.style.opacity).toBe('1')
  })

  it('anchors prev/next to the content container on the client-rendered page', async () => {
    // The other half of the handoff contract: adopted mode anchors navigation to an anchor inside the
    // edge's column precisely because this is where they sit once React owns the page. Moving them
    // here (or changing this element's box) re-opens the visible jump and must fail this test too.
    api.pages = {
      777: { getPhotoAllCurr: record('777'), getPhotoAllNext: record('888'), getPhotoAllPrev: record('666') }
    }
    setViewport(1024)
    renderDetail()
    await flush()

    const main = document.querySelector('main.content-container')
    expect(main).not.toBeNull()
    for (const label of [/prev/, /next/]) {
      const link = screen.getByText(label).closest('a')
      expect(link.parentElement, `${label} is a direct child of <main>`).toBe(main)
      expect(main.style.position).toBe('relative')
    }
  })
})
