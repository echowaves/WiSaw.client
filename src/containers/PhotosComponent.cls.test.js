/* eslint-disable react/react-in-jsx-scope */
import { createElement } from 'react'

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HelmetProvider } from '@dr.pogodin/react-helmet'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
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
const { detailFrameParts } = await import('./PhotosComponent')
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
    renderAt({ feedPhoto: FEED_PHOTO })

    // The same template the edge serves, in the edge's mount point, sized from the record.
    const box = await waitForBox()
    expect(box.getAttribute('style')).toContain('aspect-ratio:1920/1080')
    expect(box.getAttribute('style')).toContain('--wsk-cap:700px')
    const media = box.querySelector('[data-wisaw-media]')
    expect(media.getAttribute('src')).toBe(FEED_PHOTO.imgUrl)

    // Nothing under the media paints while its comments and recognitions are still unknown. A footer
    // painted now would ride their growth (the landscape-photo shift this gates out), so the slot
    // stays empty and the frame's transparent reserve is all that occupies it.
    expect(document.querySelector('footer')).toBeNull()
    expect(document.querySelector("#root [data-wisaw-slot='below'] .comments-section")).toBeNull()
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

  it('keeps the comments slot mounted when a photo has no comments', async () => {
    hydrateWith()
    renderAt({ feedPhoto: FEED_PHOTO })
    await screen.findByText('site footer')

    const slot = document.querySelector('.comments-section')
    expect(slot.className).toContain('comments-section--slot')
    expect(slot.querySelector('.skeleton-comment')).not.toBeNull()
    // It lives in the frame's reserved below-fold slot, so nothing under the media can move.
    expect(slot.closest("[data-wisaw-slot='below']")).not.toBeNull()
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

  it('fills the comments slot in place when a comment arrives', async () => {
    hydrateWith({ comments: [{ id: 'c1', comment: 'great shot' }] })
    renderAt({ feedPhoto: FEED_PHOTO })
    await screen.findByText('great shot')

    expect(document.querySelector('.comments-section').className).not.toContain('--slot')
    expect(document.querySelector('.comments-section .skeleton-comment')).toBeNull()
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

// The shift this suite gates out: comments and recognitions arrive after the media has painted, and
// on a client-painted frame the published wording arrives after that and can grow the heading /
// description / tag row. Anything already painted under them is pushed down — visible only when the
// media is short, i.e. landscape records, which is what field CLS reported. Reserving heights cannot
// win (comment count and label wrapping are unbounded), so the region mounts once, final.
describe('below-media finality gate', () => {
  const OTHER_ID = '1f1e1d1c-2b2a-3938-4746-555453525150'

  const settleRecord = (extra) => {
    api.response = {
      data: {
        getPhotoAllCurr: { photo: { ...FEED_PHOTO }, comments: [], recognitions: [], ...extra }
      }
    }
  }

  const renderWithNavLink = (state) => {
    document.body.innerHTML = "<div id='root'></div><div id='wisaw-app'></div>"
    return render(
      <HelmetProvider>
        <MemoryRouter initialEntries={[{ pathname: `/photos/${PHOTO_ID}`, state }]}>
          <Link to={`/photos/${OTHER_ID}`}>leave</Link>
          <Routes>
            <Route path='/photos/:photoId' element={<PhotosComponent />} />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>
    )
  }

  const belowSlot = () => document.querySelector("#root [data-wisaw-slot='below']")

  beforeEach(() => {
    detailSkeleton.__resetDetailSkeletonForTests()
    seoText.__resetSeoTextForTests()
  })

  afterEach(() => {
    api.response = null
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 404 })
    document.body.innerHTML = ''
  })

  it('paints comments, labels and footer together, once the record has settled', async () => {
    settleRecord({ comments: [{ id: 'c1', comment: 'great shot' }] })
    renderAt({ feedPhoto: FEED_PHOTO })

    // The unsettled half of this invariant is pinned by the two suites above (a record whose query
    // never answers paints no footer and no slot content); here it is what lands, and in what order.
    expect(await screen.findByText('great shot')).toBeInTheDocument()
    await screen.findByText('site footer')

    // Comments first, footer last: nothing painted can ever sit under a growing block.
    expect(belowSlot().children).toHaveLength(2)
    expect(belowSlot().lastElementChild.tagName).toBe('FOOTER')
    expect(belowSlot().contains(screen.getByText('great shot'))).toBe(true)
  })

  it('holds the region while the published wording is still in flight, then opens', async () => {
    // A sidecar that answers late re-words the frame above the slot (refreshFrameText), which would
    // move whatever was already painted under it — so a slow-but-successful read keeps the gate shut
    // until it lands. The alt text proves the record half settled in the meantime.
    let releaseSidecar
    vi.mocked(fetch).mockReturnValueOnce(new Promise((resolve) => {
      releaseSidecar = () => resolve({ ok: false, status: 404 })
    }))
    settleRecord({ comments: [{ id: 'c1', comment: 'great shot' }] })
    renderAt({ feedPhoto: FEED_PHOTO })

    await mediaAltIs('great shot')
    expect(belowSlot().children).toHaveLength(0)

    releaseSidecar()
    await screen.findByText('site footer')
    expect(belowSlot().contains(screen.getByText('great shot'))).toBe(true)
  })

  it('settles the gate when the record cannot be read, so the site chrome survives', async () => {
    // fetchCurrPhoto resolves null rather than rejecting. A record that will never grow its comments
    // must not hold the footer hostage, or a failed read would cost the page its only site links.
    api.response = { data: { getPhotoAllCurr: null } }
    renderAt({ feedPhoto: FEED_PHOTO })

    expect(await screen.findByText('site footer')).toBeInTheDocument()
  })

  it('still paints comments and footer when the wording request fails outright', async () => {
    // A failed attempt is final too: gating on an *answer* would strand the site footer offline.
    vi.mocked(fetch).mockRejectedValue(new Error('offline'))
    settleRecord({ comments: [{ id: 'c1', comment: 'great shot' }] })
    renderAt({ feedPhoto: FEED_PHOTO })

    expect(await screen.findByText('great shot')).toBeInTheDocument()
    expect(await screen.findByText('site footer')).toBeInTheDocument()
  })

  it('takes the region down as soon as the route leaves its record', async () => {
    settleRecord({ comments: [{ id: 'c1', comment: 'great shot' }] })
    renderWithNavLink({ feedPhoto: FEED_PHOTO })
    await screen.findByText('site footer')

    fireEvent.click(screen.getByText('leave'))

    // A record that does not belong to this route renders nothing of React's own (PhotosComponent
    // returns null once the id mismatches), so the enhancement layer is gone in that same commit —
    // before any new frame can be painted under it. Removals cannot shift; a footer left in place
    // under a media box about to change aspect ratio would.
    expect(document.querySelector('footer')).toBeNull()
    expect(document.querySelector('.comments-section')).toBeNull()
    // And the page is still a page: the waiting placeholder, not a blank document.
    expect(document.querySelector('.crop')).not.toBeNull()
  })

  it('shows no glass panel for a record with nothing to recognise', async () => {
    // The gate makes "settled, no recognitions" permanent rather than transient, so the empty box
    // must not wear chrome.
    settleRecord()
    renderAt({ feedPhoto: FEED_PHOTO })
    await screen.findByText('site footer')

    const tags = document.querySelector('.recognition-tags')
    expect(tags.className).toContain('recognition-tags--slot')
  })

  it('keeps the panel chrome once there is something to recognise', async () => {
    // Four labels, because this component's own tag block renders Labels.slice(3, 6) in its heading.
    settleRecord({
      recognitions: [{
        id: 'r1',
        metaData: JSON.stringify({
          Labels: ['Heron', 'Wader', 'Wetland', 'Bird'].map((Name) => ({ Name, Confidence: 90 }))
        })
      }]
    })
    renderAt({ feedPhoto: FEED_PHOTO })
    await screen.findByText('site footer')

    const tags = document.querySelector('.recognition-tags')
    expect(tags.className).not.toContain('--slot')
    expect(tags.querySelector('a')).not.toBeNull()
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

// The frame is painted by an effect after commit, so the box shows up one tick later. It waits on
// the frame itself: the region under it is gated (see the finality suite), so the footer is no longer
// a signal that a page exists.
async function waitForBox () {
  await waitFor(() => expect(document.querySelector('#root .wsk-box')).not.toBeNull())
  return document.querySelector('#root .wsk-box')
}

// The painted media's alt text comes from the record's first comment, so it proves the record landed
// without going through the gated region under the media.
const mediaAltIs = (alt) => waitFor(() => {
  expect(document.querySelector('#root [data-wisaw-media]').getAttribute('alt')).toBe(alt)
})
