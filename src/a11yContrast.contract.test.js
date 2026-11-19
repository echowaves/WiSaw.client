import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

// An axe colour-contrast audit of wisaw.com fails on every route: the global anchor colour is
// 1.76:1 on the page background, white on the button fill is 3.02:1, muted text is 4.30:1 on a
// card. The fix lives in the palette (src/index.css) rather than per element, so what keeps it
// fixed is a measurement. jsdom applies no stylesheet to rendered components, which is why this
// contract reads the token blocks and the colour-bearing rules out of the sources and applies the
// WCAG 2.1 relative-luminance maths itself.
const read = (relative) => readFileSync(join(import.meta.dirname, relative), 'utf8')

const paletteCss = read('index.css')
const photosCss = read('containers/PhotosComponent.css')
const headerCss = read('containers/Header.css')
const footerCss = read('containers/Footer.css')
const appJs = read('App.js')
const aboutJs = read('containers/About.js')
const noMatchJs = read('containers/NoMatch.js')
const photosJs = read('containers/PhotosComponent.js')

/* ------------------------------------------ WCAG 2.1 maths ----------------------------------------- */

const channelLuminance = (byte) => {
  const v = byte / 255
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

const luminance = ({ r, g, b }) =>
  0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b)

const contrastRatio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// A translucent layer is only legible over what is actually behind it, so every rgba() background
// is flattened onto its parent before anything is measured against it.
const composite = (layer, backdrop) => ({
  r: Math.round(layer.r * layer.a + backdrop.r * (1 - layer.a)),
  g: Math.round(layer.g * layer.a + backdrop.g * (1 - layer.a)),
  b: Math.round(layer.b * layer.a + backdrop.b * (1 - layer.a)),
  a: 1
})

const NAMED = { white: '#ffffff', black: '#000000' }

const parseColor = (value) => {
  const raw = String(value ?? '').trim().toLowerCase()
  const hex = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/)
  if (hex) {
    const digits = hex[1].length === 3 ? hex[1].replace(/./g, (c) => c + c) : hex[1]
    return {
      r: parseInt(digits.slice(0, 2), 16),
      g: parseInt(digits.slice(2, 4), 16),
      b: parseInt(digits.slice(4, 6), 16),
      a: 1
    }
  }
  const rgb = raw.match(/^rgba?\(([^)]+)\)$/)
  if (rgb) {
    const [r, g, b, a] = rgb[1].split(',').map((part) => Number(part.trim()))
    if ([r, g, b].some(Number.isNaN)) return null
    return { r, g, b, a: Number.isNaN(a) ? 1 : a }
  }
  return NAMED[raw] ? parseColor(NAMED[raw]) : null
}

/* --------------------------------------------- CSS reader -------------------------------------------- */

const VAR = /\bvar\(\s*(--[\w-]+)\s*(?:,\s*[^()]*)?\)/

// Resolves var() chains (including fallbacks) against one theme's tokens, then parses the result.
const colorOf = (spec, tokens) => {
  if (spec && typeof spec === 'object') {
    const layer = colorOf(spec.layer, tokens)
    const backdrop = colorOf(spec.over, tokens)
    return layer && backdrop ? composite(layer, backdrop) : null
  }
  let value = String(spec ?? '').trim().replace(/!important$/i, '').trim()
  for (let i = 0; i < 8 && VAR.test(value); i++) {
    const before = value
    value = value.replace(new RegExp(VAR.source, 'g'), (match, name) => tokens[name] ?? match)
    if (value === before) return null
  }
  return parseColor(value)
}

// Later rules win, exactly as the cascade does: `.nav-menu a.active` is declared twice, once inside
// the `:hover, .active` group and once alone. Selectors are matched in whitespace-normalised text so
// a grouped rule reads the same however it is wrapped, and a selector only matches when what follows
// it is `{` or another group member — so `.nav-menu a` never picks up `.nav-menu a:hover`.
// A selector list is read in cascade order (lowest priority first) and the last one that declares the
// property wins, which is what lets a hover pair fall back to the base rule for a property `:hover`
// leaves alone without ever borrowing a value from the *other* state.
const flatten = (css) => css.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ')

const declaration = (css, selectors, prop) => {
  const source = flatten(css)
  let winner = ''
  for (const selector of Array.isArray(selectors) ? selectors : [selectors]) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    let value = ''
    // The delimiter is matched by lookbehind, not consumed: two rules can sit back to back (`… }
    // .nav-menu a.active { …`), and eating the `}` would hide the rule that follows it.
    const lead = '(?:(?<=^)|(?<=[,{}]))'
    for (const rule of source.matchAll(new RegExp(lead + '\\s*' + escaped + '\\s*(?:,\\s*[^{}]+)?\\{([^}]*)\\}', 'g'))) {
      const found = rule[1].match(new RegExp('(?:^|;)\\s*' + prop + '\\s*:([^;]+)'))
      if (found) value = found[1].trim()
    }
    if (value) winner = value
  }
  return winner
}

const themeBlock = (regex) => {
  const tokens = {}
  for (const [, name, value] of (paletteCss.match(regex)?.[1] ?? '').matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g)) {
    tokens[name] = value.trim()
  }
  return tokens
}

const lightBase = themeBlock(/\n:root \{([^}]*)\}/)
const darkMedia = themeBlock(/prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme\]\) \{([^}]*)\}/)
const lightForced = themeBlock(/\[data-theme='light'\] \{([^}]*)\}/)
const darkForced = themeBlock(/\[data-theme='dark'\] \{([^}]*)\}/)

// The media block only restates the tokens it changes, so a dark measurement is the light baseline
// with the dark overrides layered on top — the same thing the browser computes.
const THEMES = {
  light: lightBase,
  dark: { ...lightBase, ...darkMedia }
}

/* --------------------------------- inline colours in the detail view --------------------------------- */

// The detail view paints a few strings with inline styles; each block is located by the marker
// text React renders next to it.
const inlineColor = (source, anchor) => {
  const at = source.indexOf(anchor)
  if (at === -1) return ''
  const found = [...source.slice(Math.max(0, at - 900), at).matchAll(/color:\s*'([^']+)'/g)]
  return found.length ? found[found.length - 1][1] : ''
}

const chipStyle = (anchor) => {
  const start = photosJs.indexOf(anchor)
  const end = photosJs.indexOf('style={{', start)
  const head = start === -1 || end === -1 ? '' : photosJs.slice(end)
  const block = head.slice(0, head.match(/\n\s*\}\}/)?.index ?? 900)
  return {
    block,
    color: block.match(/color:\s*'([^']+)'/)?.[1] ?? '',
    background: block.match(/background:\s*'([^']+)'/)?.[1] ?? '',
    opacity: /opacity:/.test(block)
  }
}

const textChips = chipStyle('textDetections.map')
const moderationChips = chipStyle('moderationLabels.map')
const pillHelper = photosJs.match(/const getConfidenceStyle = \(confidence\) => \(\{([\s\S]*?)\n\s*\}\)/)?.[1] ?? ''

/* ------------------------------------------- what is measured ------------------------------------------- */

const PAGE = 'var(--bg)'
const RAISED = 'var(--bg-raised)'
const CARD = 'var(--bg-card)'
// The sticky header is translucent over the page body, which is what it must be measured against.
const HEADER = { layer: 'var(--header-bg)', over: PAGE }

const AA_NORMAL = 4.5
const AA_LARGE = 3 // >=24px, or >=18.66px bold

/** Every pair of (text, surface) the app stylesheet actually paints with real text. */
const textPairs = () => ([
  // ---- global anchors: this one rule is the whole site-wide failure in the axe report ----
  { name: 'anchor on the page background', fg: declaration(paletteCss, 'a', 'color'), bg: PAGE },
  { name: 'anchor on a raised surface', fg: declaration(paletteCss, 'a', 'color'), bg: RAISED },
  { name: 'anchor on a card', fg: declaration(paletteCss, 'a', 'color'), bg: CARD },
  { name: 'anchor hover on the page background', fg: declaration(paletteCss, 'a:hover', 'color'), bg: PAGE },
  { name: 'anchor hover on a raised surface', fg: declaration(paletteCss, 'a:hover', 'color'), bg: RAISED },
  { name: 'anchor hover on a card', fg: declaration(paletteCss, 'a:hover', 'color'), bg: CARD },
  {
    name: 'selected text over the selection fill',
    fg: declaration(paletteCss, '::selection', 'color'),
    bg: { layer: declaration(paletteCss, '::selection', 'background'), over: PAGE }
  },

  // ---- buttons paint their own background, so both themes are measured against the same fill ----
  // Each state inherits the base colour for any property its own rule leaves alone, so the hover
  // pairs list the base selector first and the `:hover` rule second.
  {
    name: 'prev/next button label',
    fg: declaration(photosCss, '.button', 'color'),
    bg: declaration(photosCss, '.button', 'background')
  },
  {
    name: 'prev/next button label (hover)',
    fg: declaration(photosCss, ['.button', '.button:hover'], 'color'),
    bg: declaration(photosCss, '.button:hover', 'background')
  },
  {
    name: 'primary button label',
    fg: declaration(photosCss, '.btn-primary', 'color'),
    bg: declaration(photosCss, '.btn-primary', 'background')
  },
  {
    name: 'primary button label (hover)',
    fg: declaration(photosCss, ['.btn-primary', '.btn-primary:hover'], 'color'),
    bg: declaration(photosCss, '.btn-primary:hover', 'background')
  },

  // ---- detail view ----
  {
    name: 'recognition label pill',
    fg: declaration(photosCss, '.recognition-tags a', 'color'),
    bg: declaration(photosCss, '.recognition-tags a', 'background')
  },
  {
    name: 'recognition label pill (hover)',
    fg: declaration(photosCss, ['.recognition-tags a', '.recognition-tags a:hover'], 'color'),
    bg: declaration(photosCss, '.recognition-tags a:hover', 'background')
  },
  // Dormant rules: nothing in the app renders these classes today (the detail view paints its
  // recognised-text and moderation labels with inline styles instead). They are measured because a
  // rule that ships must not ship unreadable, and renaming or reviving one then cannot reintroduce
  // the failure. Not counted as proof about live text.
  { name: 'dormant .text-detection rule on a raised panel', fg: declaration(photosCss, '.text-detection', 'color'), bg: RAISED },
  { name: 'dormant .moderation-labels rule on a raised panel', fg: declaration(photosCss, '.moderation-labels', 'color'), bg: RAISED },
  { name: 'dormant .moderation-labels rule on a card', fg: declaration(photosCss, '.moderation-labels', 'color'), bg: CARD },
  { name: 'comment body on a raised panel', fg: declaration(photosCss, '.comment-text', 'color'), bg: RAISED },
  { name: 'search field text', fg: declaration(photosCss, '.form-control', 'color'), bg: RAISED },
  // Bootstrap colours the placeholder from --bs-secondary-color under [data-bs-theme=dark], which this
  // app never sets — without the app's own rule the search box's empty-state prompt is dark grey on a
  // near-black field. An empty string here means the rule is gone, and unmeasurable fails the contract.
  { name: 'search field placeholder', fg: declaration(photosCss, '.form-control::placeholder', 'color'), bg: RAISED },
  {
    name: 'recognised-text chip',
    fg: textChips.color,
    bg: { layer: textChips.background, over: RAISED }
  },
  {
    name: 'moderation chip',
    fg: moderationChips.color,
    bg: { layer: moderationChips.background, over: RAISED }
  },
  // Both headings are 18px at weight 700 — under the 18.66px bold bar, so they need full AA.
  { name: 'recognised-text heading', fg: inlineColor(photosJs, 'Recognized Text'), bg: RAISED },
  { name: 'content-moderation heading', fg: inlineColor(photosJs, 'Content Moderation'), bg: RAISED },

  // ---- header ----
  { name: 'nav link in the header', fg: declaration(headerCss, '.nav-menu a', 'color'), bg: HEADER },
  { name: 'nav link on a mobile card', fg: declaration(headerCss, '.nav-menu a', 'color'), bg: CARD },
  { name: 'hovered nav link', fg: declaration(headerCss, '.nav-menu a:hover', 'color'), bg: RAISED },
  { name: 'active nav link', fg: declaration(headerCss, '.nav-menu a.active', 'color'), bg: RAISED },
  { name: 'logo subtitle', fg: declaration(headerCss, '.logo-subtitle', 'color'), bg: HEADER },
  { name: 'theme picker label', fg: declaration(headerCss, '.theme-dropdown-select', 'color'), bg: RAISED },
  { name: 'theme picker caret', fg: declaration(headerCss, '.theme-dropdown::after', 'color'), bg: HEADER },
  // 1.5rem at weight 800 is large text; it still clears AA normal today.
  { name: 'wordmark', fg: declaration(headerCss, '.logo-title', 'color'), bg: HEADER, min: AA_LARGE },

  // ---- footer (its background is a card) ----
  { name: 'footer body copy', fg: declaration(footerCss, '.modern-footer', 'color'), bg: CARD },
  {
    name: 'footer link',
    fg: declaration(footerCss, ['.footer-section .link-group a', '.footer-links a'], 'color'),
    bg: CARD
  },
  {
    name: 'footer link (hover)',
    fg: declaration(footerCss, ['.footer-section .link-group a:hover', '.footer-links a:hover'], 'color'),
    bg: CARD
  },
  { name: 'footer hashtag', fg: declaration(footerCss, '.footer-section .hashtag', 'color'), bg: CARD },
  { name: 'footer copyright', fg: declaration(footerCss, '.footer-bottom .copyright', 'color'), bg: CARD },
  { name: 'footer promo copy', fg: declaration(footerCss, '.app-promotion p', 'color'), bg: CARD },
  { name: 'dormant .store-badge rule on a raised panel', fg: declaration(footerCss, '.store-badge', 'color'), bg: RAISED },
  { name: 'footer section heading', fg: declaration(footerCss, '.footer-section h4', 'color'), bg: CARD },
  // 1.5rem at weight 700 is large text; it still clears AA normal today.
  { name: 'footer promo heading', fg: declaration(footerCss, '.app-promotion h3', 'color'), bg: CARD, min: AA_LARGE },
  { name: 'footer wordmark', fg: declaration(footerCss, '.footer-bottom .brand-text', 'color'), bg: CARD }
])

const measure = (theme) => {
  const tokens = THEMES[theme]
  const failures = []
  for (const pair of textPairs()) {
    const min = pair.min ?? AA_NORMAL
    const fg = colorOf(pair.fg, tokens)
    const bg = colorOf(pair.bg, tokens)
    if (!fg || !bg) {
      // A colour this test cannot parse is a pair it cannot prove, which fails the contract.
      failures.push(`${pair.name}: unmeasurable (${JSON.stringify(pair.fg)} on ${JSON.stringify(pair.bg)})`)
      continue
    }
    const ratio = contrastRatio(fg, bg)
    if (ratio < min) {
      failures.push(`${pair.name}: ${ratio.toFixed(2)}:1 needs ${min}:1`)
    }
  }
  return failures
}

/* ----------------------------------------------- specs ----------------------------------------------- */

describe('WCAG contrast maths used by this contract', () => {
  it('reproduces the ratios the axe audit reported for the old palette', () => {
    const ratio = (a, b) => Number(contrastRatio(parseColor(a), parseColor(b)).toFixed(2))
    expect(ratio('#b0b8ff', '#f5f7fb')).toBe(1.76) // global anchor on the page background
    expect(ratio('#ffffff', '#7c8cf8')).toBe(3.02) // white on the old button fill
    expect(ratio('#6b7280', '#eef2f8')).toBe(4.3) // muted text on a card (footer links)
    expect(ratio('#f87171', '#eef2f8')).toBe(2.46) // moderation red on a card
    expect(ratio('#000000', '#ffffff')).toBe(21)
  })
})

describe('palette token contract', () => {
  const AA_TOKENS = ['--link', '--link-hover', '--btn-bg', '--btn-bg-hover', '--danger-text', '--wordmark']

  // --text-muted belongs in this list even though it predates the fix: THEMES.dark is
  // `{ ...lightBase, ...darkMedia }`, so a dark block that stops defining it silently re-measures the
  // light value instead of failing, and the muted step is what the footer links depend on.
  const PRESENT_IN_EVERY_BLOCK = [...AA_TOKENS, '--text-muted']

  it('defines every semantic text token in all four theme blocks', () => {
    for (const [block, tokens] of Object.entries({ ':root': lightBase, '@media dark': darkMedia, "[data-theme='light']": lightForced, "[data-theme='dark']": darkForced })) {
      expect(PRESENT_IN_EVERY_BLOCK.filter((token) => !(token in tokens)), block).toEqual([])
    }
  })

  it('keeps the forced-theme blocks in step with their media-query twins', () => {
    const mismatches = []
    for (const token of [...AA_TOKENS, '--text-muted']) {
      if (lightBase[token] !== lightForced[token]) mismatches.push(`${token} light`)
      if (darkMedia[token] !== darkForced[token]) mismatches.push(`${token} dark`)
    }
    expect(mismatches).toEqual([])
  })

  it('keeps the decorative brand tokens for fills, borders and glows', () => {
    for (const token of ['--accent', '--accent-light', '--mint']) {
      expect(lightBase[token], token).toBeTruthy()
    }
  })

  it('never paints text with a decorative accent token', () => {
    const offenders = []
    const sources = [[paletteCss, 'src/index.css'], [photosCss, 'PhotosComponent.css'], [headerCss, 'Header.css'], [footerCss, 'Footer.css'], [photosJs, 'PhotosComponent.js'], [appJs, 'App.js'], [aboutJs, 'About.js'], [noMatchJs, 'NoMatch.js']]
    for (const [source, label] of sources) {
      for (const found of source.matchAll(/(?:^|[\s;{])(?:color|text-fill-color):\s*['"]?var\(--(?:accent|accent-light|accent-dark|mint|mint-light)\)/g)) {
        offenders.push(`${label}: ${found[0].trim()}`)
      }
    }
    expect(offenders).toEqual([])
  })
})

describe('light theme text/surface pairs', () => {
  it('every pair reaches AA', () => {
    expect(measure('light')).toEqual([])
  })
})

describe('dark theme text/surface pairs', () => {
  it('every pair reaches AA, including the links that already passed', () => {
    expect(measure('dark')).toEqual([])
  })
})

describe('confidence-scaled text', () => {
  it('encodes confidence in size and weight only, so colour is measured at full strength', () => {
    expect(moderationChips.color).toContain('--danger-text')
    const alphaScaled = []
    if (moderationChips.opacity) alphaScaled.push('moderation chips')
    if (textChips.opacity) alphaScaled.push('recognised-text chips')
    if (/opacity/.test(pillHelper)) alphaScaled.push('recognition label pills')
    expect(alphaScaled).toEqual([])
    // The signal that replaces alpha has to stay in place, or low-confidence labels become
    // indistinguishable from high-confidence ones.
    for (const [block, label] of [[pillHelper, 'label pills'], [moderationChips.block, 'moderation chips'], [textChips.block, 'recognised-text chips']]) {
      for (const prop of ['fontSize', 'fontWeight']) expect(block, label).toContain(prop)
    }
  })
})

describe('search field placeholder', () => {
  it('is painted by the app stylesheet, with no alpha of its own to dilute it', () => {
    // Bootstrap's rule is scoped to [data-bs-theme=dark], which this app never sets, so without this
    // declaration the search box falls back to rgba(33,37,41,.75) in dark mode: 1.09:1.
    expect(declaration(photosCss, '.form-control::placeholder', 'color')).toContain('--text-muted')
    expect(declaration(photosCss, '.form-control::placeholder', 'opacity')).toBe('1')
  })
})

describe('wordmark is a solid, measurable colour', () => {
  it('drops the gradient clip from both wordmarks', () => {
    for (const [css, selector, label] of [[headerCss, '.logo-title', 'Header .logo-title'], [footerCss, '.footer-bottom .brand-text', 'Footer .brand-text']]) {
      expect(declaration(css, selector, 'color'), label).toContain('--wordmark')
      expect(declaration(css, selector, '-webkit-text-fill-color'), label).toBe('')
      expect(declaration(css, selector, 'background'), label).not.toContain('linear-gradient')
    }
  })
})

describe('route-level strings use the semantic tokens', () => {
  it('paints the app loading string, the about link and the 404 code with --link', () => {
    expect(appJs).toContain("color: 'var(--link)'")
    expect(aboutJs).toContain("color: 'var(--link)'")
    expect(noMatchJs).toContain("color: 'var(--link)'")
    for (const [source, label] of [[appJs, 'App.js'], [aboutJs, 'About.js'], [noMatchJs, 'NoMatch.js']]) {
      expect(source.includes('--accent-light'), label).toBe(false)
    }
  })
})

describe('paint before the application stylesheet lands', () => {
  // The app sheet is fetched async (src/build/vite-plugin-async-css.js), so for a moment the only
  // colours a visitor sees are index.html's critical block. It owns body text and nothing else: an
  // anchor keeps the UA default until the real palette arrives, which is what stops this fix from
  // becoming a flash of unreadable text on the edge-painted detail and static routes. Every block is
  // read, so a second critical-style block cannot dodge these guards.
  const criticalBlocks = [...read('../index.html').matchAll(/<style>([\s\S]*?)<\/style>/g)].map((found) => found[1])

  it('has a critical block to guard', () => {
    expect(criticalBlocks.length).toBeGreaterThan(0)
  })

  it('leaves every anchor to the user agent default', () => {
    // flatten() first: the block's prose mentions "a rule" and "a page", which would otherwise read
    // as bare `a` selectors.
    const offenders = criticalBlocks.flatMap((block) => [...flatten(block).matchAll(/([^{}]*)\{/g)])
      .map((found) => found[1].trim())
      .filter((selector) => /(^|[\s>+~])a(\s|$|,)/.test(selector))
    expect(offenders).toEqual([])
  })

  it('measures the body pair it does paint', () => {
    const critical = criticalBlocks.join('\n')
    const bodies = [
      ['light', flatten(critical).match(/(?:^|})\s*body\s*\{([^}]*)\}/)?.[1]],
      ['dark', flatten(critical).match(/prefers-color-scheme:\s*dark[^{]*\{\s*body\s*\{([^}]*)\}/)?.[1]]
    ]
    for (const [theme, block] of bodies) {
      // A missing rule is a lost first frame, not a pass.
      expect(block, `${theme} body rule in the critical block`).toBeTruthy()
      const fg = parseColor(block.match(/color:\s*([^;]+)/)?.[1])
      const bg = parseColor(block.match(/background:\s*([^;}]+)/)?.[1])
      expect(fg, theme).toBeTruthy()
      expect(bg, theme).toBeTruthy()
      expect(contrastRatio(fg, bg), theme).toBeGreaterThanOrEqual(AA_NORMAL)
    }
  })
})
