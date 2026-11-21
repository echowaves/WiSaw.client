import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createContext, runInContext } from 'node:vm'

import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'

import { DETAIL_MOBILE_BREAKPOINT, HEADER_DESKTOP_PX, HEADER_MOBILE_PX } from './utils/detailLayout'
import { FEED_BREAKPOINT_COLS } from './utils/imageUtils'

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

  it('inlines the header height that keeps the adopted slot from collapsing', () => {
    // React gives the edge's header slot `display:contents`, which deletes its reserved min-height;
    // from then on the header's own height holds the page up. If only the async sheet knows that
    // height, the frame jumps up by a whole header and back down when the sheet lands — two shifts
    // of the viewport, measured at 0.14 CLS. So the numbers must be here, and identical in three
    // places: this block, the app stylesheet, and what the edge reserves.
    const headerCss = readFileSync(resolve('src/containers/Header.css'), 'utf8')

    expect(styleBlock).toMatch(/#header\s*\{[^}]*position:\s*sticky/)
    // `var(--border)` cannot be used here (the variable lives in the async sheet), so both of its
    // values are spelled out — and they must be the stylesheet's own, or dark mode flashes a light
    // hairline under the header.
    const indexCss = readFileSync(resolve('src/index.css'), 'utf8')
    const borderValues = [...new Set([...indexCss.matchAll(/--border:\s*([^;]+);/g)].map((m) => m[1].trim()))]

    expect(borderValues.length).toBeGreaterThan(1)
    for (const value of borderValues) {
      expect(styleBlock, `critical block is missing the "${value}" header border`).toContain(value)
    }

    const desktop = styleBlock.match(/\.header-container\s*\{[^}]*height:\s*(\d+)px/)
    const mobile = styleBlock.match(/max-width:\s*768px\s*\)\s*\{\s*\.header-container\s*\{[^}]*height:\s*(\d+)px/)

    expect(desktop?.[1]).toBe(String(HEADER_DESKTOP_PX))
    expect(mobile?.[1]).toBe(String(HEADER_MOBILE_PX))
    expect(headerCss).toMatch(new RegExp(`\\.header-container\\s*\\{[^}]*height:\\s*${HEADER_DESKTOP_PX}px`))
    expect(headerCss).toMatch(new RegExp(`\\.header-container\\s*\\{[^}]*height:\\s*${HEADER_MOBILE_PX}px`))

    // Heights are not the only numbers this block copies: a padding or max-width that drifts slides
    // the logo and menu sideways under the already-painted header, which is the same shift class.
    // So every declaration the app sheet makes at each breakpoint must be present here, identical.
    const declarations = (source, rule) => Object.fromEntries(
      (source.match(rule)?.[1] ?? '')
        .split(';')
        .map((part) => part.split(':').map((piece) => piece.trim()))
        .filter(([prop, value]) => prop && value)
    )
    const mirrored = (label, rule) => {
      const app = declarations(headerCss, rule)
      const inline = declarations(styleBlock, rule)
      expect(Object.keys(app).length, `no ${label} rule found in Header.css`).toBeGreaterThan(0)
      for (const [prop, value] of Object.entries(app)) {
        expect(inline[prop], `critical block is missing "${prop}: ${value}" from ${label}`)
          .toBe(value)
      }
    }

    mirrored('.header-container', /\.header-container\s*\{([^}]*)\}/)
    mirrored('.header-container at 768px', /max-width:\s*768px\s*\)\s*\{\s*\.header-container\s*\{([^}]*)\}/)
    mirrored('.header-container at 480px', /max-width:\s*480px\s*\)\s*\{\s*\.header-container\s*\{([^}]*)\}/)
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

// The static body of the mount point is the first frame on every route, and the rules that paint it
// live in this document's single inline block. Every value they copy comes from a stylesheet or a
// component elsewhere in the repo, so each one is read back here: drift between the two is a visible
// jump at handoff on the site's most-visited entry point.
describe('index.html first frame', () => {
  const styleBlock = templateHtml.match(/<style>([\s\S]*?)<\/style>/i)?.[1] ?? ''
  const rulesOnly = styleBlock.replace(/\/\*[\s\S]*?\*\//g, '')
  const opened = templateHtml.indexOf('<div id="root">')
  const frameMarkup = templateHtml.slice(opened, templateHtml.indexOf('</div>', opened))

  const appCss = readFileSync(resolve('src/index.css'), 'utf8')
  const headerCss = readFileSync(resolve('src/containers/Header.css'), 'utf8')
  const feedCss = readFileSync(resolve('src/containers/PhotosComponent.css'), 'utf8')
  const homeJs = readFileSync(resolve('src/containers/Home.js'), 'utf8')
  const gridJs = readFileSync(resolve('src/containers/FeedGrid.js'), 'utf8')

  /** Declarations of one exact selector, from the critical block or an app stylesheet alike. */
  const declarationsOf = (css, selector) => {
    const found = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(([, name]) => name.trim().replace(/\s+/g, ' ') === selector)
    expect(found.length, `no "${selector}" rule found`).toBeGreaterThan(0)
    return Object.fromEntries(found[0][2]
      .split(';')
      .map((part) => part.split(':').map((bit) => bit.trim()))
      .filter(([prop, value]) => prop && value))
  }

  /** A token's own value for a theme, straight out of src/index.css (theme block first, :root next). */
  const token = (name, theme = 'light') => {
    const scopes = [
      appCss.match(new RegExp(`\\[data-theme='${theme}'\\]\\s*\\{([^}]*)\\}`))?.[1],
      appCss.match(/:root\s*\{([^}]*)\}/)?.[1]
    ]
    for (const scope of scopes) {
      const value = new RegExp(`--${name}:\\s*([^;]+);`).exec(scope ?? '')?.[1]?.trim()
      if (value) {
        return value
      }
    }
    throw new Error(`--${name} is not defined in src/index.css`)
  }

  // The block's dark counterparts: from the last prefers-color-scheme rule to the next media query.
  const darkBlock = styleBlock.slice(styleBlock.lastIndexOf('@media (prefers-color-scheme: dark)')).split('@media screen')[0]

  it('stays small enough to be worth inlining', () => {
    // Comments cost almost nothing once gzipped; the rules themselves ship on every cold visit. The
    // allowance covers the chrome and feed geometry plus the actions, hamburger and search-row
    // reservations that keep the nav and grid from stepping sideways at handoff.
    expect(rulesOnly.length).toBeLessThan(8000)
  })

  it('lays the static page out like FeedGrid does', () => {
    expect(gridJs).toContain("maxWidth: '1120px'")
    expect(gridJs).toContain("width: '90%'")

    const column = declarationsOf(styleBlock, '.ff-column')
    expect(column.width).toBe('90%')
    expect(column['max-width']).toBe('1120px')
    // .App centres its text, so the frame has to as well or the headings step sideways at handoff.
    expect(column['text-align']).toBe('center')

    const page = declarationsOf(styleBlock, '.ff-page')
    expect(page.display).toBe('flex')
    expect(page.width).toBe('100%')
    expect(page['justify-content']).toBe('center')
  })

  it('boxes the frame the way src/index.css boxes everything else', () => {
    // The async sheet's universal border-box is not in time for the first frame, so the frame has to
    // carry it itself; without it a bordered or padded box paints 2px wider than after boot.
    expect(appCss).toMatch(/\*\s*\{\s*box-sizing:\s*border-box/)

    const borderBoxed = new Set([...rulesOnly.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(([, , body]) => /box-sizing:\s*border-box/.test(body))
      .flatMap(([, name]) => name.split(',').map((bit) => bit.trim())))
    for (const selector of ['.ff-logo-icon', '.ff-nav-link', '.ff-track', '.ff-card']) {
      expect(borderBoxed, `${selector} is not border-box in the critical block`).toContain(selector)
    }
  })

  it('sets the intro headings at the scale and colours Home.js uses', () => {
    const title = declarationsOf(styleBlock, '.ff-title')
    const lede = declarationsOf(styleBlock, '.ff-lede')

    // The two sizes are Home's inline styles; if it changes, this block has to follow or the copy
    // visibly reflows at handoff.
    for (const value of ['clamp(1.75rem, 4vw, 2.5rem)', 'clamp(1.1rem, 2.5vw, 1.5rem)']) {
      expect(homeJs, `Home.js no longer sets ${value}`).toContain(value)
    }
    expect(title['font-size']).toBe('clamp(1.75rem, 4vw, 2.5rem)')
    expect(lede['font-size']).toBe('clamp(1.1rem, 2.5vw, 1.5rem)')
    expect(title['line-height']).toBe('1.2')
    expect(lede['line-height']).toBe('1.4')
    // Home overrides size, line-height, margin and colour - never weight - so the hydrated headings
    // paint at Bootstrap's reboot weight (500) for the h1 and its own 400 for the h2. A different
    // number here reflows the same words at handoff.
    expect(homeJs).not.toMatch(/fontSize: 'clamp\(1\.75rem[^}]*fontWeight/s)
    expect(homeJs).toContain("fontWeight: '400'")
    expect(title['font-weight']).toBe('500')
    expect(lede['font-weight']).toBe('400')

    expect(title.color).toBe(token('text-primary'))
    expect(lede.color).toBe(token('text-secondary'))
    expect(declarationsOf(darkBlock, '.ff-title').color).toBe(token('text-primary', 'dark'))
    expect(declarationsOf(darkBlock, '.ff-lede').color).toBe(token('text-secondary', 'dark'))
  })

  it('reserves the feed area on the real masonry geometry', () => {
    expect(declarationsOf(styleBlock, '.ff-feed')['margin-left'])
      .toBe(declarationsOf(feedCss, '.masonry-grid')['margin-left'])

    const track = declarationsOf(styleBlock, '.ff-track')
    const appColumn = declarationsOf(feedCss, '.masonry-grid-column')
    expect(track.flex).toBe(appColumn.flex)
    expect(track['padding-left']).toBe(appColumn['padding-left'])

    const card = declarationsOf(styleBlock, '.ff-card')
    expect(card['margin-bottom']).toBe(declarationsOf(feedCss, '.masonry-grid-column>div')['margin-bottom'])
    expect(card['border-radius']).toBe(token('radius-xl'))
    expect(declarationsOf(feedCss, '.home-thumb-card')['border-radius']).toContain('--radius-xl')
    expect(card.background).toBe(token('bg-card'))
    expect(declarationsOf(darkBlock, '.ff-card').background).toBe(token('bg-card', 'dark'))

    // One track per starting column, and the extras drop at exactly the breakpoints
    // react-masonry-css uses (windowWidth <= breakpoint), so the reserved grid is never wider than
    // the cards that replace it.
    expect(frameMarkup.match(/class="ff-track"/g)).toHaveLength(FEED_BREAKPOINT_COLS.default)
    for (const [breakpoint, columns] of Object.entries(FEED_BREAKPOINT_COLS)) {
      if (breakpoint === 'default') {
        continue
      }
      expect(styleBlock, `no column drop at ${breakpoint}px`)
        .toMatch(new RegExp(`max-width:\\s*${breakpoint}px[\\s\\S]{0,300}?\\.ff-track:nth-child\\(${columns + 1}\\)`))
    }
  })

  it('paints the chrome with the app palette in both schemes', () => {
    const icon = declarationsOf(styleBlock, '.ff-logo-icon')
    const appIcon = declarationsOf(headerCss, '.logo-icon')
    expect(icon.width).toBe(appIcon.width)
    expect(icon.height).toBe(appIcon.height)
    expect(icon['border-radius']).toBe(token('radius-md'))
    expect(icon.background).toBe(token('bg-raised'))

    // index.css colours every anchor with --link; this block may not select bare anchors, so it spells it.
    expect(declarationsOf(styleBlock, '.ff-logo-link').color).toBe(token('link'))
    expect(declarationsOf(styleBlock, '.ff-logo-title').color).toBe(token('wordmark'))
    expect(declarationsOf(styleBlock, '.ff-logo-subtitle').color).toBe(token('text-muted'))
    expect(declarationsOf(styleBlock, '.ff-nav-link').color).toBe(token('text-secondary'))

    // Dark counterparts: without these the frame flashes a white logo card and light headings until
    // the async sheet lands.
    expect(declarationsOf(darkBlock, '.ff-logo-link').color).toBe(token('link', 'dark'))
    expect(declarationsOf(darkBlock, '.ff-logo-icon').background).toBe(token('bg-raised', 'dark'))
    expect(declarationsOf(darkBlock, '.ff-logo-title').color).toBe(token('wordmark', 'dark'))
    expect(declarationsOf(darkBlock, '.ff-logo-subtitle').color).toBe(token('text-muted', 'dark'))
  })

  it('reserves the rest of the boxes React paints around the copy', () => {
    // The bar itself. `justify-content: space-between` distributes by CHILD COUNT, so a frame with
    // two children puts the nav flush right and slides it left when Header.js paints three or four.
    const appBar = declarationsOf(headerCss, '.header-container')
    const bar = declarationsOf(styleBlock, '.ff-bar')
    for (const prop of ['display', 'justify-content', 'align-items', 'max-width', 'height']) {
      expect(bar[prop], 'frame .ff-bar.' + prop).toBe(appBar[prop])
    }
    // The mobile step Header.css gives the bar, so the frame shortens with it. There is more than
    // one 768px block in this sheet, so search all of them.
    const mobileRules = [...styleBlock.matchAll(/@media screen and \(max-width: 768px\) \{([\s\S]*?)\n {4}\}/g)]
      .map((found) => found[1]).join('\n')
    expect(declarationsOf(mobileRules, '.ff-bar').height).toBe(`${HEADER_MOBILE_PX}px`)
    expect(declarationsOf(mobileRules, '.ff-hamburger').display).toBe('block')

    // Third child: the app's theme control. Its own width is content-driven, so only the parts
    // Header.css fixes are mirrored — icon box, the group gap and its left margin.
    const actions = declarationsOf(styleBlock, '.ff-actions')
    expect(actions['margin-left']).toBe(declarationsOf(headerCss, '.header-actions')['margin-left'])
    expect(actions.gap).toBe(declarationsOf(headerCss, '.theme-dropdown').gap)
    const appIcon = declarationsOf(headerCss, '.theme-dropdown-icon')
    const frameIcon = declarationsOf(styleBlock, '.ff-actions-icon')
    for (const prop of ['width', 'height']) {
      expect(frameIcon[prop], 'frame .ff-actions-icon.' + prop).toBe(appIcon[prop])
    }

    // Fourth child: the hamburger Header.css shows at or below 768px.
    const appBurger = declarationsOf(headerCss, '.hamburger-menu')
    const burger = declarationsOf(styleBlock, '.ff-hamburger')
    for (const prop of ['width', 'height', 'padding']) {
      expect(burger[prop], 'frame .ff-hamburger.' + prop).toBe(appBurger[prop])
    }

    // Nav links carry a transparent border in the app; without it every box is 2px smaller.
    const navLink = declarationsOf(styleBlock, '.ff-nav-link')
    const appNavLink = declarationsOf(headerCss, '.nav-menu a')
    for (const prop of ['padding', 'border']) {
      expect(navLink[prop], 'frame .ff-nav-link.' + prop).toBe(appNavLink[prop])
    }

    // Home's search row sits between the lede and the grid: right-aligned, 10px of bottom padding,
    // and a Bootstrap control 38px tall (1.5em line box + .75rem vertical padding + 2px border).
    expect(declarationsOf(styleBlock, '.ff-search')['padding-bottom']).toBe('10px')
    expect(declarationsOf(styleBlock, '.ff-search')['justify-content']).toBe('right')
    expect(declarationsOf(styleBlock, '.ff-search-field').height).toBe('38px')
  })

  it('reserves a feed only on the routes that paint one', () => {
    // /about, /contact and /terms render no grid at all, so placeholder cards there would sit over
    // their own copy. A parser-inserted script marks those paths before the body is parsed; a
    // deferred or module script would let the cards paint first, which is the flicker being removed.
    const feedScript = templateHtml.match(/<script data-wisaw-feed>([\s\S]*?)<\/script>/)
    expect(feedScript, 'the data-wisaw-feed script').not.toBeNull()
    expect(feedScript[1]).toContain("setAttribute('data-wisaw-feed', 'off')")
    expect(feedScript[1]).not.toMatch(/defer|type="module"/)
    for (const kept of ["path === '/'", "'/search'"]) {
      expect(feedScript[1], `feed script keeps ${kept}`).toContain(kept)
    }
    expect(styleBlock).toMatch(/html\[data-wisaw-feed='off'\] \.ff-feed\s*\{\s*display:\s*none/)
    expect(declarationsOf(darkBlock, '.ff-nav-link').color).toBe(token('text-secondary', 'dark'))
  })

  it('styles every class the frame uses, with no second request for any of it', () => {
    // The Never constraint "no second stylesheet request for the first frame" fails silently: a class
    // added to the markup with no rule here simply paints unstyled.
    const declared = new Set(rulesOnly.match(/\.[-\w]+/g))
    const used = [...frameMarkup.matchAll(/class="([^"]+)"/g)].flatMap((found) => found[1].split(/\s+/))

    expect(used.length).toBeGreaterThan(0)
    for (const name of used) {
      expect(declared.has(`.${name}`), `.${name} is in the frame but styled nowhere inline`).toBe(true)
    }
  })

  it('reserves space without inventing any content', () => {
    // Placeholder cards only: no media URL, no background image. A fake thumbnail would be indexed,
    // cached and blamed on us.
    expect(frameMarkup).toMatch(/class="ff-feed" aria-hidden="true"/)
    expect(frameMarkup).not.toMatch(/url\(/)
    expect(frameMarkup).not.toMatch(/img\.wisaw\.com/)
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
