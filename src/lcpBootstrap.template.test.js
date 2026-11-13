import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createContext, runInContext } from 'node:vm'

import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'

import { DETAIL_MOBILE_BREAKPOINT } from './utils/detailLayout'

// The two inline scripts in index.html are the whole pre-hydration LCP path: Lambda@Edge paints a
// full-resolution image into <div id="root">, and these decide which bytes that element points at.
// They are classic parser-inserted scripts, so they cannot import anything - which means their
// behaviour can only be pinned by extracting them from the template and running them verbatim.
const templateHtml = readFileSync(resolve('index.html'), 'utf8')

const inlineScript = (marker) => {
  const tags = templateHtml.match(new RegExp(`<script[^>]*data-wisaw-lcp="${marker}"[^>]*>[\\s\\S]*?</script>`, 'gi')) ?? []
  expect(tags).toHaveLength(1)
  return tags[0].replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '')
}

const preloadScript = inlineScript('preload')
const swapScript = inlineScript('swap')

// The route id is the object name on img.wisaw.com: <id>.webp is the upload, <id>-thumb.webp the
// 300px variant React paints as its base layer.
const PHOTO_ID = '3f2a6c1e-9b4d-4c8a-a7f1-0e2d5b9c8a14'
const FULL = `https://img.wisaw.com/${PHOTO_ID}.webp`
const THUMB = `https://img.wisaw.com/${PHOTO_ID}-thumb.webp`

// Shape the edge body renderer produces: heading, one media element, caption. Structure must never
// change - only src/poster may.
const PHOTO_MARKUP = `<h1>Golden hour</h1><img src="${FULL}" alt="Golden hour"><p>Shot on a phone.</p>`
const VIDEO_MARKUP = `<h1>Harbour at dusk</h1><video preload="none" poster="${FULL}" controls></video><p>Handheld.</p>`

/** Runs the head script then the post-#root script against a simulated edge-injected document. */
const runBootstrap = ({ path, width, rootHtml }) => {
  const dom = new JSDOM(
    `<!DOCTYPE html><html><head></head><body><div id="root">${rootHtml}</div></body></html>`,
    { url: `https://wisaw.com${path}`, runScripts: 'outside-only' }
  )
  Object.defineProperty(dom.window, 'innerWidth', { configurable: true, value: width })

  const document = dom.window.document
  const untouchedMarkup = document.getElementById('root').innerHTML

  dom.window.eval(preloadScript)
  dom.window.eval(swapScript)

  return { window: dom.window, document, untouchedMarkup }
}

const imagePreloads = (document) => Array.from(document.querySelectorAll('link[rel="preload"]'))
  .filter((link) => link.getAttribute('as') === 'image')

describe('index.html LCP bootstrap on photo routes', () => {
  it('preloads and points the injected img at the thumb below the breakpoint', () => {
    const { document } = runBootstrap({ path: `/photos/${PHOTO_ID}`, width: 390, rootHtml: PHOTO_MARKUP })

    const preloads = imagePreloads(document)
    expect(preloads).toHaveLength(1)
    expect(preloads[0].getAttribute('href')).toBe(THUMB)
    expect(preloads[0].getAttribute('fetchpriority')).toBe('high')

    const img = document.querySelector('#root img')
    expect(img.getAttribute('src')).toBe(THUMB)
    expect(document.getElementById('root').innerHTML).not.toContain(FULL)
  })

  it('keeps the full-resolution source on the injected img at desktop widths', () => {
    const { document, untouchedMarkup } = runBootstrap({ path: `/photos/${PHOTO_ID}`, width: 1280, rootHtml: PHOTO_MARKUP })

    const preloads = imagePreloads(document)
    expect(preloads).toHaveLength(1)
    expect(preloads[0].getAttribute('href')).toBe(FULL)
    expect(preloads[0].getAttribute('fetchpriority')).toBe('high')

    // A 300px source would be visibly wrong at up to 700px, so nothing is rewritten.
    expect(document.querySelector('#root img').getAttribute('src')).toBe(FULL)
    expect(document.getElementById('root').innerHTML).toBe(untouchedMarkup)
  })

  it('preserves the structure the edge injector produced', () => {
    const { document } = runBootstrap({ path: `/photos/${PHOTO_ID}`, width: 390, rootHtml: PHOTO_MARKUP })

    const root = document.getElementById('root')
    expect(root.children).toHaveLength(3)
    expect(root.querySelector('h1').textContent).toBe('Golden hour')
    expect(root.querySelector('p').textContent).toBe('Shot on a phone.')
  })
})

describe('index.html LCP bootstrap on video routes', () => {
  it.each([390, 1280])('swaps the poster to the thumb at %ipx because that is React base layer', (width) => {
    const { document } = runBootstrap({ path: `/videos/${PHOTO_ID}`, width, rootHtml: VIDEO_MARKUP })

    const preloads = imagePreloads(document)
    expect(preloads).toHaveLength(1)
    expect(preloads[0].getAttribute('href')).toBe(THUMB)
    expect(preloads[0].getAttribute('fetchpriority')).toBe('high')

    const video = document.querySelector('#root video')
    expect(video.getAttribute('poster')).toBe(THUMB)
    // preload="none" and every other attribute the injector wrote stay in place.
    expect(video.getAttribute('preload')).toBe('none')
    expect(video.hasAttribute('controls')).toBe(true)
  })
})

describe('index.html LCP bootstrap no-op cases', () => {
  it.each(['/', '/about', '/search/cat', `/photos/${PHOTO_ID}/extra`, '/photos/not-a-uuid'])(
    'does nothing on %s',
    (path) => {
      const { window, document, untouchedMarkup } = runBootstrap({ path, width: 390, rootHtml: PHOTO_MARKUP })

      expect(imagePreloads(document)).toHaveLength(0)
      expect(window.__wisawLcp).toBeUndefined()
      expect(document.getElementById('root').innerHTML).toBe(untouchedMarkup)
    }
  )

  it.each([
    ['a foreign media host', `https://cdn.example.com/${PHOTO_ID}.webp`],
    ['another photo id', 'https://img.wisaw.com/00000000-0000-4000-8000-000000000000.webp'],
    ['an already-swapped thumb', THUMB],
    ['a full-resolution variant of another object', 'https://img.wisaw.com/other-full.webp']
  ])('leaves media that is not this route upload untouched: %s', (_label, src) => {
    const markup = `<h1>Golden hour</h1><img src="${src}" alt="Golden hour">`
    const { document } = runBootstrap({ path: `/photos/${PHOTO_ID}`, width: 390, rootHtml: markup })

    expect(document.querySelector('#root img').getAttribute('src')).toBe(src)
  })
})

describe('index.html LCP seed attributes on the plan', () => {
  // The edge publishes natural dimensions only when its sidecar has both; they are the only size
  // React can trust before getPhotoAllCurr answers, so the plan must carry exactly what is there.
  const DIMENSIONED_PHOTO = `<h1>Golden hour</h1><img src="${FULL}" alt="Golden hour" width="4000" height="3000"><p>Shot on a phone.</p>`
  const DIMENSIONED_VIDEO = `<h1>Harbour at dusk</h1><video preload="none" poster="${FULL}" controls width="1920" height="1080" src="https://img.wisaw.com/${PHOTO_ID}.mp4"></video><p>Handheld.</p>`

  it('copies natural dimensions from the injected img onto the plan', () => {
    const { window, document } = runBootstrap({ path: `/photos/${PHOTO_ID}`, width: 390, rootHtml: DIMENSIONED_PHOTO })

    expect(window.__wisawLcp.width).toBe(4000)
    expect(window.__wisawLcp.height).toBe(3000)
    // Capture must not disturb the swap itself.
    expect(document.querySelector('#root img').getAttribute('src')).toBe(THUMB)
  })

  it('captures dimensions on desktop too, where nothing is swapped', () => {
    const { window, document, untouchedMarkup } = runBootstrap({ path: `/photos/${PHOTO_ID}`, width: 1280, rootHtml: DIMENSIONED_PHOTO })

    expect(window.__wisawLcp.width).toBe(4000)
    expect(window.__wisawLcp.height).toBe(3000)
    expect(document.getElementById('root').innerHTML).toBe(untouchedMarkup)
  })

  it('copies the video object URL and dimensions onto the plan', () => {
    const { window, document } = runBootstrap({ path: `/videos/${PHOTO_ID}`, width: 390, rootHtml: DIMENSIONED_VIDEO })

    expect(window.__wisawLcp.width).toBe(1920)
    expect(window.__wisawLcp.height).toBe(1080)
    expect(window.__wisawLcp.videoSrc).toBe(`https://img.wisaw.com/${PHOTO_ID}.mp4`)
    // The poster swap still happens alongside the capture.
    expect(document.querySelector('#root video').getAttribute('poster')).toBe(THUMB)
  })

  it.each([
    ['no width or height', `<h1>Golden hour</h1><img src="${FULL}" alt="Golden hour"><p>Shot on a phone.</p>`],
    ['only a width', `<h1>Golden hour</h1><img src="${FULL}" alt="Golden hour" width="4000"><p>Shot on a phone.</p>`],
    ['non-numeric dimensions', `<h1>Golden hour</h1><img src="${FULL}" alt="Golden hour" width="wide" height="tall"><p>Shot on a phone.</p>`]
  ])('leaves the plan without usable dimensions when the edge wrote %s', (_label, rootHtml) => {
    const { window } = runBootstrap({ path: `/photos/${PHOTO_ID}`, width: 390, rootHtml })

    expect(window.__wisawLcp.width).toBeUndefined()
    expect(window.__wisawLcp.height).toBeUndefined()
  })
})

describe('index.html critical CSS and script placement', () => {
  const styleBlock = templateHtml.match(/<style>([\s\S]*?)<\/style>/i)?.[1] ?? ''

  it('inlines a critical block before the mount point', () => {
    expect(styleBlock.length).toBeGreaterThan(0)
    expect(templateHtml.indexOf('<style>')).toBeLessThan(templateHtml.indexOf('<div id="root">'))
  })

  it('mirrors the base rules of src/index.css so the async sheet can be late', () => {
    const indexCss = readFileSync(resolve('src/index.css'), 'utf8')

    expect(styleBlock).toMatch(/scrollbar-gutter:\s*stable/)
    expect(styleBlock).toMatch(/img\s*\{[^}]*max-width:\s*100%/i)
    expect(styleBlock).toMatch(/prefers-color-scheme:\s*dark/i)
    // The block is a copy of these rules, so they must agree with the real stylesheet.
    expect(indexCss).toMatch(/scrollbar-gutter:\s*stable/)
    expect(indexCss).toMatch(/img\s*\{[^}]*max-width:\s*100%/i)
    expect(styleBlock).toContain('#f5f7fb')
    expect(styleBlock).toContain('#111113')
  })

  it('runs the swap script after #root as a classic parser-inserted script', () => {
    const rootClose = templateHtml.indexOf('</div>', templateHtml.indexOf('<div id="root">'))
    const swapTag = templateHtml.match(/<script[^>]*data-wisaw-lcp="swap"[^>]*>/i)?.[0] ?? ''

    expect(templateHtml.indexOf(swapTag)).toBeGreaterThan(rootClose)
    expect(swapTag).not.toMatch(/type=["']module["']/i)
    expect(swapTag).not.toMatch(/\bdefer\b/i)
    expect(swapTag).not.toMatch(/\basync\b/i)
  })

  it('keeps the breakpoint in step with src/utils/detailLayout.js', () => {
    // The inline script cannot import, so the test is what stops the two from drifting.
    expect(preloadScript).toContain(`MOBILE_BREAKPOINT = ${DETAIL_MOBILE_BREAKPOINT}`)
  })

  it('warms the AppSync connection alongside the existing preconnects', () => {
    expect(templateHtml).toMatch(/<link rel="preconnect" href="https:\/\/img\.wisaw\.com" \/>/)
    expect(templateHtml).toMatch(/rel="preconnect"\s+href="https:\/\/[^"]*appsync-api[^"]*"/)
    expect(templateHtml).toMatch(/rel="dns-prefetch"\s+href="https:\/\/[^"]*appsync-api[^"]*"/)
  })

  it('columns the injected markup without ever constraining #root itself', () => {
    // Nothing in src/ or public/ styles #root, so anything the critical block puts on #root is the
    // app's layout from then on - which would cap the hydrated page and pad its full-bleed header.
    const declarations = styleBlock.replace(/\/\*[\s\S]*?\*\//g, '')
    const rules = [...declarations.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter((rule) => rule[1].includes('#root'))

    expect(rules.length).toBeGreaterThan(0)
    for (const rule of rules) {
      expect(rule[1]).toMatch(/>/)
    }
  })

  it('ships a crawlable body that only JavaScript ever changes', () => {
    // With scripting disabled - and in the raw HTML a crawler is served - nothing here may have
    // touched the media: both optimisations are runtime scripts, never markup in the template.
    // Anchored on <body> because the head comments also mention the mount point by name.
    const body = templateHtml.slice(templateHtml.indexOf('<body'))
    const rootMarkup = body.slice(body.indexOf('<div id="root">'), body.indexOf('</div>'))

    expect(rootMarkup.length).toBeGreaterThan(0)
    expect(rootMarkup).not.toMatch(/-thumb/)
    expect(body).not.toMatch(/<link[^>]*rel=["']preload["'][^>]*as=["']image["']/i)
    expect(body).not.toMatch(/document\.write/i)
  })

  it('leaves the document alone when there is nothing to swap into', () => {
    // Matrix row 6, the error half: if the edge injection produced no media element at all (or a
    // different shape than expected), the scripts must stay silent rather than throw - an uncaught
    // parse-time error would be the one failure mode that costs more than the LCP they save.
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: `https://wisaw.com/photos/${PHOTO_ID}`,
      runScripts: 'outside-only'
    })
    Object.defineProperty(dom.window, 'innerWidth', { configurable: true, value: 390 })

    expect(() => {
      dom.window.eval(preloadScript)
      dom.window.eval(swapScript)
    }).not.toThrow()
    expect(dom.window.document.getElementById('root')).toBeNull()
  })

  it('still satisfies the SEO template invariants', () => {
    const titles = templateHtml.match(/<title>/gi) ?? []
    // Repeated here so a regression in this area is reported by name, not only by the SEO suite.
    const canonicals = templateHtml.match(/<link[^>]*rel=['"]canonical['"]/gi) ?? []

    expect(canonicals).toHaveLength(0)
    expect(titles).toHaveLength(1)
    expect(templateHtml).toMatch(/<div id="root">/)
    expect(templateHtml).toMatch(/name="robots"[^>]*content="index, follow/)
  })
})

describe('index.html stale-deploy guard', () => {
  const guardScript = (templateHtml.match(/<script[^>]*data-wisaw-guard="reload"[^>]*>[\s\S]*?<\/script>/i) ?? [''])[0]
    .replace(/^<script[^>]*>/i, '')
    .replace(/<\/script>$/i, '')

  // The guard's whole world is window + sessionStorage, so it can be run against a stand-in and
  // its error handler invoked directly - which is the only way to observe a reload attempt.
  const runGuard = () => {
    const reloads = []
    const listeners = []
    const sandbox = {
      window: {
        location: { port: '', reload: () => reloads.push(true) },
        addEventListener: (type, fn, capture) => listeners.push({ type, fn, capture }),
        setTimeout: () => 0
      },
      sessionStorage: { getItem: () => null, setItem: () => {} }
    }
    runInContext(guardScript, createContext(sandbox))

    const errorHandler = listeners.find((listener) => listener.type === 'error')
    return { reloads, errorHandler }
  }

  it('listens in the capture phase, because resource errors do not bubble', () => {
    expect(runGuard().errorHandler.capture).toBe(true)
  })

  // A failed preload reaches that handler exactly as a dead bundle does - but only the stylesheet
  // is evidence of a stale index.html. An image hint derived from the pathname may simply miss, and
  // reloading for that costs the visit it was meant to rescue.
  it.each([
    ['a module script', { tagName: 'SCRIPT' }, 1],
    ['the application stylesheet', { tagName: 'LINK', rel: 'stylesheet' }, 1],
    ['an LCP image preload', { tagName: 'LINK', rel: 'preload' }, 0],
    ['an <img> that misses', { tagName: 'IMG' }, 0]
  ])('reloads for %s but not for unrelated failures', (_label, target, expected) => {
    const { reloads, errorHandler } = runGuard()

    errorHandler.fn({ target })
    expect(reloads).toHaveLength(expected)
  })
})
