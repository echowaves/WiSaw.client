import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import asyncCssPluginDefault, { asyncCssPlugin, makeStylesheetLinksAsync } from './vite-plugin-async-css'

// Stand-in for what `vite build` emits: one hashed application sheet, a modulepreload hint and the
// module entry. Only the stylesheet may change - the others carry their own semantics.
const BUILT_HTML = [
  '<!DOCTYPE html>',
  '<html lang="en">',
  '<head>',
  '  <meta charset="utf-8" />',
  '  <link rel="modulepreload" crossorigin href="/assets/vendor-Bb12Cd.js">',
  '  <link rel="stylesheet" crossorigin href="/assets/index-Aa98Zq.css">',
  '  <title>WiSaw</title>',
  '</head>',
  '<body><div id="root"></div></body>',
  '</html>'
].join('\n')

const SHEET = '<link rel="stylesheet" crossorigin href="/assets/index-Aa98Zq.css">'
const countMatches = (haystack, re) => (haystack.match(re) ?? []).length

describe('makeStylesheetLinksAsync', () => {
  it('makes the application stylesheet non-blocking and keeps a noscript copy', () => {
    const out = makeStylesheetLinksAsync(BUILT_HTML)

    expect(out).toContain(
      '<link rel="stylesheet" crossorigin href="/assets/index-Aa98Zq.css" media="print" onload="this.media=\'all\'">'
    )
    expect(out).toContain(`<noscript>${SHEET}</noscript>`)
    // One sheet, one copy - the blocking form is gone from head order.
    expect(countMatches(out, /rel="stylesheet"/g)).toBe(2)
    expect(countMatches(out, /media="print"/g)).toBe(1)
  })

  it('preloads the sheet at high priority so non-blocking does not mean slow', () => {
    const out = makeStylesheetLinksAsync(BUILT_HTML)
    // Must carry the source link's `crossorigin`: a no-cors preload never matches the CORS-mode
    // stylesheet request, and the sheet gets downloaded twice instead of once.
    const preload = '<link rel="preload" as="style" crossorigin href="/assets/index-Aa98Zq.css">'

    expect(out).toContain(preload)
    // The hint must sit next to (and before) the link it warms, still inside <head>.
    expect(out.indexOf(preload)).toBeLessThan(out.indexOf('media="print"'))
    expect(out.indexOf(preload)).toBeLessThan(out.indexOf('</head>'))
    expect(countMatches(out, /rel="preload" as="style"/g)).toBe(1)
  })

  it('mirrors the source link rather than inventing a crossorigin mode of its own', () => {
    const out = makeStylesheetLinksAsync(
      '<head><link rel="stylesheet" href="/assets/plain-Ee44Ff.css"></head>'
    )

    expect(out).toContain('<link rel="preload" as="style" href="/assets/plain-Ee44Ff.css">')
    expect(out).not.toMatch(/rel="preload"[^>]*crossorigin/)
  })

  it('is idempotent, so a second pass cannot double-async the sheet', () => {
    const once = makeStylesheetLinksAsync(BUILT_HTML)
    const twice = makeStylesheetLinksAsync(once)

    expect(twice).toBe(once)
    expect(countMatches(once, /media="print"/g)).toBe(1)
    expect(countMatches(once, /<noscript>/g)).toBe(1)
    expect(countMatches(once, /rel="preload" as="style"/g)).toBe(1)
  })

  it('leaves module scripts and preload hints alone', () => {
    const out = makeStylesheetLinksAsync(BUILT_HTML)

    expect(out).toContain('<link rel="modulepreload" crossorigin href="/assets/vendor-Bb12Cd.js">')
    expect(countMatches(out, /modulepreload[^>]*media=/g)).toBe(0)
  })

  it('only rewrites links inside <head>', () => {
    const html = BUILT_HTML.replace(
      '</body>',
      `<link rel="stylesheet" href="/late.css"></body>`
    )

    expect(makeStylesheetLinksAsync(html)).toContain('<link rel="stylesheet" href="/late.css">')
  })

  it('restores an existing media query instead of a blanket all', () => {
    const html = BUILT_HTML.replace(SHEET, '<link rel="stylesheet" media="(min-width: 600px)" href="/print-only.css">')
    const out = makeStylesheetLinksAsync(html)

    expect(out).toContain('media="print" onload="this.media=\'(min-width: 600px)\'"')
    expect(countMatches(out, /media="/g)).toBe(2) // print + the noscript copy original
  })

  it('keeps self-closing and single-quoted links well formed', () => {
    const html = BUILT_HTML.replace(SHEET, "<link rel='stylesheet' href='/assets/index.css' />")
    const out = makeStylesheetLinksAsync(html)

    expect(out).toContain('<link rel=\'stylesheet\' href=\'/assets/index.css\' media="print" onload="this.media=\'all\'" />')
  })

  it('ignores input with no head to work on', () => {
    expect(makeStylesheetLinksAsync('<html><body>hi</body></html>')).toBe('<html><body>hi</body></html>')
  })
})

describe('asyncCssPlugin', () => {
  it('runs after the bundle has injected its tags', () => {
    const plugin = asyncCssPlugin()

    expect(plugin.name).toBe('wisaw:async-css')
    expect(plugin.enforce).toBe('post')
    expect(plugin.transformIndexHtml.order).toBe('post')
    expect(plugin.transformIndexHtml.handler(BUILT_HTML)).toContain('media="print"')
  })

  it('is the same plugin as the default export', () => {
    expect(asyncCssPluginDefault).toBe(asyncCssPlugin)
  })

  it('is registered in vite.config.js', () => {
    const config = readFileSync(resolve('vite.config.js'), 'utf8')

    expect(config).toMatch(/from '\.\/src\/build\/vite-plugin-async-css'/)
    expect(config).toMatch(/asyncCssPlugin\(\)/)
  })
})
