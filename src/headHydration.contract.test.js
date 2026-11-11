/* eslint-disable react/react-in-jsx-scope */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { act, render, screen } from '@testing-library/react'
import { HelmetProvider } from '@dr.pogodin/react-helmet'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ROBOTS_INDEX, SITE_NAME, TWITTER_CARD } from './utils/seoDefaults'

/**
 * The contract that made this bug: `@dr.pogodin/react-helmet` selects head nodes with the
 * selector `${type}[data-rh]`, so a tag without the marker can never be updated or removed by
 * the app, and a marked tag the app does not re-declare is deleted on mount. These tests seed
 * `document.head` with the document a crawler really receives - the shipped template head, and
 * that head after Lambda@Edge has stripped and re-injected its tags - then mount the real detail
 * page over it and require every SEO property to survive reconciliation exactly once.
 *
 * The edge fixture mirrors `stripExistingMetaTags` and the injection block in the backend's
 * `injectMetaTagsLambdaFunction/utils.js`; the backend suite `tests/inject-meta-tags.js` pins
 * that side, so a one-sided edit fails there first.
 */

const api = vi.hoisted(() => ({ response: null }))
vi.mock('./consts', () => ({
  gqlClient: {
    query: () => (api.response === null ? new Promise(() => {}) : Promise.resolve(api.response))
  }
}))
vi.mock('react-ga4', () => ({ default: { initialize: vi.fn(), send: vi.fn() } }))
vi.mock('./containers/Footer', () => ({ default: () => <footer>site footer</footer> }))

const HERE = path.dirname(fileURLToPath(import.meta.url))
const TEMPLATE_PATH = path.join(HERE, '..', 'index.html')
const EDGE_UTILS_PATH = path.join(HERE, '..', '..', 'WiSaw.cdk', 'lambda-fns', 'lambdas', 'injectMetaTagsLambdaFunction', 'utils.js')

const PHOTO_RECORD = {
  id: '777',
  title: 'Dog at the beach',
  description: 'A dog on the sand',
  imgUrl: 'https://img.wisaw.com/777-full.webp',
  thumbUrl: 'https://img.wisaw.com/777-thumb.webp',
  videoUrl: '',
  video: false,
  watchersCount: 10,
  lastComment: 'nice',
  createdAt: '2026-10-01T10:00:00.000Z',
  width: '1920',
  height: '1080'
}

/** What the edge strips before injecting, mirrored from `stripExistingMetaTags`. */
const EDGE_STRIPPED = [
  /<meta\s[^>]*property=["']og:(image|title|url|type|description)["'][^>]*\/?>\s*/gi,
  /<meta\s[^>]*property=["']og:image:(title|caption)["'][^>]*\/?>\s*/gi,
  /<meta\s[^>]*name=["']twitter:(card|title|image|description)["'][^>]*\/?>\s*/gi,
  /<meta\s(?=[^>]*\bname=["']description["'])[^>]*\/?>\s*/gi,
  /<meta\s(?=[^>]*\bproperty=["']og:description["'])[^>]*\/?>\s*/gi,
  /<meta\s(?=[^>]*\bproperty=["']og:site_name["'])[^>]*\/?>\s*/gi,
  /<meta\s(?=[^>]*\bname=["']robots["'])[^>]*\/?>\s*/gi
]

/** A photo page as Lambda@Edge serves it: one tag per property, all marked but og:locale. */
const EDGE_HEAD_TAGS = [
  '<meta name="description" property="og:description" content="A dog on the sand" data-rh="true">',
  `<meta name="robots" content="${ROBOTS_INDEX}" data-rh="true">`,
  `<meta property="og:image" content="${PHOTO_RECORD.thumbUrl}" data-rh="true">`,
  '<meta property="og:image:title" content="Dog, Pet" data-rh="true">',
  '<meta property="og:image:caption" content="On the sand" data-rh="true">',
  '<meta property="og:title" content="Dog at the beach | WiSaw" data-rh="true">',
  '<meta property="og:url" content="https://wisaw.com/photos/777" data-rh="true">',
  `<meta property="og:site_name" content="${SITE_NAME}" data-rh="true">`,
  '<meta property="og:type" content="photo" data-rh="true">',
  '<meta name="twitter:title" content="Dog at the beach | WiSaw" data-rh="true">',
  `<meta name="twitter:card" content="${TWITTER_CARD}" data-rh="true">`,
  `<meta name="twitter:image" content="${PHOTO_RECORD.thumbUrl}" data-rh="true">`,
  '<meta name="twitter:description" content="A dog on the sand" data-rh="true">'
].join('\n')

/** Head properties the edge injects for a media page; the app must re-declare every one. */
const EDGE_HEAD_PROPERTIES = [
  'meta[property=og:title]',
  'meta[property=og:description]',
  'meta[property=og:type]',
  'meta[property=og:image]',
  'meta[property=og:image:title]',
  'meta[property=og:image:caption]',
  'meta[property=og:url]',
  'meta[property=og:site_name]',
  'meta[name=robots]',
  'meta[name=twitter:card]',
  'meta[name=twitter:title]',
  'meta[name=twitter:description]',
  'meta[name=twitter:image]'
]

/** Meta names that carry SEO meaning; `viewport` and `theme-color` are nobody's conflict. */
const SEO_META_NAMES = ['robots', 'description', 'twitter:card', 'twitter:site', 'twitter:title',
  'twitter:description', 'twitter:image', 'twitter:image:alt']

function isGraph (node) {
  return node.tagName.toLowerCase() === 'script' && node.getAttribute('type') === 'application/ld+json'
}

function isSeoNode (node) {
  const tag = node.tagName.toLowerCase()
  if (tag === 'title') return true
  if (tag === 'meta') return node.hasAttribute('property') || SEO_META_NAMES.includes(node.getAttribute('name'))
  if (tag === 'link') return node.getAttribute('rel') === 'canonical'
  return tag === 'script' && node.getAttribute('type') === 'application/ld+json'
}

function identity (node) {
  const attrs = [...node.attributes]
    .filter(attr => attr.name === 'name' || attr.name === 'property')
    .map(attr => `${attr.name}=${attr.value}`)
    .sort()
    .join('&')
  return `${node.tagName.toLowerCase()}${attrs ? `[${attrs}]` : ''}`
}

/** True when a head node carries every attribute pair named by `meta[name=x]`-style selectors. */
function matches (node, selector) {
  const [, tag, rest] = /^([a-z]+)(.*)$/.exec(selector) ?? []
  if (!tag || node.tagName.toLowerCase() !== tag) return false
  for (const [, attr, value] of rest.matchAll(/\[([a-z]+)=([^\]]+)\]/g)) {
    if (node.getAttribute(attr) !== value) return false
  }
  return true
}

function valueOf (node) {
  if (node.tagName === 'TITLE') return node.textContent?.trim() ?? ''
  return node.getAttribute('content') ?? node.textContent?.trim() ?? ''
}

/** The head as shipped, or as the edge serves it. */
function templateHead ({ withEdgeTags = false } = {}) {
  const html = readFileSync(TEMPLATE_PATH, 'utf8')
  let head = /<head>([\s\S]*?)<\/head>/.exec(html)?.[1] ?? ''
  if (!head) throw new Error('no <head> block in index.html')
  if (!withEdgeTags) return head
  for (const pattern of EDGE_STRIPPED) head = head.replace(pattern, '')
  return head + '\n' + EDGE_HEAD_TAGS
}

/** Seeds the live document with a served page, then mounts the real detail page over it. */
async function hydrateDetail ({ route, photo, withEdgeTags }) {
  const doc = new DOMParser().parseFromString(`<html><head>${templateHead({ withEdgeTags })}</head><body><div id="root"></div></body></html>`, 'text/html')
  document.head.innerHTML = [...doc.head.children].map(node => node.outerHTML).join('\n')
  document.body.innerHTML = '<div id="root"></div>'

  const seededIdentities = [...document.head.children].filter(isSeoNode).map(identity)

  api.response = {
    data: {
      getPhotoAllCurr: { photo: { ...photo }, comments: [{ comment: 'On the sand' }], recognitions: [{ metaData: JSON.stringify({ Labels: [{ Name: 'Dog' }, { Name: 'Pet' }, { Name: 'Beach' }] }) }] }
    }
  }

  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[{ pathname: route, state: { feedPhoto: photo } }]}>
        <Routes>
          <Route path='/photos/:photoId' element={<DetailPage />} />
          <Route path='/videos/:photoId' element={<DetailPage />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>
  )
  await screen.findByText('site footer')
  // Helmet defers its head write to the next frame; snapshotting before that lands would
  // measure the page mid-reconciliation, which is not a state any crawler keeps.
  await act(async () => {
    await new Promise(resolve => requestAnimationFrame(() => resolve()))
  })

  const seo = [...document.head.children].filter(isSeoNode)
  return {
    seededIdentities,
    values: Object.fromEntries(seo.map(node => [identity(node), valueOf(node)])),
    // Counted over every head node rather than the identity-keyed snapshot: Helmet's own slot
    // key is a single attribute, so `name="image" property="og:image"` and a bare
    // `property="og:image"` share a slot here but would look like two identities above.
    count: (selector) => [...document.head.children].filter(node => matches(node, selector)).length,
    // Structured-data blocks are the one kind of node that legitimately repeats, so identity
    // collisions among them say nothing; their count is asserted directly.
    duplicates: seo.filter(node => !isGraph(node)).map(identity).filter((id, index, all) => all.indexOf(id) !== index),
    unmanaged: seo.filter(node => !node.hasAttribute('data-rh') && node.tagName !== 'TITLE').map(identity),
    graphsInBody: document.querySelectorAll('body script[type="application/ld+json"]').length,
    graphsInHead: document.head.querySelectorAll('script[type="application/ld+json"]').length
  }
}

const DetailPage = (await import('./containers/PhotosComponent')).default

beforeEach(() => {
  api.response = null
})

afterEach(() => {
  api.response = null
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

describe('head hydration contract', () => {
  it('ships every shared SEO tag marked for Helmet management', () => {
    const doc = new DOMParser().parseFromString(readFileSync(TEMPLATE_PATH, 'utf8'), 'text/html')
    const unmarked = [...doc.head.children]
      .filter(node => isSeoNode(node) && node.tagName !== 'TITLE' && !node.hasAttribute('data-rh'))
      .map(node => identity(node))

    // og:locale is the one exception by design: nothing re-declares it, so leaving it unmarked
    // keeps it out of Helmet's reach instead of making it a duplicate.
    expect(unmarked).toEqual(['meta[property=og:locale]'])
  })

  describe.each([
    ['static template', false],
    ['edge-served page', true]
  ])('hydrating the %s', (_name, withEdgeTags) => {
    it('leaves one node per SEO identity and nothing unmanaged', async () => {
      const result = await hydrateDetail({ route: '/photos/777', photo: PHOTO_RECORD, withEdgeTags })

      expect(result.seededIdentities.length).toBeGreaterThan(5)
      expect(result.duplicates).toEqual([])
      expect(result.unmanaged).toEqual(['meta[property=og:locale]'])
    })

    it('keeps every head property the edge injects alive through hydration', async () => {
      const result = await hydrateDetail({ route: '/photos/777', photo: PHOTO_RECORD, withEdgeTags: true })

      for (const selector of EDGE_HEAD_PROPERTIES) {
        expect(result.count(selector), `${selector} after hydration`).toBe(1)
      }
    })

    it('moves the media graph from inside #root into the head', async () => {
      // The edge's JSON-LD is part of the SSR body, so React discards it as hydration garbage;
      // Helmet must put its own copies back in the head: one media graph plus one breadcrumb.
      const result = await hydrateDetail({ route: '/photos/777', photo: PHOTO_RECORD, withEdgeTags })

      expect(result.graphsInBody).toBe(0)
      expect(result.graphsInHead).toBe(2)
    })

    it('leaves the unmanaged tag untouched', async () => {
      const result = await hydrateDetail({ route: '/photos/777', photo: PHOTO_RECORD, withEdgeTags })
      expect(result.values['meta[property=og:locale]']).toBe('en_US')
    })
  })

  it('publishes the video identity on the video route', async () => {
    const video = { ...PHOTO_RECORD, id: '778', video: true, videoUrl: 'https://cdn.wisaw.com/778.mov' }
    const result = await hydrateDetail({ route: '/videos/778', photo: video, withEdgeTags: true })

    expect(result.duplicates).toEqual([])
    expect(result.values['meta[property=og:type]']).toBe('video.other')
    expect(result.values['meta[property=og:url]']).toContain('/videos/778')
    expect(result.count('meta[property=og:video]')).toBe(1)
  })

  // Each repo holds its own copy of these strings; this is the only thing standing between a
  // silent edit on one side and Google seeing two different values for the same URL.
  describe.skipIf(!existsSync(EDGE_UTILS_PATH))('agrees with the edge injector', () => {
    const edge = readFileSync(EDGE_UTILS_PATH, 'utf8')

    it.each([
      ['robots policy', ROBOTS_INDEX],
      ['site name', SITE_NAME],
      ['twitter card', TWITTER_CARD]
    ])('shares the %s', (_label, value) => {
      expect(edge).toContain(`'${value}'`)
    })

    it('shares the thumbnail suffix used for social images', () => {
      expect(edge).toContain('-thumb.webp')
    })
  })
})
