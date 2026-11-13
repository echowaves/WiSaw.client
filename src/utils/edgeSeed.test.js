import { afterEach, describe, expect, it } from 'vitest'

import { edgeSeededPhoto } from './edgeSeed'

const plan = (overrides = {}) => ({
  kind: 'photos',
  id: 'abc-123',
  full: 'https://img.wisaw.com/abc-123.webp',
  thumb: 'https://img.wisaw.com/abc-123-thumb.webp',
  href: 'https://img.wisaw.com/abc-123-thumb.webp',
  useThumb: true,
  ...overrides
})

afterEach(() => {
  delete window.__wisawLcp
})

describe('edgeSeededPhoto', () => {
  it('builds a currPhoto-shaped record from a matching plan with dimensions', () => {
    window.__wisawLcp = plan({ width: '4000', height: '3000' })

    const seeded = edgeSeededPhoto('abc-123', 'photos')
    expect(seeded).toMatchObject({
      photo: {
        id: 'abc-123',
        thumbUrl: 'https://img.wisaw.com/abc-123-thumb.webp',
        imgUrl: 'https://img.wisaw.com/abc-123.webp',
        video: false,
        videoUrl: '',
        width: 4000,
        height: 3000
      },
      comments: [],
      recognitions: []
    })
  })

  it('seeds a video page with its object URL', () => {
    window.__wisawLcp = plan({ kind: 'videos', width: 1920, height: 1080, videoSrc: 'https://img.wisaw.com/abc-123.mp4' })

    const seeded = edgeSeededPhoto('abc-123', 'videos')
    expect(seeded.photo.video).toBe(true)
    expect(seeded.photo.videoUrl).toBe('https://img.wisaw.com/abc-123.mp4')
  })

  it.each([
    ['no plan at all'],
    ['a plan for another id', { id: 'other-id' }],
    ['a mismatched route kind', { kind: 'videos', videoSrc: 'https://img.wisaw.com/abc-123.mp4' }],
    ['missing width', { height: 3000 }],
    ['missing height', { width: 4000 }],
    ['non-numeric dimensions', { width: 'wide', height: 'tall' }],
    ['zero dimensions', { width: 0, height: 0 }]
  ])('returns null for %s', (_label, overrides) => {
    if (overrides !== undefined) {
      window.__wisawLcp = plan(overrides)
    }

    expect(edgeSeededPhoto('abc-123', 'photos')).toBeNull()
  })

  it('refuses a video plan without an object URL rather than seeding a broken player', () => {
    window.__wisawLcp = plan({ kind: 'videos', width: 1920, height: 1080 })

    expect(edgeSeededPhoto('abc-123', 'videos')).toBeNull()
  })

  it('tolerates a null id and still refuses to seed without a match', () => {
    window.__wisawLcp = plan({ width: 4000, height: 3000 })

    expect(edgeSeededPhoto(null, 'photos')).toBeNull()
  })
})
