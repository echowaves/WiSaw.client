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

const api = vi.hoisted(() => ({ feed: null, detail: undefined, fail: false, never: false }))

vi.mock('./consts', () => ({
  gqlClient: {
    query: ({ query }) => {
      const operation = query?.definitions?.[0]?.name?.value
      if (operation === 'getPhotoAllCurr' && api.detail !== undefined) {
        return Promise.resolve(api.detail)
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

describe('route landmarks', () => {
  beforeEach(() => {
    api.feed = null
    api.detail = undefined
    api.fail = false
    api.never = false
  })

  afterEach(() => {
    api.feed = null
    api.detail = undefined
    api.fail = false
    api.never = false
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
