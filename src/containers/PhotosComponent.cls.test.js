/* eslint-disable react/react-in-jsx-scope */
import { createElement } from 'react'

import { render, screen } from '@testing-library/react'
import { HelmetProvider } from '@dr.pogodin/react-helmet'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

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
const { COLD_BELOW_MEDIA_RESERVE } = await import('../utils/detailLayout')

// jsdom viewport is 1024px wide -> desktop branch, 700px media box.
const FEED_PHOTO = {
  id: '777',
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

const renderAt = (state) => render(
  <HelmetProvider>
    <MemoryRouter initialEntries={[{ pathname: '/photos/777', state }]}>
      <Routes>
        <Route path='/photos/:photoId' element={<PhotosComponent />} />
      </Routes>
    </MemoryRouter>
  </HelmetProvider>
)

const pills = () => document.querySelectorAll('.recognition-tags .skeleton-pill')

describe('detail page pre-hydration layout (CLS guards)', () => {
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

  it('paints real media plus exact-height slots when a feed record bootstraps the page', async () => {
    renderAt({ feedPhoto: FEED_PHOTO })

    // Media at its true aspect ratio immediately (700 x 393.75 for 16:9).
    const crop = document.querySelector('.crop')
    expect(crop.getAttribute('style')).toContain('width: 700px')
    expect(crop.getAttribute('style')).toContain('height: 393.75px')
    expect(pills()).toHaveLength(3)
    expect(document.querySelector('.comments-section .skeleton-comment')).not.toBeNull()

    // The loaded page does render the footer, so its position is only ever set by
    // content that already exists - never re-flowed under a painted footer.
    expect(await screen.findByText('site footer')).toBeInTheDocument()
  })
})

describe('detail page empty states (CLS guards)', () => {
  afterEach(() => { api.response = null })

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

  it('keeps the label row box when a photo turns out to have no labels', async () => {
    hydrateWith()
    renderAt({ feedPhoto: FEED_PHOTO })
    await screen.findByText('site footer') // hydrated frame

    const row = document.querySelector('.recognition-tags')
    // Deleting the row would pull the already-painted media panel up by its height.
    expect(row.className).toContain('recognition-tags--slot')
    expect(pills()).toHaveLength(3)
  })

  it('keeps the comments slot mounted when a photo has no comments', async () => {
    hydrateWith()
    renderAt({ feedPhoto: FEED_PHOTO })
    await screen.findByText('site footer')

    const slot = document.querySelector('.comments-section')
    expect(slot.className).toContain('comments-section--slot')
    expect(slot.querySelector('.skeleton-comment')).not.toBeNull()
  })

  it('fills the comments slot in place when a comment arrives', async () => {
    hydrateWith({ comments: [{ id: 'c1', comment: 'great shot' }] })
    renderAt({ feedPhoto: FEED_PHOTO })
    await screen.findByText('great shot')

    expect(document.querySelector('.comments-section').className).not.toContain('--slot')
    expect(document.querySelector('.comments-section .skeleton-comment')).toBeNull()
  })
})
