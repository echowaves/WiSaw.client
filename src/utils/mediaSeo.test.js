import { describe, it, expect } from 'vitest'
import { breadcrumbGraph, mediaGraph, mediaHead, pageUrl, unenrichedText } from './mediaSeo'
import { ROBOTS_INDEX, SITE_NAME, TWITTER_CARD } from './seoDefaults'

const PHOTO = {
  id: '3f1a2b3c-0000-4000-8000-000000000001',
  video: false,
  thumbUrl: 'https://img.wisaw.com/3f1a2b3c-thumb.webp',
  imgUrl: 'https://img.wisaw.com/3f1a2b3c.webp',
  createdAt: '2026-04-01T10:00:00.000Z',
  width: '1200',
  height: '1600',
  watchersCount: '42'
}

const VIDEO = {
  ...PHOTO,
  id: '3f1a2b3c-0000-4000-8000-000000000002',
  video: true,
  videoUrl: 'https://img.wisaw.com/3f1a2b3c.mov'
}

const TITLE = 'Dog, Pet, Beach'
const DESCRIPTION = 'A golden retriever on the sand'

// What img.wisaw.com/<id>.json carries: the finished strings, composed once by the backend rules.
const RECORD = {
  v: 1,
  seo: { kind: 'photo', title: TITLE, description: DESCRIPTION, imageTitle: 'Dog, Pet, Beach', imageCaption: 'On the sand at dusk' }
}
const VIDEO_RECORD = { ...RECORD, seo: { ...RECORD.seo, kind: 'video' } }

describe('mediaHead', () => {
  it('renders the record\'s title verbatim, and keeps the id out of it', () => {
    const head = mediaHead(PHOTO, { record: RECORD })
    expect(head.title).toBe(TITLE)
    expect(head.ogTitle).toBe(TITLE)
    expect(head.description).toBe(DESCRIPTION)
    expect(head.ogTitle).not.toContain(PHOTO.id)
  })

  it('uses the same string for <title>, og:title and twitter:title', () => {
    // One source, three slots: this is the equality a crawler checks when it renders the page.
    const head = mediaHead(VIDEO, { record: VIDEO_RECORD })
    expect(head.ogTitle).toBe(head.title)
    expect(head.textSource).toBe('record')
  })

  it('uses one Open Graph type pair, photos distinct from videos', () => {
    expect(mediaHead(PHOTO, {}).ogType).toBe('photo')
    expect(mediaHead(VIDEO, {}).ogType).toBe('video.other')
  })

  it('publishes the thumbnail as the preview image for both kinds', () => {
    expect(mediaHead(PHOTO, {}).imageUrl).toBe(PHOTO.thumbUrl)
    expect(mediaHead(VIDEO, {}).imageUrl).toBe(VIDEO.thumbUrl)
  })

  it('uses one twitter card value and no player companions', () => {
    const head = mediaHead(VIDEO, {})
    expect(head.twitterCard).toBe(TWITTER_CARD)
    expect(head.player).toBeUndefined()
  })

  it('carries exactly the site name and robots directive the edge sends', () => {
    const head = mediaHead(PHOTO, {})
    expect(head.siteName).toBe(SITE_NAME)
    expect(head.robots).toBe(ROBOTS_INDEX)
  })

  it('takes the canonical path from the route that was asked for', () => {
    // /photos/<id> and /videos/<id> both render this page, and the edge derives its canonical
    // from the request URI. Deriving ours from the record let one video publish two URLs that
    // each declared the other to be the original.
    expect(mediaHead(VIDEO, { pathname: '/videos/' + VIDEO.id }).url).toContain('/videos/')
    expect(mediaHead(VIDEO, { pathname: '/photos/' + VIDEO.id }).url).toContain('/photos/')
    expect(mediaHead(PHOTO, {}).url).toBe(pageUrl(PHOTO))
  })

  it('carries the image title and caption as separate facts', () => {
    // The edge publishes this pair with data-rh, so anything the app does not declare itself is
    // removed as soon as React mounts - taking Google's image rich-result inputs with it. They come
    // from the record rather than being re-derived here, so neither slot can drift from the crawler's
    // copy of the page.
    const head = mediaHead(PHOTO, { record: RECORD })
    expect(head.imageTitle).toBe('Dog, Pet, Beach')
    expect(head.imageCaption).toBe('On the sand at dusk')
  })

  it('ignores a record that describes the other kind of media', () => {
    // A photo's title on a /videos/ URL would be a fabricated fact about the page.
    const head = mediaHead(VIDEO, { record: RECORD })
    expect(head.textSource).toBe('fallback')
    expect(head.title).not.toBe(TITLE)
  })

  it('prefers the record, then what this URL was served, and only then its own short label', () => {
    const served = { title: 'Served title · WiSaw', description: 'served description' }

    expect(mediaHead(PHOTO, { record: RECORD, served }).title).toBe(TITLE)
    expect(mediaHead(PHOTO, { served }).textSource).toBe('served')
    expect(mediaHead(PHOTO, {}).textSource).toBe('fallback')
    // Repeating the served bytes is what makes an un-enriched page identical to its first byte.
    expect(mediaHead(PHOTO, { served }).description).toBe('served description')
  })

  it('the last-resort label names the media without inventing a sentence', () => {
    const text = unenrichedText(PHOTO, { labels: 'Dog, Pet', comment: 'Dog, Pet' })
    expect(text.title).toContain('Dog, Pet')
    // An echo of the title under another name tells a crawler nothing, so the caption drops.
    expect(text.imageCaption).toBeUndefined()
    expect(mediaHead({}, {}).imageUrl).toBeUndefined()
  })
})

describe('mediaGraph', () => {
  it('describes a photo as a Photograph and a video as a VideoObject', () => {
    expect(mediaGraph(PHOTO, { title: TITLE })['@type']).toBe('Photograph')
    expect(mediaGraph(VIDEO, { title: TITLE })['@type']).toBe('VideoObject')
  })

  it('invents no duration and no capture date', () => {
    const graph = mediaGraph({ ...VIDEO, createdAt: undefined }, { title: TITLE })
    expect(graph.duration).toBeUndefined()
    expect(graph.uploadDate).toBeUndefined()
    expect(graph.releaseDate).toBeUndefined()
  })

  it('omits dimensions it does not have instead of guessing them', () => {
    const graph = mediaGraph({ ...PHOTO, width: '', height: null }, { title: TITLE })
    expect(graph.width).toBeUndefined()
    expect(graph.height).toBeUndefined()
    expect(mediaGraph(PHOTO, { title: TITLE }).width).toBe(1200)
  })

  it('names the same preview image the head does', () => {
    expect(mediaGraph(PHOTO, { title: TITLE }).thumbnailUrl).toBe(mediaHead(PHOTO, {}).imageUrl)
  })
})

describe('breadcrumbGraph', () => {
  it('gives every item but the last a target, and no target at the site root twice', () => {
    const items = breadcrumbGraph(PHOTO, { title: TITLE }).itemListElement
    expect(items).to.have.lengthOf(2)
    expect(items[0].item).toBe('https://wisaw.com/')
    expect(items[1].item).toBe(pageUrl(PHOTO))
  })
})

describe('the length a video page states', () => {
  it('takes the seconds from the record, because that is what the first byte said', () => {
    const record = { ...VIDEO_RECORD, seo: { ...VIDEO_RECORD.seo, duration: 48 } }
    expect(mediaHead({ ...VIDEO, duration: 90 }, { record }).video.duration).toBe(48)
  })

  it('falls back to the API column when no record has described this video', () => {
    // The GraphQL row now carries the same measurement; a video whose record is not written yet
    // still gets a real length rather than none.
    expect(mediaHead({ ...VIDEO, duration: 90 }, {}).video.duration).toBe(90)
  })

  it('says nothing when nobody has measured the file', () => {
    expect(mediaHead(VIDEO, {}).video.duration).toBeUndefined()
    expect(mediaGraph(VIDEO, { title: TITLE }).duration).toBeUndefined()
  })

  it('states the same measurement in seconds for Open Graph and ISO 8601 for the graph', () => {
    const photo = { ...VIDEO, duration: 3725 }
    expect(mediaHead(photo, {}).video.duration).toBe(3725)
    expect(mediaGraph(photo, { title: TITLE }).duration).toBe('PT1H2M5S')
  })

  it('normalises a length stored in another shape instead of publishing the raw text', () => {
    // parseInt on "1:02:03" would publish 1 second, which is a wrong fact, not a missing one.
    const record = { ...VIDEO_RECORD, seo: { ...VIDEO_RECORD.seo, duration: '1:02:03' } }
    expect(mediaHead(VIDEO, { record }).video.duration).toBe(3723)
    expect(mediaGraph({ ...VIDEO, duration: 'PT2M5S' }, { title: TITLE }).duration).toBe('PT2M5S')
  })

  it('keeps a photo page out of the conversation', () => {
    expect(mediaHead({ ...PHOTO, duration: 48 }, {}).video).toBeUndefined()
    expect(mediaGraph(PHOTO, { title: TITLE }).duration).toBeUndefined()
  })
})
