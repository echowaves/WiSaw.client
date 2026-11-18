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
const seoText = await import('../utils/detailSeoText')

// A real UUID: detailSkeleton only adopts skeletons for strict /photos|videos/<uuid> routes.
const PHOTO_ID = '29461ee8-34dd-4c2b-848f-c16d766713e8'
const OTHER_PHOTO_ID = '7c1f9a52-0b34-4e6a-9d21-5f8e3c6a1b40'
const mediaUrl = `https://img.wisaw.com/${PHOTO_ID}.webp`
const thumbUrl = `https://img.wisaw.com/${PHOTO_ID}-thumb.webp`

// The markup the edge actually serves inside #root, mirroring WiSaw.cdk
// lambda-fns/lambdas/injectMetaTagsLambdaFunction/skeleton.js (renderSkeleton): .wsk wrapper, header
// slot, .wsk-main column, media in its aspect-ratio .wsk-box, static frame, below slot. The names
// are the edge's own — adoption walks this structure (media box -> parent column), so a fixture built
// from the app's class names would pin a shape production never serves.
const buildSkeletonDom = () => {
  document.body.innerHTML = `
    <div id='root'>
      <div class='wsk'>
        <div class='wsk-slot-header' data-wisaw-slot='header'></div>
        <div class='wsk-main'>
          <div class='wsk-box' style='aspect-ratio:2250/3000;--wsk-cap:525px'>
            <img class='wsk-media' data-wisaw-media data-wisaw-id='${PHOTO_ID}' src='${thumbUrl}'
                 data-wisaw-src='${mediaUrl}' data-wisaw-thumb='${thumbUrl}'
                 width='2250' height='3000' alt='' />
          </div>
          <h1>What I Saw</h1>
          <p>A photo shared on WiSaw.</p>
          <nav><a href='/'>WiSaw - free authentic stock photos and videos</a></nav>
          <div class='wsk-slot-below' data-wisaw-slot='below'></div>
        </div>
      </div>
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

// Prev/next links only render once their records arrive, so a test that pins where they land has to
// feed the app neighbours.
const neighbourRecord = (id) => ({ ...currRecord([]), photo: { ...currRecord([]).photo, id } })

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
    mediaBox: captured.mediaBox,
    navContainer: captured.navContainer,
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

// An edge build that publishes no media URLs: the node is painted and adoptable, but the client can
// seed nothing from it, so adoption stays unknown until the record answers.
const stripPublishedUrls = () => {
  const media = document.querySelector('[data-wisaw-media]')
  media.removeAttribute('data-wisaw-src')
  media.removeAttribute('data-wisaw-thumb')
}

// The video twin of buildSkeletonDom, mirroring the same edge markup for /videos/<id>.
const buildVideoSkeletonDom = () => {
  document.body.innerHTML = `
    <div id='root'>
      <div class='wsk'>
        <div class='wsk-slot-header' data-wisaw-slot='header'></div>
        <div class='wsk-main'>
          <div class='wsk-box' style='aspect-ratio:1920/1080;--wsk-cap:700px'>
            <video class='wsk-media' data-wisaw-media data-wisaw-id='${PHOTO_ID}' poster='${thumbUrl}'
                   data-wisaw-src='${thumbUrl}' data-wisaw-thumb='${thumbUrl}'
                   width='1920' height='1080' preload='none' controls
                   src='https://img.wisaw.com/${PHOTO_ID}.mp4'></video>
          </div>
          <h1>Harbour at dusk</h1>
          <div class='wsk-slot-below' data-wisaw-slot='below'></div>
        </div>
      </div>
    </div>
    <div id='wisaw-app'></div>
  `
}

const bootWithVideoSkeleton = () => {
  detailSkeleton.__resetDetailSkeletonForTests()
  buildVideoSkeletonDom()
  window.history.pushState({}, '', `/videos/${PHOTO_ID}`)

  const captured = detailSkeleton.captureDetailSkeleton()
  expect(captured).not.toBeNull()

  render(<App />, { container: document.getElementById('wisaw-app') })
  return { mediaNode: document.querySelector('[data-wisaw-media]') }
}

// The wording sidecar is a real network read in the browser. Here it answers 404, which is the
// state that matters for these tests: no published wording, so the frame falls back to the record.
vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 404 })))

describe('detail skeleton seam (portal adoption)', () => {
  beforeEach(() => {
    api.pages = null
    seoText.__resetSeoTextForTests()
  })

  afterEach(() => {
    detailSkeleton.__resetDetailSkeletonForTests()
    document.body.innerHTML = ''
    window.history.pushState({}, '', '/')
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 })
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
        <div class='wsk'>
          <div class='wsk-slot-header' data-wisaw-slot='header'></div>
          <div class='wsk-main'>
            <div class='wsk-box' style='aspect-ratio:1920/1080;--wsk-cap:700px'>
              <video class='wsk-media' data-wisaw-media data-wisaw-id='${PHOTO_ID}' poster='${thumbUrl}'
                     data-wisaw-src='${thumbUrl}' data-wisaw-thumb='${thumbUrl}'
                     width='1920' height='1080' preload='none' controls
                     src='https://img.wisaw.com/${PHOTO_ID}.mp4'></video>
            </div>
            <h1>Harbour at dusk</h1>
            <div class='wsk-slot-below' data-wisaw-slot='below'></div>
          </div>
        </div>
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

  it('repaints the shared frame as a video when the record kind disagrees with the edge node', async () => {
    // A video id requested under /photos/: the edge serves an <img> for that URL, but the record
    // claims video. Adopting would attach player state to an image, so the app replaces the frame —
    // with the same template it paints everywhere else, not with markup of its own.
    api.pages = { [PHOTO_ID]: { getPhotoAllCurr: currRecord([]) } }
    api.pages[PHOTO_ID].getPhotoAllCurr.photo.video = true
    api.pages[PHOTO_ID].getPhotoAllCurr.photo.videoUrl = `https://img.wisaw.com/${PHOTO_ID}.mp4`

    buildSkeletonDom()
    window.history.pushState({}, '', `/photos/${PHOTO_ID}`)
    detailSkeleton.__resetDetailSkeletonForTests()
    expect(detailSkeleton.captureDetailSkeleton()).not.toBeNull()

    render(<App />, { container: document.getElementById('wisaw-app') })
    await flush()

    // The edge's <img> is gone; the frame now holds a <video> built by the shared template.
    const media = document.querySelector('#root [data-wisaw-media]')
    expect(media.tagName).toBe('VIDEO')
    expect(media.getAttribute('src')).toBe(`https://img.wisaw.com/${PHOTO_ID}.mp4`)
    expect(media.getAttribute('poster')).toBe(thumbUrl)
    // There is no second detail markup in the React container any more.
    expect(document.querySelector('#wisaw-app .crop')).toBeNull()
    expect(detailSkeleton.getActiveDetailFrame().source).toBe('client')
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

  it('keeps adoption on a route whose id is upper-cased', async () => {
    // captureDetailSkeleton matches ids case-insensitively; the seed and adopted checks must not
    // reject the very skeleton that was just adopted, or an uppercase URL adopts and then hands
    // off, destroying its own painted LCP node.
    api.pages = { [PHOTO_ID]: { getPhotoAllCurr: currRecord([]) } }

    buildSkeletonDom()
    detailSkeleton.__resetDetailSkeletonForTests()
    window.history.pushState({}, '', `/photos/${PHOTO_ID.toUpperCase()}`)
    expect(detailSkeleton.captureDetailSkeleton()).not.toBeNull()

    const refs = { mediaNode: document.querySelector('[data-wisaw-media]') }
    render(<App />, { container: document.getElementById('wisaw-app') })
    await flush()

    expect(document.querySelector('#wisaw-app .App').classList.contains('App--adopted')).toBe(true)
    expect(document.querySelector('[data-wisaw-media]')).toBe(refs.mediaNode)
  })

  it('upgrades the adopted edge node to full resolution when the paint gate opens', async () => {
    // Below the breakpoint the shell's swap script has left the thumbnail on the painted node and
    // the adopted path renders no <img> of its own — the upgrade must re-point that very node.
    api.pages = { [PHOTO_ID]: { getPhotoAllCurr: currRecord([]) } }
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })

    const { mediaNode } = bootWithSkeleton()
    await screen.findByText('test header')
    expect(mediaNode.getAttribute('src')).toBe(thumbUrl)

    act(() => {
      window.dispatchEvent(new window.Event('pointerdown'))
    })
    await flush()

    expect(mediaNode.getAttribute('src')).toBe(mediaUrl)
    expect(document.querySelector('[data-wisaw-media]')).toBe(mediaNode)
  })

  it('hands #root back on the first navigation away from the adopted route', async () => {
    // The once-per-session handoff: prev/next must clear the static frame exactly, leave no React
    // portal behind in #root, and take the shell out of adopted mode.
    api.pages = { [PHOTO_ID]: { getPhotoAllCurr: currRecord([{ id: 'c1', comment: 'seam comment' }]) } }

    const { mediaNode, belowSlot } = bootWithSkeleton()
    await screen.findByText('seam comment')
    expect(belowSlot.childElementCount).toBeGreaterThan(0)

    act(() => {
      window.history.pushState({}, '', `/photos/${OTHER_PHOTO_ID}`)
      window.dispatchEvent(new window.PopStateEvent('popstate', { state: {} }))
    })
    await flush()

    const root = document.getElementById('root')
    expect(root.childElementCount).toBe(0)
    expect(mediaNode.isConnected).toBe(false)
    const wrapper = document.querySelector('#wisaw-app .App')
    expect(wrapper.classList.contains('App--adopted')).toBe(false)
    expect(wrapper.childElementCount).toBeGreaterThan(0)
  })

  it('anchors navigation to the page column, never to the media box', async () => {
    // The same inline offsets are used on both render paths, so the anchor box is all that decides
    // where prev/next sit. Client-rendered mode anchors them to <main class="content-container">;
    // adopted mode must therefore use the column (.wsk-main), not the picture's box — otherwise they
    // visibly jump into the photograph at the one-time handoff, and .wsk-box's overflow:hidden clips
    // them. Media-centred overlays are the opposite case and stay in the box (pinned by the video
    // test above, which finds its alert inside mediaNode.parentElement).
    api.pages = {
      [PHOTO_ID]: {
        getPhotoAllCurr: currRecord([]),
        getPhotoAllNext: neighbourRecord(OTHER_PHOTO_ID),
        getPhotoAllPrev: neighbourRecord('5b7d0e93-2c4a-4f81-9d6b-a0e5c7f13b28')
      }
    }

    const { mediaBox, navContainer } = bootWithSkeleton()
    const column = document.querySelector('.wsk-main')

    // The anchor belongs to the column and is empty by construction: no box of its own, so the
    // painted geometry is the column's padding box — the same one <main class="content-container">
    // gives the buttons once the page is client-rendered.
    expect(navContainer.parentElement).toBe(column)
    // React's portals are its only children — the node itself contributes no content or box.
    expect(navContainer.getAttribute('data-wisaw-nav')).toBe('')
    expect(window.getComputedStyle(navContainer).position).toBe('absolute')
    expect(window.getComputedStyle(column).position).toBe('relative')
    // Portalling into the column itself would append after the below-fold slot; prev/next must stay
    // ahead of the media in DOM order, which is what keeps them early in tab order.
    expect(navContainer.compareDocumentPosition(mediaBox) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    await flush()

    const links = Array.from(document.querySelectorAll('#root a'))
      .filter((node) => /prev|next/.test(node.textContent))
    expect(links).toHaveLength(2)
    for (const link of links) {
      expect(navContainer.contains(link)).toBe(true)
      expect(mediaBox.contains(link)).toBe(false)
    }
  })

  it('keeps adopting a skeleton whose media box is the only wrapper', () => {
    // Degenerate shape: media wrapped exactly once, so the column would be #root itself. Anchoring UI
    // to the mount point is worse than reusing the box, and refusing adoption would throw away a
    // perfectly good LCP paint for nothing.
    detailSkeleton.__resetDetailSkeletonForTests()
    document.body.innerHTML = `
      <div id='root'>
        <div class='wsk-slot-header' data-wisaw-slot='header'></div>
        <div class='wsk-box'>
          <img data-wisaw-media data-wisaw-id='${PHOTO_ID}' src='${thumbUrl}' width='2250' height='3000' alt='' />
        </div>
        <div class='wsk-slot-below' data-wisaw-slot='below'></div>
      </div>
    `
    window.history.pushState({}, '', `/photos/${PHOTO_ID}`)

    const captured = detailSkeleton.captureDetailSkeleton()
    expect(captured).not.toBeNull()
    // Degenerate shape still adopts, with the anchor inside the media box: clipped by its
    // overflow:hidden as before this change, which is still better than anchoring UI to #root.
    expect(captured.navContainer.parentElement).toBe(captured.mediaBox)
    expect(captured.navContainer.childElementCount).toBe(0)
  })

  it('keeps the painted node when an edge publishes no URLs and never hands off on absence', async () => {
    // The regression this pins: with no published attributes the client can seed nothing, so the
    // first commit had no record to contradict - clearing #root there destroyed the painted LCP
    // node before anything could replace it. Absence of a record must never be a handoff.
    api.pages = { [PHOTO_ID]: { getPhotoAllCurr: currRecord([]) } }

    detailSkeleton.__resetDetailSkeletonForTests()
    buildSkeletonDom()
    stripPublishedUrls()
    window.history.pushState({}, '', `/photos/${PHOTO_ID}`)
    expect(detailSkeleton.captureDetailSkeleton()).not.toBeNull()
    const mediaNode = document.querySelector('[data-wisaw-media]')
    render(<App />, { container: document.getElementById('wisaw-app') })

    // First commit: no seed, so the reserved client frame renders - but over the untouched paint.
    expect(document.querySelector('[data-wisaw-media]')).toBe(mediaNode)
    expect(document.getElementById('root').contains(mediaNode)).toBe(true)

    await flush() // the record arrives and agrees: adoption continues, the node never moves

    expect(detailSkeleton.getDetailSkeleton()).not.toBeNull()
    expect(document.querySelector('[data-wisaw-media]')).toBe(mediaNode)
    expect(document.getElementById('root').contains(mediaNode)).toBe(true)
  })

  it('hands #root back when the settled record is empty, leaving no static frame behind', async () => {
    // "No such photo" is a contradiction like a wrong id is: without it the NoMatch page renders
    // under a fully painted picture — a photo and its own 404 on one page.
    api.pages = { [PHOTO_ID]: { getPhotoAllCurr: null } }

    detailSkeleton.__resetDetailSkeletonForTests()
    buildSkeletonDom()
    stripPublishedUrls() // no seed, so nothing is painted from the record before it answers
    window.history.pushState({}, '', `/photos/${PHOTO_ID}`)
    expect(detailSkeleton.captureDetailSkeleton()).not.toBeNull()
    const mediaNode = document.querySelector('[data-wisaw-media]')
    render(<App />, { container: document.getElementById('wisaw-app') })

    await flush() // the query answers: nothing here

    expect(detailSkeleton.getDetailSkeleton()).toBeNull()
    expect(document.getElementById('root').innerHTML).toBe('')
    expect(document.contains(mediaNode)).toBe(false)
    expect(document.querySelector('#wisaw-app .PhotosComponent')).not.toBeNull()
  })

  it('reverts a failed full-resolution swap on the adopted node to its thumbnail', async () => {
    // The edge's own onerror marks the media box broken (hiding the media via CSS). When the
    // original React published is the object that 404s, the client must put the thumb back on the
    // same node and keep that verdict off it - otherwise the visitor stares at an empty box forever.
    api.pages = { [PHOTO_ID]: { getPhotoAllCurr: currRecord([]) } }
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })

    const { mediaNode } = bootWithSkeleton()
    await screen.findByText('test header')

    act(() => {
      window.dispatchEvent(new window.Event('pointerdown'))
    })
    await flush()
    expect(mediaNode.getAttribute('src')).toBe(mediaUrl)

    // The edge's inline marker is present so the interception is real, not incidental: a capture
    // listener on the media box runs before any target-phase handler, whatever the registration
    // order, and stops the event from ever reaching it.
    mediaNode.setAttribute('onerror', "this.parentNode&&(this.parentNode.className+=' wsk-box--broken')")
    act(() => {
      mediaNode.dispatchEvent(new window.Event('error', { bubbles: false }))
    })

    expect(mediaNode.getAttribute('src')).toBe(thumbUrl)
    expect(mediaNode.parentElement.classList.contains('wsk-box--broken')).toBe(false)
    expect(document.querySelector('[data-wisaw-media]')).toBe(mediaNode)

    // A second failure — the thumb itself, an object we never chose to publish — is left to the
    // edge's own rule, and the thumbnail stays put: no rewrite loop.
    act(() => {
      mediaNode.dispatchEvent(new window.Event('error', { bubbles: false }))
    })
    expect(mediaNode.getAttribute('src')).toBe(thumbUrl)
    expect(mediaNode.parentElement.classList.contains('wsk-box--broken')).toBe(true)
  })

  it('follows native play/pause on the adopted video without a React-initiated load', async () => {
    // The edge node carries its own controls: pressing play bypasses React, so the overlay must
    // track the element's real state. A React-initiated load() would also reset playback that was
    // started through those very controls.
    const videoRecord = currRecord([])
    videoRecord.photo.video = true
    videoRecord.photo.videoUrl = `https://img.wisaw.com/${PHOTO_ID}.mp4`
    api.pages = { [PHOTO_ID]: { getPhotoAllCurr: videoRecord } }

    const { mediaNode } = bootWithVideoSkeleton()
    // jsdom implements none of the media surface: give the node just enough of it to observe what
    // React does to it, and to tell a mirrored native pause apart from a React-driven stop.
    let playing = false
    let position = 0
    Object.defineProperty(mediaNode, 'paused', { configurable: true, get: () => !playing })
    Object.defineProperty(mediaNode, 'currentTime', {
      configurable: true,
      get: () => position,
      set: (value) => { position = value }
    })
    mediaNode.load = vi.fn()
    mediaNode.play = vi.fn(() => {
      playing = true
      return Promise.resolve()
    })
    mediaNode.pause = vi.fn(() => { playing = false })

    await screen.findByRole('button', { name: 'Play video' })
    expect(mediaNode.hasAttribute('playsinline')).toBe(true)

    act(() => {
      playing = true
      mediaNode.currentTime = 42
      mediaNode.dispatchEvent(new window.Event('play'))
    })
    expect(screen.queryByRole('button', { name: 'Play video' })).toBeNull()
    // Playing via the node's own controls must not be reset by React reaching for load().
    expect(mediaNode.load).not.toHaveBeenCalled()

    act(() => {
      playing = false
      mediaNode.dispatchEvent(new window.Event('pause'))
    })
    expect(await screen.findByRole('button', { name: 'Play video' })).not.toBeNull()
    // Mirroring a native pause must not rewind the visitor's position or drop readiness — a source
    // that will not fire loadeddata again would leave the spinner stuck over the next play.
    expect(mediaNode.currentTime).toBe(42)
    expect(mediaNode.pause).not.toHaveBeenCalled()
  })

  it('gives the portalled header its sticky travel back', async () => {
    // A sticky element cannot escape its containing block: inside the edge's fixed 72px slot the
    // header would unpin almost immediately. display:contents on the slot makes .wsk the
    // containing block again, and the inline style must not survive the handoff.
    api.pages = { [PHOTO_ID]: { getPhotoAllCurr: currRecord([]) } }

    const { headerSlot } = bootWithSkeleton()
    await screen.findByText('test header')
    expect(headerSlot.style.display).toBe('contents')

    act(() => {
      window.history.pushState({}, '', `/photos/${OTHER_PHOTO_ID}`)
      window.dispatchEvent(new window.PopStateEvent('popstate', { state: {} }))
    })
    await flush()

    // Handoff drops the inline style; only edge CSS remains, which never sets display here.
    expect(headerSlot.style.display).toBe('')
  })

  it.each([
    ['an id that differs from the route', (dom) => {
      dom.querySelector('[data-wisaw-media]').setAttribute('data-wisaw-id', OTHER_PHOTO_ID)
    }],
    ['non-numeric published dimensions', (dom) => {
      const media = dom.querySelector('[data-wisaw-media]')
      media.setAttribute('width', '0')
      media.setAttribute('height', 'auto')
    }],
    ['a <video> node with no src', (dom) => {
      const media = dom.querySelector('[data-wisaw-media]')
      if (media.tagName === 'VIDEO') {
        media.removeAttribute('src')
      } else {
        replaceWithSrclessVideo(media)
      }
    }],
    ['a skeleton missing the below slot', (dom) => {
      dom.querySelector("[data-wisaw-slot='below']").remove()
    }]
  ])('paints the shared frame itself when capture declines because of %s', async (_label, corrupt) => {
    // A declined capture must stay reachable and idempotent: index.js clears #root and the app paints
    // the page - from the shared template, into the same mount point, with its enhancements portalled
    // into the same slots. No crash, nothing half-adopted, no second markup.
    api.pages = { [PHOTO_ID]: { getPhotoAllCurr: currRecord([{ id: 'c1', comment: 'client-rendered comment' }]) } }

    detailSkeleton.__resetDetailSkeletonForTests()
    buildSkeletonDom()
    corrupt(document)
    window.history.pushState({}, '', `/photos/${PHOTO_ID}`)

    expect(detailSkeleton.captureDetailSkeleton()).toBeNull()
    document.getElementById('root').innerHTML = '' // what index.js does when nothing was captured

    render(<App />, { container: document.getElementById('wisaw-app') })
    await flush()

    expect(await screen.findByText('client-rendered comment')).not.toBeNull()
    const media = document.querySelector('#root [data-wisaw-media]')
    expect(media, 'frame painted from the record').not.toBeNull()
    expect(media.getAttribute('src')).toBe(mediaUrl)
    expect(document.querySelector('#root .wsk h1')).not.toBeNull()
    // The enhancement layer is in the frame's own slots, and the shell adopted it like an edge page.
    expect(document.querySelector("#root [data-wisaw-slot='below'] .comments-section")).not.toBeNull()
    expect(document.querySelector('#wisaw-app .App').classList.contains('App--adopted')).toBe(true)
    // Nothing of the old client card survives anywhere.
    expect(document.querySelector('.crop')).toBeNull()
    expect(document.querySelector('.mainImage')).toBeNull()
  })
})

// Fixture helper for the declined-capture table: swap the img for a src-less video.
function replaceWithSrclessVideo (media) {
  const video = document.createElement('video')
  for (const attribute of media.attributes) {
    video.setAttribute(attribute.name, attribute.value)
  }
  video.removeAttribute('src')
  media.replaceWith(video)
}

// What the first paint is built from. The URLs come off the edge-published attributes, so this also
// pins the fallback that matters: an edge that publishes none must not be guessed at.
describe('detail skeleton seed (URLs published by the edge)', () => {
  const seedDom = (attrs) => {
    document.body.innerHTML = `
      <div id='root'>
        <div class='wsk'>
          <div class='wsk-slot-header' data-wisaw-slot='header'></div>
          <div class='wsk-main'>
            <div class='wsk-box' style='aspect-ratio:2250/3000;--wsk-cap:525px'>
              <img class='wsk-media' data-wisaw-media data-wisaw-id='${PHOTO_ID}' src='${thumbUrl}'${attrs}
                   width='2250' height='3000' alt='' />
            </div>
            <nav><a href='/'>WiSaw</a></nav>
            <div class='wsk-slot-below' data-wisaw-slot='below'></div>
          </div>
        </div>
      </div>
    `
    window.history.pushState({}, '', `/photos/${PHOTO_ID}`)
  }

  afterEach(() => {
    detailSkeleton.__resetDetailSkeletonForTests()
    document.body.innerHTML = ''
    window.history.pushState({}, '', '/')
  })

  it('seeds the exact URLs the edge published', () => {
    seedDom(` data-wisaw-src='${mediaUrl}' data-wisaw-thumb='${thumbUrl}'`)
    expect(detailSkeleton.captureDetailSkeleton()).not.toBeNull()

    const seeded = detailSkeleton.skeletonSeededPhoto(PHOTO_ID, 'photos')
    expect(seeded.photo.imgUrl).toBe(mediaUrl)
    expect(seeded.photo.thumbUrl).toBe(thumbUrl)
  })

  it('seeds nothing when the edge published no URLs, and still adopts the paint', () => {
    // An older edge build is still live on some cached origins. Losing the seed costs one empty first
    // commit until GraphQL answers; losing adoption would cost the LCP win as well.
    seedDom('')
    expect(detailSkeleton.captureDetailSkeleton()).not.toBeNull()
    expect(detailSkeleton.skeletonSeededPhoto(PHOTO_ID, 'photos')).toBeNull()
  })

  it('seeds nothing when a published URL is not an absolute https one', () => {
    // A relative or scheme-less value would seed a URL that resolves against the page origin and 404s;
    // treating it as absent is the safe reading of a contract violation.
    seedDom(` data-wisaw-src='${PHOTO_ID}.webp' data-wisaw-thumb='${thumbUrl}'`)
    expect(detailSkeleton.captureDetailSkeleton()).not.toBeNull()
    expect(detailSkeleton.skeletonSeededPhoto(PHOTO_ID, 'photos')).toBeNull()
  })
})
