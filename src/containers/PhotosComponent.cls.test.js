/* eslint-disable react/react-in-jsx-scope */
import { createElement } from 'react'

import { act, render, screen, waitFor } from '@testing-library/react'
import { HelmetProvider } from '@dr.pogodin/react-helmet'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The GraphQL call must never settle by default: these tests pin the *pre-hydration*
// DOM, which is exactly the frame Cumulative Layout Shift measures. Tests that need
// the hydrated frame resolve `response` explicitly.
const api = vi.hoisted(() => ({ response: null }))
vi.mock('../consts', () => ({
  gqlClient: {
    query: () => (api.response === null ? new Promise(() => {}) : Promise.resolve(api.response))
  }
}))
vi.mock('react-ga4', () => ({ default: { initialize: vi.fn(), send: vi.fn() } }))
// Synchronous stand-in for the lazy Footer so its absence/presence is meaningful.
vi.mock('./Footer', () => ({ default: () => createElement('footer', null, 'site footer') }))

const PhotosComponent = (await import('./PhotosComponent')).default
const detailSkeleton = await import('../utils/detailSkeleton')
const seoText = await import('../utils/detailSeoText')
const { COLD_BELOW_MEDIA_RESERVE } = await import('../utils/detailLayout')
const { BELOW_SLOT_FINAL_WAIT_MS, detailFrameParts } = await import('./PhotosComponent')
const { FALLBACK_DESCRIPTIONS } = await import('../utils/detailTemplate.generated')

// No published wording sidecar: the frame falls back to the record, which is what these
// layout tests are about.
vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 404 })))

// jsdom viewport is 1024px wide -> desktop branch, 700px media box.
const PHOTO_ID = '7b8a9c1d-2e3f-4a5b-6c7d-8e9f0a1b2c3d'
const FEED_PHOTO = {
  id: PHOTO_ID,
  imgUrl: 'https://img.wisaw.com/full.webp',
  thumbUrl: 'https://img.wisaw.com/thumb.webp',
  videoUrl: '',
  video: false,
  watchersCount: 10,
  lastComment: 'nice',
  createdAt: '2026-10-01T10:00:00.000Z',
  width: '1920',
  height: '1080'
}

// The frame is painted into #root (the edge's mount point) and enhanced through portals, so the
// page under test needs both hosts, exactly as index.html ships them.
const renderAt = (state) => {
  document.body.innerHTML = "<div id='root'></div><div id='wisaw-app'></div>"
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[{ pathname: `/photos/${PHOTO_ID}`, state }]}>
        <Routes>
          <Route path='/photos/:photoId' element={<PhotosComponent />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>
  )
}

const pills = () => document.querySelectorAll('.recognition-tags .skeleton-pill')

describe('detail page pre-hydration layout (CLS guards)', () => {
  beforeEach(() => {
    detailSkeleton.__resetDetailSkeletonForTests()
    seoText.__resetSeoTextForTests()
  })

  afterEach(() => {
    api.response = null
    document.body.innerHTML = ''
  })

  it('holds the label row with hydrated-metric placeholders on a cold deep link', () => {
    renderAt(null)

    expect(pills()).toHaveLength(3)
    const crop = document.querySelector('.crop')
    expect(crop).not.toBeNull()
    // The media box top must stay put: only the label row sits above it.
    expect(crop.parentElement.querySelector('.recognition-tags')).toBe(crop.previousElementSibling)
  })

  it('paints nothing below the media and no footer on a cold deep link', () => {
    renderAt(null)

    const main = document.querySelector('main.content-container')
    // label row + media box + paint-free filler, and nothing else.
    expect(main.children).toHaveLength(3)
    expect(main.lastElementChild.getAttribute('style')).toContain(`${COLD_BELOW_MEDIA_RESERVE}px`)
    expect(document.querySelector('footer')).toBeNull()
  })

  it('keeps the media box at the placeholder size while the aspect ratio is unknown', () => {
    renderAt(null)

    const crop = document.querySelector('.crop')
    expect(crop.getAttribute('style')).toContain('width: 700px')
    expect(crop.getAttribute('style')).toContain('height: 700px')
  })

  it('paints the shared frame at the record aspect ratio when a feed record bootstraps the page', async () => {
    // The footer waits for the record that fills the slot above it, so this covers the settled page.
    api.response = {
      data: { getPhotoAllCurr: { photo: { ...FEED_PHOTO }, comments: [], recognitions: [] } }
    }
    renderAt({ feedPhoto: FEED_PHOTO })

    // The same template the edge serves, in the edge's mount point, sized from the record.
    const box = await waitForBox()
    expect(box.getAttribute('style')).toContain('aspect-ratio:1920/1080')
    expect(box.getAttribute('style')).toContain('--wsk-cap:700px')
    const media = box.querySelector('[data-wisaw-media]')
    expect(media.getAttribute('src')).toBe(FEED_PHOTO.imgUrl)

    // The loaded page does render the footer, so its position is only ever set by
    // content that already exists - never re-flowed under a painted footer.
    expect(await screen.findByText('site footer')).toBeInTheDocument()
    expect(document.querySelector("#root [data-wisaw-slot='below'] footer")).not.toBeNull()
  })
})

describe('detail page empty states (CLS guards)', () => {
  const hydrateWith = (extra) => {
    api.response = {
      data: {
        getPhotoAllCurr: {
          photo: { ...FEED_PHOTO },
          comments: [],
          recognitions: [],
          ...extra
        }
      }
    }
  }

  beforeEach(() => {
    detailSkeleton.__resetDetailSkeletonForTests()
    seoText.__resetSeoTextForTests()
  })

  afterEach(() => {
    api.response = null
    document.body.innerHTML = ''
  })

  it('keeps the label row box when a photo turns out to have no labels', async () => {
    hydrateWith()
    renderAt({ feedPhoto: FEED_PHOTO })
    await screen.findByText('site footer') // hydrated frame

    // The frame's tag row is only there when there are tags; the media box keeps its place either
    // way because its height comes from the record's aspect ratio, not from what follows it.
    expect(document.querySelectorAll("#root .wsk-main p a[rel='tag']")).toHaveLength(0)
    const box = document.querySelector('#root .wsk-box')
    expect(box).not.toBeNull()
    expect(box.parentElement.querySelector('h1')).not.toBeNull()
  })

  it('renders no reserve above the tags panel when a photo has no comments', async () => {
    hydrateWith()
    renderAt({ feedPhoto: FEED_PHOTO })
    await screen.findByText('site footer')

    // An invisible placeholder row used to sit here. Comments and recognitions arrive in the same
    // record, so this block mounts at its final height either way — the reserve was only a blank
    // band over the AI tags list (91px measured on a real photo).
    expect(document.querySelector('.comments-section')).toBeNull()
    expect(document.querySelector("[data-wisaw-slot='below'] .recognition-tags")).not.toBeNull()
  })

  it('paints one media node, eagerly, with no thumbnail layer to swap', async () => {
    hydrateWith()
    renderAt({ feedPhoto: FEED_PHOTO })
    await screen.findByText('site footer')

    const mediaNodes = document.querySelectorAll('#root .wsk-box [data-wisaw-media]')
    expect(mediaNodes).toHaveLength(1)
    expect(mediaNodes[0].tagName).toBe('IMG')
    // The frame's own markup: eager, and the shell's preload script is what warms the bytes.
    expect(mediaNodes[0].getAttribute('loading')).toBe('eager')
    // No second image layer anywhere on the page (the client card used to paint one per video).
    expect(document.querySelectorAll('#root img')).toHaveLength(1)
  })

  it('renders comments above the tags panel when a photo has them', async () => {
    hydrateWith({ comments: [{ id: 'c1', comment: 'great shot' }] })
    renderAt({ feedPhoto: FEED_PHOTO })
    await screen.findByText('great shot')

    const comments = document.querySelector('.comments-section')
    expect(comments.closest("[data-wisaw-slot='below']")).not.toBeNull()
    // Comments sit directly above the tags panel — which is exactly why the footer, painted after
    // both, must wait for this block instead of being pushed down by it.
    expect(comments.nextElementSibling).toHaveClass('recognition-tags')
  })

  it('withholds the footer while the record that fills the slot above it is in flight', async () => {
    // api.response is null here: the GraphQL answer never settles, which is the pre-hydration state
    // the measurement showed pushing an already-painted footer down by 880px. The waits below are
    // what make this an assertion rather than a race: once the slot's own content is painted and a
    // macrotask has run, the lazy Footer chunk is resolved — so its absence is the gate's doing.
    renderAt({ feedPhoto: FEED_PHOTO })
    await waitForBox()
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })

    expect(document.querySelector('footer')).toBeNull()
  })

  it('shows the footer on a bounded wait if the record never answers', async () => {
    vi.useFakeTimers()
    try {
      renderAt({ feedPhoto: FEED_PHOTO })
      expect(document.querySelector('footer')).toBeNull()

      await act(async () => { vi.advanceTimersByTime(BELOW_SLOT_FINAL_WAIT_MS + 50) })

      // A hung request may delay the footer, never strand it.
      expect(document.querySelector('footer')).not.toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('alt-texts the media with the first comment, as the edge describes the same photo', async () => {
    hydrateWith({ comments: [{ id: 'c1', comment: 'A heron at dawn' }] })
    renderAt({ feedPhoto: FEED_PHOTO })
    await screen.findByText('A heron at dawn')

    expect(document.querySelector('#root [data-wisaw-media]').getAttribute('alt')).toBe('A heron at dawn')
  })

  it('says the served page\'s fallback sentence while no wording is published', async () => {
    // fetch is stubbed to 404 for this file: no sidecar, which is a real state — a photo uploaded
    // since the last sitemap run. The edge answers that with a sentence, so a navigated page must
    // not be the one place that shows an empty paragraph under the heading.
    renderAt({ feedPhoto: FEED_PHOTO })
    await waitForBox()

    const { FALLBACK_DESCRIPTIONS } = await import('../utils/detailTemplate.generated')
    expect(document.querySelector('#root .wsk-main > p').textContent).toBe(FALLBACK_DESCRIPTIONS.photo)
  })
})

describe('the published wording a painted frame may wear', () => {
  const photo = { id: PHOTO_ID, video: false }
  const wording = {
    title: 'Drone shot — video · WiSaw',
    kind: 'video',
    description: 'Aerial over the harbour at dusk.',
    imageCaption: 'from above',
    labels: ['Harbour']
  }

  it('refuses wording written for the other media type, as the edge does', () => {
    const parts = detailFrameParts({ photo, currPhoto: {}, seoText: wording })

    expect(parts.title).toBe(`wisaw photo ${PHOTO_ID}`)
    expect(parts.description).toBe(FALLBACK_DESCRIPTIONS.photo)
    // Tag links are not kind-dependent at the edge either, so they still come from the sidecar.
    expect(parts.labels).toEqual(['Harbour'])
  })

  it('wears wording published for this kind', () => {
    const parts = detailFrameParts({ photo, currPhoto: {}, seoText: { ...wording, kind: 'photo' } })

    expect(parts.title).toBe(wording.title)
    expect(parts.description).toBe(wording.description)
  })
})

// The frame is painted by an effect after commit, so the box shows up one tick later.
async function waitForBox () {
  // The box itself, not the footer: the footer deliberately waits for the record that fills the
  // slot above it, so on an in-flight page the frame is painted and the footer is not.
  await waitFor(() => expect(document.querySelector('#root .wsk-box')).not.toBeNull())
  return document.querySelector('#root .wsk-box')
}
