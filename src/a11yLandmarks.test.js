/* eslint-disable react/react-in-jsx-scope */
/**
 * Landmark contract for axe `landmark-one-main` (and the top-level rules it would otherwise
 * trade away, `landmark-banner-is-top-level` / `landmark-contentinfo-is-top-level`).
 *
 * Every route must expose exactly one main landmark once React has settled, and the site's own
 * banner and contentinfo must sit beside it rather than inside it. The detail route is included
 * because its column used to be the only main in the app: nothing here may add a second one.
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createElement } from 'react'

import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ feed: null, detail: undefined, fail: false, never: false, neighbours: false }))

vi.mock('./consts', () => ({
  gqlClient: {
    query: ({ query }) => {
      const operation = query?.definitions?.[0]?.name?.value
      if (operation === 'getPhotoAllCurr' && api.detail !== undefined) {
        return Promise.resolve(api.detail)
      }
      if ((operation === 'getPhotoAllNext' || operation === 'getPhotoAllPrev') && api.neighbours) {
        // Settled neighbours are what open the footer gate; without them it opens on the 4 s timer.
        return Promise.resolve({ data: { [operation]: { photo: null } } })
      }
      if (operation === 'feedRecent' || operation === 'feedForTextSearch') {
        if (api.never) {
          return new Promise(() => {})
        }
        if (api.fail) {
          return Promise.reject(new Error('AppSync unreachable'))
        }
        return Promise.resolve({
          data: { [operation]: api.feed ?? { photos: [], batch: '0', noMoreData: true } }
        })
      }
      // Everything else — detail neighbours included — stays in flight, as on a cold deep link.
      return new Promise(() => {})
    }
  }
}))
vi.mock('react-ga4', () => ({ default: { initialize: vi.fn(), send: vi.fn() } }))
// react-loader-spinner cannot mount under jsdom (same stand-in staticRouteCopy.contract.test.js uses).
vi.mock('react-loader-spinner', () => ({ Bars: () => null }))
vi.mock('./containers/Header', () => ({
  default: () => createElement('header', { id: 'test-header' }, 'site header')
}))
vi.mock('./containers/Footer', () => ({
  default: () => createElement('footer', null, 'site footer')
}))

const App = (await import('./App')).default
const { detailFrameHtml } = await import('./utils/detailTemplate.generated')
const { captureDetailSkeleton, __resetDetailSkeletonForTests } = await import('./utils/detailSkeleton')

const PHOTO_ID = '29461ee8-34dd-4c2b-848f-c16d766713e8'
const FEED_PHOTO = {
  id: PHOTO_ID,
  video: false,
  width: 1920,
  height: 1080,
  thumbUrl: `https://img.wisaw.com/${PHOTO_ID}-thumb.webp`,
  imgUrl: `https://img.wisaw.com/${PHOTO_ID}.webp`
}

// Route components and the Footer are dynamic imports, so a settled page needs real task turns, not
// just microtasks. Poll until the landmark is on screen, then give the lazy footer a few more turns
// so "footer outside main" is judged against the finished page rather than a half-loaded one.
const flush = async () => {
  for (let round = 0; round < 60; round++) {
    await act(async () => {
      await new Promise((resolveTask) => { setTimeout(resolveTask, 5) })
    })
    if (document.querySelector('main')) {
      break
    }
  }

  for (let round = 0; round < 4; round++) {
    await act(async () => {
      await new Promise((resolveTask) => { setTimeout(resolveTask, 5) })
    })
  }
}

// Same, for pages whose first frame already contains a <main>: `flush` stops looking as soon as one
// exists, which would let this return before React has committed anything at all. Every round runs.
const settle = async (rounds = 40) => {
  for (let round = 0; round < rounds; round++) {
    await act(async () => {
      await new Promise((resolveTask) => { setTimeout(resolveTask, 5) })
    })
  }
}

// Mounts the real shell the way src/index.js does: #root holds whatever the edge served, and the
// app mounts into the sibling container. Header/Footer are stand-ins so a landmark found inside
// main can only have come from a route component.
const mountRoute = async (path) => {
  document.body.innerHTML = "<div id='root'></div><div id='wisaw-app'></div>"
  window.history.pushState({}, '', path)
  render(<App />, { container: document.getElementById('wisaw-app') })
  await flush()
}

const mains = () => [...document.querySelectorAll('main')]

const expectSingleMain = () => {
  const found = mains()
  expect(found).toHaveLength(1)
  for (const region of ['header', 'footer']) {
    expect(found[0].querySelector(region), `no <${region}> nested inside <main>`).toBeNull()
  }
  return found[0]
}

// The frame Lambda@Edge serves, built by the shared template rather than hand-written, so these
// cases measure the same bytes the browser gets. withStyle: false because the real page carries that
// sheet once and jsdom does not care either way.
const paintEdgeFrame = (photoId, kind = 'photos', { seedable = true } = {}) => {
  const root = document.getElementById('root')
  root.innerHTML = detailFrameHtml({
    entityLabel: kind === 'videos' ? 'video' : 'photo',
    mediaId: photoId,
    imageUrl: `https://img.wisaw.com/${photoId}.webp`,
    previewUrl: `https://img.wisaw.com/${photoId}-thumb.webp`,
    videoUrl: `https://img.wisaw.com/${photoId}.mp4`,
    altText: 'edge-painted media',
    title: 'Edge-painted page',
    description: 'Served before a single byte of JavaScript ran.',
    labels: ['lake'],
    width: 1920,
    height: 1080,
    withStyle: false
  })

  if (!seedable) {
    // An edge build from before C5 — or a CloudFront copy that predates it — publishes no object
    // URLs. React then cannot seed a record from the frame and has to answer the route with no
    // record at all, which is the state the placeholder guard exists for. Adoption is unaffected:
    // a frame without URLs still earns the LCP win.
    const media = root.querySelector('[data-wisaw-media]')
    media.removeAttribute('data-wisaw-src')
    media.removeAttribute('data-wisaw-thumb')
  }

  captureDetailSkeleton()
}

// A cold deep link on an edge-painted page: pathname first (the capture reads it), then the served
// frame in #root, then the app mounts into its own container — the real boot order.
const mountEdgePaintedRoute = async (path, photoId, kind = 'photos', options) => {
  document.body.innerHTML = "<div id='root'></div><div id='wisaw-app'></div>"
  window.history.pushState({}, '', path)
  __resetDetailSkeletonForTests()
  paintEdgeFrame(photoId, kind, options)
  render(<App />, { container: document.getElementById('wisaw-app') })
  await settle()
}

describe('route landmarks', () => {
  beforeEach(() => {
    api.feed = null
    api.detail = undefined
    api.fail = false
    api.never = false
    api.neighbours = false
    __resetDetailSkeletonForTests()
  })

  afterEach(() => {
    api.feed = null
    api.detail = undefined
    api.fail = false
    api.never = false
    api.neighbours = false
    __resetDetailSkeletonForTests()
    document.body.innerHTML = ''
    window.history.pushState({}, '', '/')
  })

  it('gives the feed page one main that holds its headings and cards', async () => {
    api.feed = { photos: [FEED_PHOTO], batch: '0', noMoreData: true }
    await mountRoute('/')

    const main = expectSingleMain()
    expect(main.textContent).toContain('Unaltered Photos and Videos')
    expect(main.querySelector(`a[href="/photos/${PHOTO_ID}"]`)).not.toBeNull()
  })

  it.each([
    ['the empty search prompt', '/search', 'Search WiSaw'],
    ['search results', '/search/lake', 'Search results for: lake'],
    ['the nothing-found state', '/search/zzznothing', 'Nothing found']
  ])('keeps one main across %s', async (_label, path, expected) => {
    api.feed = path === '/search/lake'
      ? { photos: [FEED_PHOTO], batch: '0', noMoreData: true }
      : { photos: [], batch: '0', noMoreData: true }
    await mountRoute(path)

    const main = expectSingleMain()
    expect(main.textContent).toContain(expected)
    // The footer is a sibling of the landmark on this route, never a descendant.
    expect(document.querySelector('footer')).not.toBeNull()
  })

  it('keeps one main while the first search page is still in flight', async () => {
    api.never = true
    await mountRoute('/search/lake')

    const main = expectSingleMain()
    expect(main.className).toBe('initial-loading-container')
    expect(main.querySelector('[aria-label="Loading content"]')).not.toBeNull()
    expect(main.textContent).not.toContain('Search results for')
  })

  it.each(['/about', '/contact', '/terms'])('wraps %s in one main with the footer outside it', async (path) => {
    await mountRoute(path)

    const main = expectSingleMain()
    expect(main.className).toBe('container')
    expect(document.querySelector('footer')).not.toBeNull()
  })

  it('keeps the deep-link placeholder on its single existing main', async () => {
    // No edge skeleton in #root and the record still in flight: this is the branch that already
    // owned <main class="content-container">. Nothing here may add a second landmark to it.
    await mountRoute(`/photos/${PHOTO_ID}`)

    const main = expectSingleMain()
    expect(main.className).toBe('content-container')
    expect(main.getAttribute('role')).toBe('main')
  })

  it('gives a detail page whose record is missing one main, not two', async () => {
    api.detail = { data: { getPhotoAllCurr: { photo: null, comments: [], recognitions: [] } } }
    await mountRoute(`/photos/${PHOTO_ID}`)

    expectSingleMain()
  })

  it('paints no placeholder of its own under an edge-painted frame', async () => {
    // A frame with no published object URLs — an older edge, or a CloudFront copy that predates
    // them — cannot seed a record, so React faces this route with nothing to paint from. It used to
    // answer that with a placeholder media box under the page already on screen, harmless only
    // while that frame carried no landmark of its own. (A frame that can seed never reaches this:
    // the seed fills currPhoto before the first commit, and the settled case is the test below.)
    await mountEdgePaintedRoute(`/photos/${PHOTO_ID}`, PHOTO_ID, 'photos', { seedable: false })

    // One landmark for the whole page, and it is the served column's. React's placeholder would
    // make this two — one in #root, one in its own container.
    const found = mains()
    expect(found).toHaveLength(1)
    expect(found[0].classList.contains('wsk-main')).toBe(true)
    expect(document.getElementById('wisaw-app').querySelector('.crop')).toBeNull()
    // The edge frame is still the page: nothing cleared or replaced it.
    expect(document.querySelectorAll('#root [data-wisaw-media]')).toHaveLength(1)
  })

  it('takes its one main from the served column once an edge-painted page settles', async () => {
    api.neighbours = true
    api.detail = {
      data: {
        getPhotoAllCurr: { photo: { ...FEED_PHOTO, createdAt: '2026-01-01T00:00:00.000Z' }, comments: [], recognitions: [] }
      }
    }
    await mountEdgePaintedRoute(`/photos/${PHOTO_ID}`, PHOTO_ID)

    // Adoption means React never mounts the LCP subtree, so this landmark can only be the template's
    // own column — which is why WiSaw.cdk serves it as <main class="wsk-main"> (brief §10, C6).
    const main = expectSingleMain()
    expect(main.classList.contains('wsk-main')).toBe(true)
    expect(document.getElementById('wisaw-app').querySelector('main')).toBeNull()
    // And the footer stays out of it: nested in <main> it would stop being a contentinfo landmark.
    const footer = document.querySelector('footer')
    expect(footer).not.toBeNull()
    expect(main.contains(footer)).toBe(false)
  })

  it('still exposes one main when the feed query fails outright', async () => {
    api.fail = true
    await mountRoute('/')
    expectSingleMain()

    await mountRoute('/search/lake')
    expectSingleMain()
  })
})

describe('the no-JS fallback inside the mount point', () => {
  const html = readFileSync(resolve('index.html'), 'utf8')
  const opened = html.indexOf('<div id="root">')
  const closed = html.indexOf('</div>', opened) + '</div>'.length
  const fallback = html.slice(opened, closed)

  it('wraps the static body in a landmark', () => {
    expect(fallback).toMatch(/^<div id="root">\s*<main>\s*<h1>/)
    expect(fallback).toMatch(/<\/main><\/div>$|<\/main>\s*<\/div>$/)
  })

  it('keeps the critical sheet styling that fallback text', () => {
    // The guards are direct-child selectors; without the "#root > main >" forms the fallback text
    // inside the new landmark would lose its column for the frame before the app stylesheet lands.
    const critical = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((found) => found[1]).join('\n')
    expect(critical).toMatch(/#root > main > h1, #root > main > h2, #root > main > p, #root > main > nav/)
    expect(critical).toMatch(/#root > h1, #root > main > h1 \{ margin-top: 20px \}/)
    expect(critical).toMatch(/#root > img, #root > main > img/)
  })

  it('leaves the injector the same span to replace', () => {
    // The edge replaces from the mount point to the first closing div. A landmark adds no closing
    // div, so that span must still be exactly the mount point itself.
    const injected = `${html.slice(0, opened)}<div id="root"><h1>Injected by the edge</h1></div>${html.slice(closed)}`

    expect(injected.match(/<div id="root">/g)).toHaveLength(1)
    expect(injected).not.toContain('Unaltered Photos and Videos')
    expect(injected).toMatch(/<script type="module"[^>]*\bsrc=/)
  })
})
