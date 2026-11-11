import { afterEach, describe, expect, it } from 'vitest'
import { resetServedHead, servedHead, servedHeadFor } from './servedHead'

// These tests seed the head the way Lambda@Edge does, then read it back before anything can
// rewrite it. The values are what the app re-declares for a media item that has no SEO record yet,
// so reading them wrong would put text on the page the crawler never saw.

function seedServedHead () {
  document.title = 'Golden retriever — photo, Brooklyn, Sep 2025 · WiSaw'
  const tags = [
    { name: 'description', property: undefined, content: 'Dog, Beach, Sunset. Free photos on WiSaw - unaltered, taken with a phone camera' },
    { name: undefined, property: 'og:image:title', content: 'Dog, Beach, Sunset' },
    { name: undefined, property: 'og:image:caption', content: 'At the shore again' }
  ]
  const added = tags.map((tag) => {
    const el = document.createElement('meta')
    if (tag.name != null) el.setAttribute('name', tag.name)
    if (tag.property != null) el.setAttribute('property', tag.property)
    el.setAttribute('content', tag.content)
    document.head.appendChild(el)
    return el
  })
  return () => {
    added.forEach((el) => el.remove())
    document.title = ''
  }
}

describe('servedHead', () => {
  afterEach(() => {
    resetServedHead(null)
  })

  it('reads the title, description and image pair the edge injected', () => {
    const cleanup = seedServedHead()
    resetServedHead(null)

    const head = servedHead()
    expect(head.title).toContain('Golden retriever')
    expect(head.description).toContain('Free photos on WiSaw')
    expect(head.imageTitle).toBe('Dog, Beach, Sunset')
    expect(head.imageCaption).toBe('At the shore again')

    cleanup()
  })

  it('only offers the snapshot for the URL it was taken on', () => {
    const cleanup = seedServedHead()
    resetServedHead(null)

    const here = servedHead().path ?? document.location.pathname
    expect(servedHeadFor(here)).not.toBeNull()
    // After a client-side navigation, repeating these bytes would put one media item's title on
    // another's page.
    expect(servedHeadFor('/photos/some-other-id')).toBeNull()

    cleanup()
  })

  it('captures once, so a later Helmet write cannot be mistaken for the first byte', () => {
    const cleanup = seedServedHead()
    resetServedHead(null)

    const before = servedHead()
    document.title = 'Rewritten by React'
    expect(servedHead().title).toBe(before.title)

    cleanup()
  })
})
