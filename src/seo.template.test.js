import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

// Regression guard for the 2026-11 indexing incident: a hardcoded
// <link rel="canonical" href="https://wisaw.com"> in the shared template made every
// photo/video URL declare itself a duplicate of the homepage in the HTML Googlebot
// fetches, so deep pages were dropped from the index. Per-page canonicals belong to
// Helmet (client) and to the Lambda@Edge injector (WiSaw.cdk), never to this template.
// Resolved from the repo root (where vitest runs); jsdom makes import.meta.url useless
// here. index.html is the Vite entry that ships; public/index.html is the legacy CRA
// template kept for parity — both must stay canonical-free.
const templates = ['index.html', 'public/index.html']

describe.each(templates)('%s SEO invariants', (template) => {
  const templateHtml = readFileSync(resolve(template), 'utf8')

  it('contains no static canonical link', () => {
    expect(templateHtml).not.toMatch(/<link[^>]*rel=['"]canonical['"]/i)
  })

  it('keeps a single <title> for Helmet and the edge injector to rewrite', () => {
    const titles = templateHtml.match(/<title>/gi) ?? []
    expect(titles).toHaveLength(1)
  })

  it('declares indexing-friendly robots meta', () => {
    expect(templateHtml).toMatch(/name="robots"[^>]*content="index, follow/)
  })

  it('keeps the root mount point the edge body renderer targets', () => {
    // WiSaw.cdk injectMetaTagsLambdaFunction replaces the contents of <div id="root">;
    // renaming it would silently stop crawler-visible content from rendering.
    expect(templateHtml).toMatch(/<div id="root">/)
  })

  it('gives the edge injector exactly one mount point to find', () => {
    // The injector locates the mount point by string search and replaces up to the first closing
    // div, so a second mention anywhere - even inside a comment - makes it swallow everything in
    // between. On 2026-11-10 a comment naming the mount point ate the entry script along with the
    // fallback content, and every photo page served a blank document.
    expect(templateHtml.match(/<div id="root">/g)).toHaveLength(1)

    for (const comment of templateHtml.match(/<!--[\s\S]*?-->/g) ?? []) {
      expect(comment).not.toMatch(/<\/?div/i)
    }
  })
})

// The shipped entry, not the legacy CRA copy: this is the file whose bundle has to survive an
// injection pass, because a swallowed entry script means React never mounts and the page is blank.
describe('index.html survives an edge injection pass', () => {
  const templateHtml = readFileSync(resolve('index.html'), 'utf8')

  it('keeps every script when the mount point is replaced', () => {
    const opened = templateHtml.indexOf('<div id="root">')
    const closed = templateHtml.indexOf('</div>', opened) + '</div>'.length
    const injected = `${templateHtml.slice(0, opened)}<div id="root"><h1>Injected by the edge</h1></div>${templateHtml.slice(closed)}`

    expect(injected.match(/<div id="root">/g)).toHaveLength(1)
    expect(injected).toMatch(/<script type="module"[^>]*\bsrc=/)
    for (const marker of ['guard', 'preload', 'swap']) {
      const attribute = marker === 'guard' ? 'data-wisaw-guard="reload"' : `data-wisaw-lcp="${marker}"`
      expect(injected).toContain(attribute)
    }
  })

  it('leaves the built document renderable after the same pass', () => {
    // The injector runs on what `vite build` produced, not on this source template: the entry
    // bundle and the application stylesheet are only in the output. Guards the deploy that happens
    // between this test and production, where a missing script is discovered by PageSpeed.
    const built = resolve('build/index.html')
    if (!existsSync(built)) { return }
    const html = readFileSync(built, 'utf8')

    const opened = html.indexOf('<div id="root">')
    const closed = html.indexOf('</div>', opened) + '</div>'.length
    const injected = `${html.slice(0, opened)}<div id="root"><h1>Injected by the edge</h1></div>${html.slice(closed)}`

    expect(injected).toMatch(/<script type="module"[^>]*\bsrc="\/assets\/index[^"]*\.js"/)
    expect(injected).toMatch(/<link rel="stylesheet"[^>]*href="\/assets\/index[^"]*\.css"/)
    expect(injected.match(/<div id="root">/g)).toHaveLength(1)
  })
})

// CloudFront now answers unknown URLs with this file and a real 404 (the distribution used to
// rewrite every miss to index.html with status 200, which read as near-duplicate content).
// It must stay standalone: a page that depends on the hashed bundle would break exactly when
// the bundle is the thing that went missing.
describe('public/404.html invariants', () => {
  const notFoundHtml = readFileSync(resolve('public/404.html'), 'utf8')

  it('is excluded from the index', () => {
    expect(notFoundHtml).toMatch(/name="robots"[^>]*content="noindex, follow/)
  })

  it('has no title that duplicates a live page', () => {
    const title = notFoundHtml.match(/<title>([^<]*)<\/title>/i)
    expect(title?.[1]).toMatch(/not found/i)
  })

  it('loads no application bundle', () => {
    expect(notFoundHtml).not.toMatch(/<script[^>]*\bsrc=/i)
  })

  it('links to crawlable pages instead of dead ends', () => {
    expect(notFoundHtml).toMatch(/href="\/"/)
    expect(notFoundHtml).toMatch(/href="\/about"/)
  })
})
