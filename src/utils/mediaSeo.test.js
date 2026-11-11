import { describe, it, expect } from 'vitest'
import { breadcrumbGraph, mediaGraph, mediaHead, pageUrl } from './mediaSeo'
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

describe('mediaHead', () => {
  it('keeps the id out of every title a person reads', () => {
    const head = mediaHead(PHOTO, { title: TITLE, description: DESCRIPTION })
    expect(head.ogTitle).toBe(TITLE)
    expect(head.ogTitle).not.toContain(PHOTO.id)
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
    // removed as soon as React mounts - taking Google's image rich-result inputs with it.
    const head = mediaHead(PHOTO, { labels: 'Dog, Pet, Beach', comment: 'On the sand at dusk' })
    expect(head.imageTitle).toBe('Dog, Pet, Beach')
    expect(head.imageCaption).toBe('On the sand at dusk')
  })

  it('drops a caption that only repeats the title, and empty values entirely', () => {
    const echo = mediaHead(PHOTO, { labels: 'Dog, Pet', comment: 'Dog, Pet' })
    expect(echo.imageCaption).toBeUndefined()
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
