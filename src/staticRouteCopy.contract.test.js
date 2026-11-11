/* eslint-disable react/react-in-jsx-scope */
import { act, render } from '@testing-library/react'
import { HelmetProvider } from '@dr.pogodin/react-helmet'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LOCALE, ROBOTS_INDEX, ROBOTS_NOINDEX, SITE_NAME, STATIC_ROUTES, TWITTER_CARD, staticHead } from './utils/staticSeo.generated'

/**
 * Ticket 7 contract: the copy for the routes Lambda@Edge owns is written once, in the backend
 * route table, and reaches both readers of that table unchanged — the edge injects it into the
 * served HTML, the app re-declares it after hydration. These tests mount the app over a head the
 * edge has already filled with *different* values, so a page that renders its own hand-written
 * copy, forgets a tag, or leaves a stale one behind fails here instead of in a crawler's log.
 */

const api = vi.hoisted(() => ({ response: { data: { feedRecent: { photos: [], hasNextPage: false } } } }))
vi.mock('./consts', () => ({
  gqlClient: { query: () => Promise.resolve(api.response) },
  API_ENDPOINT: 'https://api.example.invalid/graphql',
  API_KEY: 'test-key'
}))
vi.mock('react-ga4', () => ({ default: { initialize: vi.fn(), send: vi.fn() } }))
vi.mock('./containers/Footer', () => ({ default: () => <footer>site footer</footer> }))
// The spinner pulls in styled-components, which has no head build in this test environment; the
// loader carries no SEO meaning.
vi.mock('react-loader-spinner', () => ({ Bars: () => null }))

const RouteSeo = (await import('./containers/RouteSeo')).default
const About = (await import('./containers/About')).default
const Contact = (await import('./containers/Contact')).default
const Terms = (await import('./containers/Terms')).default
const Home = (await import('./containers/Home')).default
const SearchComponent = (await import('./containers/SearchComponent')).default

/** A served head whose every value is deliberately wrong, all of it marked for Helmet. */
const STALE_HEAD = `
<title>Stale title</title>
<meta name="description" content="stale description" data-rh="true">
<link rel="canonical" href="https://wisaw.com/stale" data-rh="true">
<meta property="og:type" content="website" data-rh="true">
<meta property="og:url" content="https://wisaw.com/stale" data-rh="true">
<meta property="og:title" content="stale og title" data-rh="true">
<meta property="og:description" content="stale og description" data-rh="true">
<meta property="og:image" content="https://wisaw.com/stale.png" data-rh="true">
<meta property="og:site_name" content="Stale Name" data-rh="true">
<meta property="og:locale" content="fr_FR" data-rh="true">
<meta name="robots" content="noindex, follow" data-rh="true">
<meta name="twitter:card" content="summary" data-rh="true">
<meta name="twitter:title" content="stale og title" data-rh="true">
<meta name="twitter:description" content="stale description" data-rh="true">
<meta name="twitter:image" content="https://wisaw.com/stale.png" data-rh="true">
`

function count (selector) {
  return [...document.head.children].filter(node => matches(node, selector)).length
}

function value (selector) {
  const nodes = [...document.head.children].filter(node => matches(node, selector))
  if (nodes.length !== 1) return undefined
  const node = nodes[0]
  return node.getAttribute('content') ?? node.getAttribute('href') ?? node.textContent
}

function matches (node, selector) {
  const [, tag, rest] = /^([a-z]+)(.*)$/.exec(selector) ?? []
  if (!tag || node.tagName.toLowerCase() !== tag) return false
  for (const [, attr, value] of rest.matchAll(/\[([a-z]+)=([^\]]+)\]/g)) {
    if (node.getAttribute(attr) !== value) return false
  }
  return true
}

function identity (node) {
  const attrs = [...node.attributes]
    .filter(attr => attr.name === 'name' || attr.name === 'property')
    .map(attr => `${attr.name}=${attr.value}`)
    .sort()
    .join('&')
  return `${node.tagName.toLowerCase()}${attrs ? `[${attrs}]` : ''}`
}

function isSeoNode (node) {
  const tag = node.tagName.toLowerCase()
  if (tag === 'title' || tag === 'link') return tag === 'title' || node.getAttribute('rel') === 'canonical'
  if (tag === 'meta') return node.hasAttribute('property') || ['robots', 'description'].includes(node.getAttribute('name'))
  return false
}

/** Mounts `element` over the stale served head and waits for Helmet's write to land. */
async function hydrate (element, route = '/', path = '*') {
  document.head.innerHTML = STALE_HEAD
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[{ pathname: route }]}>
        <Routes>
          <Route path={path} element={element} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>
  )
  // Helmet defers the head write to the next animation frame.
  await act(async () => {
    await new Promise(resolve => requestAnimationFrame(() => resolve()))
  })

  const seo = [...document.head.children].filter(isSeoNode)
  return {
    title: document.title,
    count,
    value,
    duplicates: seo.map(identity).filter((id, index, all) => all.indexOf(id) !== index),
    unmanaged: seo.filter(node => !node.hasAttribute('data-rh') && node.tagName !== 'TITLE').map(identity)
  }
}

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

describe('static route copy comes from the shared table', () => {
  it.each(Object.keys(STATIC_ROUTES))('%s publishes the edge copy with one tag per property', async (pathname) => {
    const head = staticHead(pathname)
    const result = await hydrate(<RouteSeo pathname={pathname} />, pathname)

    expect(result.title).toBe(head.title)
    expect(result.value('meta[name=description]')).toBe(head.description)
    expect(result.value('meta[property=og:description]')).toBe(head.description)
    expect(result.value('link[rel=canonical]')).toBe(head.canonical)
    expect(result.value('meta[property=og:title]')).toBe(head.title)
    expect(result.value('meta[property=og:url]')).toBe(head.canonical)
    expect(result.value('meta[property=og:image]')).toBe(head.image)
    expect(result.value('meta[name=twitter:title]')).toBe(head.title)
    expect(result.value('meta[name=twitter:description]')).toBe(head.description)
    expect(result.value('meta[name=twitter:image]')).toBe(head.image)

    // Shared constants, so the app cannot publish a site name or locale the edge disagrees with.
    expect(result.value('meta[property=og:site_name]')).toBe(SITE_NAME)
    expect(result.value('meta[property=og:locale]')).toBe(LOCALE)
    expect(result.value('meta[name=twitter:card]')).toBe(TWITTER_CARD)
    expect(result.value('meta[name=robots]')).toBe(head.noindex ? ROBOTS_NOINDEX : ROBOTS_INDEX)

    expect(result.duplicates).toEqual([])
    expect(result.unmanaged).toEqual([])
  })

  it('names the searched term in the search head and keeps it out of the index', async () => {
    const result = await hydrate(<RouteSeo pathname='/search' term='new york' />, '/search/new%20york')

    expect(result.title).toBe('WiSaw: searching for new york')
    expect(result.value('link[rel=canonical]')).toBe('https://wisaw.com/search/new%20york')
    expect(result.value('meta[name=robots]')).toBe(ROBOTS_NOINDEX)
  })

  it('publishes nothing for a route the edge does not own', async () => {
    const result = await hydrate(<RouteSeo pathname='/photos/777' />, '/photos/777')

    expect(result.value('link[rel=canonical]')).toBe('https://wisaw.com/stale')
    expect(result.value('meta[property=og:site_name]')).toBe('Stale Name')
  })
})

describe('static pages render the shared head', () => {
  it.each([
    ['/', Home],
    ['/about', About],
    ['/contact', Contact],
    ['/terms', Terms]
  ])('%s keeps the copy and drops the stale tags', async (pathname, Page) => {
    const head = staticHead(pathname)
    const result = await hydrate(<Page />, pathname)

    expect(result.title).toBe(head.title)
    expect(result.value('link[rel=canonical]')).toBe(head.canonical)
    // The stale head says noindex; only a managed robots tag can flip it back.
    expect(result.value('meta[name=robots]')).toBe(ROBOTS_INDEX)
    expect(result.count('meta[property=og:site_name]')).toBe(1)
    expect(result.count('meta[property=og:locale]')).toBe(1)
    expect(result.duplicates).toEqual([])
  })

  it('/search/:term publishes the term and stays out of the index', async () => {
    // react-router hands the page the decoded term, so this also pins that the canonical is
    // re-encoded before it reaches a crawler.
    const result = await hydrate(<SearchComponent />, '/search/new%20york', '/search/:searchString')

    expect(result.title).toBe('WiSaw: searching for new york')
    expect(result.value('meta[name=description]')).toBe('WiSaw: searching for new york')
    expect(result.value('link[rel=canonical]')).toBe('https://wisaw.com/search/new%20york')
    expect(result.value('meta[name=robots]')).toBe(ROBOTS_NOINDEX)
    expect(result.duplicates).toEqual([])
  })
})
