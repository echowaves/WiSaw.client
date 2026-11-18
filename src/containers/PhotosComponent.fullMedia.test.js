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
const detailSkeleton = await import('../utils/detailSkeleton')
const seoText = await import('../utils/detailSeoText')
const { FULL_MEDIA_WARM_DELAY_MS } = await import('../utils/mediaUpgrade')
const { DETAIL_MOBILE_BREAKPOINT } = await import('../utils/detailLayout')

// No published wording sidecar: these tests are about which bytes the media node asks for.
vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 404 })))

// This suite exercises the page the app paints itself (no edge skeleton captured), on the shared
// template: the single-media-node model and its two gates (warm after quiet, paint after first
// input) are what get pinned. The adopted-skeleton path is covered by detailSkeleton.seam.test.js.
const ID_A = '7b8a9c1d-2e3f-4a5b-6c7d-8e9f0a1b2c3d'
const ID_B = '4d2f6a18-9c3b-4e7a-8f52-1b6d0c9e3a71'
const ID_C = '0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0'

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

const FEED_PHOTO = record(ID_A).photo
const FULL_777 = FEED_PHOTO.imgUrl
const THUMB_777 = FEED_PHOTO.thumbUrl
const FULL_888 = record(ID_B).photo.imgUrl

const setViewport = (width) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
}

const renderDetail = (state = { feedPhoto: FEED_PHOTO }, id = ID_A) => {
  // The frame is painted into #root — the edge's mount point — and enhanced through portals.
  document.body.innerHTML = "<div id='root'></div><div id='wisaw-app'></div>"
  return render(
    <MemoryRouter initialEntries={[{ pathname: `/photos/${id}`, state }]}>
      <Routes>
        <Route path='/photos/:photoId' element={<PhotosComponent />} />
      </Routes>
    </MemoryRouter>
  )
}

const mediaNode = () => document.querySelector('#root [data-wisaw-media]')

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
    detailSkeleton.__resetDetailSkeletonForTests()
    seoText.__resetSeoTextForTests()

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
    document.body.innerHTML = ''
  })

  it('paints only the thumbnail on a cold mobile deep link, and asks for no original', async () => {
    api.pages = { [ID_A]: { getPhotoAllCurr: record(ID_A), getPhotoAllNext: null, getPhotoAllPrev: null } }
    setViewport(390)
    renderDetail(null)

    expect(document.querySelector('.loading-spinner')).not.toBeNull()
    expect(mediaNode()).toBeNull()

    await flush()

    // One media node, at the thumb source - there is no second layer to swap in later.
    expect(mediaNode()?.getAttribute('src')).toBe(THUMB_777)
    expect(document.querySelectorAll('#root .wsk-box img')).toHaveLength(1)
    expect(requested).toContain(THUMB_777)
    expect(requested).not.toContain(FULL_777)
  })

  it('paints the current record as soon as its own query settles, without waiting on neighbours', async () => {
    // Only curr answers; next/prev hang open forever. The LCP paint must not wait for them.
    api.pages = { [ID_A]: { getPhotoAllCurr: record(ID_A) } }
    api.hang = [`${ID_A}:getPhotoAllNext`, `${ID_A}:getPhotoAllPrev`]
    setViewport(390)
    renderDetail(null)

    expect(document.querySelector('.loading-spinner')).not.toBeNull()

    await flush()

    expect(mediaNode()?.getAttribute('src')).toBe(THUMB_777)
    expect(document.querySelector('.loading-spinner')).toBeNull()
  })

  it('paints the thumbnail immediately when the feed card passed its record', () => {
    setViewport(390)
    renderDetail()

    // The feed card just displayed this thumbnail, so the first commit paints it - no spinner.
    expect(document.querySelector('.loading-spinner')).toBeNull()
    expect(mediaNode()?.getAttribute('src')).toBe(THUMB_777)
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
    expect(mediaNode()?.getAttribute('src')).toBe(THUMB_777)
  })

  it('paints the warmed original on the first pointer press', () => {
    setViewport(390)
    renderDetail()
    act(() => {
      vi.advanceTimersByTime(FULL_MEDIA_WARM_DELAY_MS)
    })

    fireEvent.pointerDown(window)

    // The swap happens on the node already on screen, so nothing re-lays-out.
    expect(mediaNode()?.getAttribute('src')).toBe(FULL_777)
  })

  it('upgrades at once when the visitor interacts before the delay is due', () => {
    setViewport(390)
    renderDetail()

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(mediaNode()?.getAttribute('src')).toBe(FULL_777)
    expect(requested).toContain(FULL_777)
  })

  it('keeps the original painted when the viewport narrows again', () => {
    setViewport(390)
    renderDetail()

    fireEvent.wheel(window)
    expect(mediaNode()?.getAttribute('src')).toBe(FULL_777)

    setViewport(DETAIL_MOBILE_BREAKPOINT - 200)
    fireEvent.resize(window)
    expect(mediaNode()?.getAttribute('src')).toBe(FULL_777)
  })

  it('paints the original at hydration at or above the breakpoint', () => {
    setViewport(DETAIL_MOBILE_BREAKPOINT + 324)
    renderDetail()

    const media = mediaNode()
    expect(media?.getAttribute('src')).toBe(FULL_777)
    // The frame's own markup: eager, with the shell's preload script warming the bytes.
    expect(media?.getAttribute('loading')).toBe('eager')
  })

  it('opens the gate at or above the breakpoint after a rotation', () => {
    setViewport(390)
    renderDetail()
    expect(mediaNode()?.getAttribute('src')).toBe(THUMB_777)

    setViewport(DETAIL_MOBILE_BREAKPOINT + 100)
    fireEvent.resize(window)

    expect(mediaNode()?.getAttribute('src')).toBe(FULL_777)
  })

  it('paints the next record in full once a tap on next navigates', async () => {
    api.pages = {
      [ID_A]: { getPhotoAllCurr: record(ID_A), getPhotoAllNext: record(ID_B), getPhotoAllPrev: null },
      [ID_B]: { getPhotoAllCurr: record(ID_B), getPhotoAllNext: null, getPhotoAllPrev: record(ID_A) }
    }
    setViewport(390)
    renderDetail()
    await flush()

    // Neighbours obey the same gate: the next record's original is not even fetched yet.
    expect(mediaNode()?.getAttribute('src')).toBe(THUMB_777)
    expect(requested).not.toContain(FULL_888)

    const nextButton = screen.getByText(/next/)
    // A real tap is a pointerdown before it is a click, and that pointerdown is the interaction.
    fireEvent.pointerDown(nextButton)
    fireEvent.click(nextButton)
    await flush()

    // The tap's own pointerdown opened the paint gate, so the next page is painted sharp at once.
    expect(mediaNode()?.getAttribute('src')).toBe(FULL_888)
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

      expect(mediaNode()?.getAttribute('src')).toBe(FULL_777)
      expect(requested).toContain(FULL_777)
    } finally {
      Object.defineProperty(window.navigator, 'userActivation', { configurable: true, value: undefined })
    }
  })

  it('never upgrades a video to an image source; the player keeps its poster', async () => {
    api.pages = {
      [ID_A]: { getPhotoAllCurr: record(ID_A, { video: true, videoUrl: `https://img.wisaw.com/${ID_A}.mp4` }), getPhotoAllNext: null, getPhotoAllPrev: null }
    }
    setViewport(390)
    renderDetail(null)
    await flush()

    const media = mediaNode()
    expect(media.tagName).toBe('VIDEO')
    expect(media.getAttribute('poster')).toBe(THUMB_777)
    expect(media.getAttribute('src')).toBe(`https://img.wisaw.com/${ID_A}.mp4`)
    // One node, not a poster layer plus a player: the video wears its own thumbnail.
    expect(document.querySelectorAll('#root .wsk-box img')).toHaveLength(0)

    // No warm, no input: a video page has no full-resolution image to pull at all.
    act(() => {
      vi.advanceTimersByTime(FULL_MEDIA_WARM_DELAY_MS)
    })
    fireEvent.pointerDown(window)

    expect(requested).not.toContain(FULL_777)
    expect(document.querySelector('#root [data-wisaw-media]').tagName).toBe('VIDEO')
  })

  it('falls back to the thumbnail when a painted image source fails, never leaving a broken icon', async () => {
    // The media node carries the original below-deck until the paint gate swaps it, so its error
    // path must re-point that very node at the thumb - otherwise a 404 shows the browser's
    // broken-image placeholder.
    api.pages = { [ID_A]: { getPhotoAllCurr: record(ID_A), getPhotoAllNext: null, getPhotoAllPrev: null } }
    setViewport(390)
    renderDetail(null)
    await flush()

    fireEvent.pointerDown(window)
    expect(mediaNode()?.getAttribute('src')).toBe(FULL_777)

    fireEvent.error(mediaNode())

    expect(mediaNode()?.getAttribute('src')).toBe(THUMB_777)
  })

  it('anchors prev/next to the frame column, not to the picture', async () => {
    // Navigation used to anchor to <main class="content-container"> on the client-rendered page and
    // to an anchor inside the edge's column while adopted — two boxes, one visible jump at handoff.
    // There is one render path now, so both halves of that contract are this test.
    api.pages = {
      [ID_A]: { getPhotoAllCurr: record(ID_A), getPhotoAllNext: record(ID_B), getPhotoAllPrev: record(ID_C) }
    }
    setViewport(1024)
    renderDetail()
    await flush()

    const column = document.querySelector('#root .wsk-main')
    expect(column).not.toBeNull()
    expect(column.style.position).toBe('relative')
    for (const label of [/prev/, /next/]) {
      const link = screen.getByText(label).closest('a')
      const anchor = link.parentElement
      expect(anchor.hasAttribute('data-wisaw-nav'), `${label} sits in the nav anchor`).toBe(true)
      expect(anchor.parentElement, `${label} anchor lives in the column`).toBe(column)
    }
  })
})
