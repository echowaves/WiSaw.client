/* eslint-disable react/react-in-jsx-scope */
import { createElement } from 'react'

import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Seam contract for the portal-app architecture: on a detail route where Lambda@Edge painted a
// skeleton into #root, React mounts <App/> into the sibling #wisaw-app container and enhances the
// untouched markup via portals. This pins the invariants that make LCP/CLS survive hydration:
//   1. the server-painted media node is never cloned or replaced by first commit (identity),
//   2. the enhancement layer actually lands in the skeleton's slots,
//   3. the app issues zero <head> mutations on the detail route - the edge's bytes are final.

const api = vi.hoisted(() => ({ pages: null }))
vi.mock('../consts', () => ({
  gqlClient: {
    query: ({ query, variables }) => {
      const page = api.pages?.[variables.photoId]
      if (page === undefined) {
        return new Promise(() => {})
      }
      const operation = query?.definitions?.[0]?.name?.value
      return Promise.resolve({ data: { [operation]: page[operation] ?? null } })
    }
  }
}))
vi.mock('react-ga4', () => ({ default: { initialize: vi.fn(), send: vi.fn() } }))

// The real Header carries the theme dropdown and its matchMedia listener - heavy for a DOM-seam
// test. A stand-in with an identifiable marker is enough to prove where the portal lands.
vi.mock('./Header', () => ({ default: () => createElement('header', { id: 'test-header' }, 'test header') }))
vi.mock('./Footer', () => ({ default: () => createElement('footer', null, 'site footer') }))

const App = (await import('../App')).default
const detailSkeleton = await import('../utils/detailSkeleton')

// A real UUID: detailSkeleton only adopts skeletons for strict /photos|videos/<uuid> routes.
const PHOTO_ID = '29461ee8-34dd-4c2b-848f-c16d766713e8'
const mediaUrl = `https://img.wisaw.com/${PHOTO_ID}.webp`
const thumbUrl = `https://img.wisaw.com/${PHOTO_ID}-thumb.webp`

// The markup shape the edge serves inside #root (see backend-solicitation-brief.md C2): reserved
// header slot, media at display size in its fixed box, static frame, below-fold slot.
const buildSkeletonDom = () => {
  document.body.innerHTML = `
    <div id='root'>
      <div data-wisaw-slot='header'></div>
      <main class='content-container'>
        <div class='crop' style='width:350px;height:467px;position:relative'>
          <img data-wisaw-media data-wisaw-id='${PHOTO_ID}' src='${thumbUrl}'
               width='2250' height='3000' alt=''
               style='width:350px;height:467px;object-fit:cover;border-radius:18px' />
        </div>
        <h1>What I Saw</h1>
        <p>A photo shared on WiSaw.</p>
        <div data-wisaw-slot='below'></div>
      </main>
    </div>
    <div id='wisaw-app'></div>
  `
}

const currRecord = (comments) => ({
  photo: {
    id: PHOTO_ID,
    imgUrl: mediaUrl,
    thumbUrl,
    videoUrl: '',
    video: false,
    watchersCount: 10,
    duration: 0,
    width: '2250',
    height: '3000',
    createdAt: '2026-10-01T10:00:00.000Z'
  },
  comments,
  recognitions: []
})

// The app's own boot sequence, minus index.js: capture the skeleton before the first commit, then
// mount <App/> into the sibling container exactly as index.js does.
const bootWithSkeleton = () => {
  detailSkeleton.__resetDetailSkeletonForTests()
  buildSkeletonDom()
  window.history.pushState({}, '', `/photos/${PHOTO_ID}`)

  const captured = detailSkeleton.captureDetailSkeleton()
  expect(captured).not.toBeNull()

  const refs = {
    mediaNode: document.querySelector('[data-wisaw-media]'),
    headerSlot: document.querySelector("[data-wisaw-slot='header']"),
    belowSlot: document.querySelector("[data-wisaw-slot='below']")
  }

  render(<App />, { container: document.getElementById('wisaw-app') })
  return refs
}

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 12; i++) {
      await Promise.resolve()
    }
  })
}

describe('detail skeleton seam (portal adoption)', () => {
  beforeEach(() => {
    api.pages = null
  })

  afterEach(() => {
    detailSkeleton.__resetDetailSkeletonForTests()
    document.body.innerHTML = ''
    window.history.pushState({}, '', '/')
  })

  it('keeps the server-painted media node alive through first commit and hydration', async () => {
    const { mediaNode } = bootWithSkeleton()

    // First commit: React mounted into #wisaw-app; the skeleton's img is still the same node.
    expect(document.querySelector('[data-wisaw-media]')).toBe(mediaNode)
    // And it was never re-pointed at another source by the client.
    expect(mediaNode.getAttribute('src')).toBe(thumbUrl)

    await flush() // queries stay pending (pages null): hydration keeps the seeded record

    expect(document.querySelector('[data-wisaw-media]')).toBe(mediaNode)
    expect(mediaNode.getAttribute('src')).toBe(thumbUrl)
  })

  it('portals the enhancement layer into the skeleton slots', async () => {
    api.pages = { [PHOTO_ID]: { getPhotoAllCurr: currRecord([{ id: 'c1', comment: 'seam comment' }]) } }

    const { headerSlot, belowSlot } = bootWithSkeleton()

    // Header portaled into the reserved slot - same node, content inside it. (findBy* because the
    // lazy chunks resolve asynchronously after the first commit.)
    const header = await screen.findByText('test header')
    expect(headerSlot.contains(header)).toBe(true)

    // Comments and footer landed in the below-fold slot.
    const comment = await screen.findByText('seam comment')
    expect(comment.closest('[data-wisaw-slot="below"]')).toBe(belowSlot)
    const footer = await screen.findByText('site footer')
    expect(belowSlot.contains(footer)).toBe(true)

    // The static frame the edge painted survives untouched.
    expect(document.querySelector('#root h1')?.textContent).toBe('What I Saw')
  })

  it('issues zero <head> mutations on the detail route', async () => {
    api.pages = { [PHOTO_ID]: { getPhotoAllCurr: currRecord([]) } }

    buildSkeletonDom()
    window.history.pushState({}, '', `/photos/${PHOTO_ID}`)
    detailSkeleton.__resetDetailSkeletonForTests()
    expect(detailSkeleton.captureDetailSkeleton()).not.toBeNull()

    // The only thing that may touch <head> under HelmetProvider is a mounted <Helmet>. Count every
    // mutation (any element added or removed inside head) for the whole adopted lifecycle.
    let mutations = 0
    const observer = new MutationObserver((records) => {
      mutations += records.length
    })
    observer.observe(document.head, { childList: true, subtree: true })

    try {
      render(<App />, { container: document.getElementById('wisaw-app') })
      // Wait until the lazy chunks are in and the adopted frame is fully enhanced, so any head
      // write the app would make has had its chance.
      await screen.findByText('test header')
      await flush()
    } finally {
      observer.disconnect()
    }

    expect(mutations).toBe(0)
  })

  it('keeps the app wrapper from painting over the edge page', async () => {
    // #wisaw-app mounts after #root, so an opaque/100vh .App would cover the painted media —
    // exactly the failure DOM-identity checks cannot see. The adopted wrapper must carry the
    // transparent modifier, hold no DOM children (portals land in #root), and never show the
    // full-screen Loading fallback while lazy chunks resolve.
    api.pages = { [PHOTO_ID]: { getPhotoAllCurr: currRecord([]) } }

    bootWithSkeleton()

    expect(screen.queryByText('Loading...')).toBeNull()
    const wrapper = document.querySelector('#wisaw-app .App')
    expect(wrapper).not.toBeNull()
    expect(wrapper.classList.contains('App--adopted')).toBe(true)
    expect(wrapper.childElementCount).toBe(0)

    await flush()

    expect(document.querySelector('#wisaw-app .App').classList.contains('App--adopted')).toBe(true)
  })

  it('drives the edge-painted <video> node through its own handlers', async () => {
    // Adopted video: React never renders a second player — its error/spinner state must be fed
    // by listeners attached to the node the edge painted.
    const videoRecord = currRecord([])
    videoRecord.photo.video = true
    videoRecord.photo.videoUrl = `https://img.wisaw.com/${PHOTO_ID}.mp4`
    api.pages = { [PHOTO_ID]: { getPhotoAllCurr: videoRecord } }

    detailSkeleton.__resetDetailSkeletonForTests()
    document.body.innerHTML = `
      <div id='root'>
        <div data-wisaw-slot='header'></div>
        <main class='content-container'>
          <div class='crop' style='width:350px;height:467px;position:relative'>
            <video data-wisaw-media data-wisaw-id='${PHOTO_ID}' poster='${thumbUrl}'
                   width='1920' height='1080' preload='none' controls
                   src='https://img.wisaw.com/${PHOTO_ID}.mp4'></video>
          </div>
          <h1>Harbour at dusk</h1>
          <div data-wisaw-slot='below'></div>
        </main>
      </div>
      <div id='wisaw-app'></div>
    `
    window.history.pushState({}, '', `/videos/${PHOTO_ID}`)
    expect(detailSkeleton.captureDetailSkeleton()).not.toBeNull()

    const mediaNode = document.querySelector('[data-wisaw-media]')
    render(<App />, { container: document.getElementById('wisaw-app') })
    await screen.findByText('test header')
    await flush()

    // No second player anywhere; the edge node is still the only media element.
    expect(document.querySelectorAll('video')).toHaveLength(1)
    expect(mediaNode.isConnected).toBe(true)

    // The adopted handlers are live: an error on the edge node surfaces the overlay in its box.
    act(() => {
      mediaNode.dispatchEvent(new window.Event('error'))
    })
    const alert = await screen.findByRole('alert')
    expect(mediaNode.parentElement.contains(alert)).toBe(true)
  })

  it('hands off to the full client page when the record kind disagrees with the edge node', async () => {
    // A video id requested under /photos/: the edge serves an <img> for that URL, but the record
    // claims video. Adopting would attach player state to an image, so the skeleton must be
    // cleared and the page rendered fully client-side instead of stacked over the static frame.
    api.pages = { [PHOTO_ID]: { getPhotoAllCurr: currRecord([]) } }
    api.pages[PHOTO_ID].getPhotoAllCurr.photo.video = true
    api.pages[PHOTO_ID].getPhotoAllCurr.photo.videoUrl = `https://img.wisaw.com/${PHOTO_ID}.mp4`

    buildSkeletonDom()
    window.history.pushState({}, '', `/photos/${PHOTO_ID}`)
    detailSkeleton.__resetDetailSkeletonForTests()
    expect(detailSkeleton.captureDetailSkeleton()).not.toBeNull()

    render(<App />, { container: document.getElementById('wisaw-app') })
    await flush()

    // The static frame is gone and the client page owns the media box (as a video, per the record).
    expect(document.querySelector('#root [data-wisaw-media]')).toBeNull()
    expect(document.querySelector('#wisaw-app .crop video.mainImage')).not.toBeNull()
  })

  it('renders the full client page when no skeleton was captured', async () => {
    detailSkeleton.__resetDetailSkeletonForTests()
    buildSkeletonDom()
    // Old edge still cached: #root holds the plain shell, no [data-wisaw-media] to adopt.
    document.querySelector('[data-wisaw-media]').remove()
    window.history.pushState({}, '', `/photos/${PHOTO_ID}`)
    // index.js then clears #root (the shell's static fallback would duplicate the React page).
    expect(detailSkeleton.captureDetailSkeleton()).toBeNull()
    document.getElementById('root').innerHTML = ''

    render(<App />, { container: document.getElementById('wisaw-app') })

    // Cold deep link: the reserved skeleton frame, fully client-rendered in the sibling container.
    expect(document.getElementById('root')).toBeEmptyDOMElement()
    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).not.toBeNull()
    })
  })
})
