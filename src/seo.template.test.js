import { readFileSync } from 'node:fs'
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
