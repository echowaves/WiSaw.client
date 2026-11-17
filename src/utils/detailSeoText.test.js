import { beforeEach, describe, expect, it, vi } from 'vitest'

import { __resetSeoTextForTests, fetchSeoText, getCachedSeoText, parseSidecar, prefetchSeoText, sidecarUrlFor } from './detailSeoText'

const ID = '29461ee8-34dd-4c2b-848f-c16d766713e8'

const response = (body, ok = true, status = ok ? 200 : 503) => ({ ok, status, json: () => Promise.resolve(body) })

const sidecar = {
  v: 1,
  caption: 'A heron at dawn',
  labels: ['Heron', 'Wetland'],
  created: '2026-10-01',
  location: 'Canton, Massachusetts',
  width: '4000',
  height: '3000',
  seo: {
    kind: 'photo',
    title: 'Heron at dawn — photo · WiSaw',
    description: 'A heron standing in shallow water at sunrise.',
    imageTitle: 'Heron at dawn',
    imageCaption: 'A heron at dawn'
  }
}

describe('detail wording sidecar reader', () => {
  beforeEach(() => {
    __resetSeoTextForTests()
    globalThis.fetch = vi.fn(() => Promise.resolve(response(sidecar)))
  })

  it('reads the published sidecar for the id', () => {
    expect(sidecarUrlFor(ID)).toBe(`https://img.wisaw.com/${ID}.json`)
  })

  it('names the same media origin the shell bootstrap preloads from', async () => {
    // Two files build URLs against this bucket; a one-sided host change means the app reads a
    // sidecar that no page ever references.
    const { readFileSync } = await import('node:fs')
    const { dirname, join } = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'index.html'), 'utf8')
    expect(html).toContain("var MEDIA_ORIGIN = 'https://img.wisaw.com/'")
  })

  it('maps the sidecar onto the template wording inputs', async () => {
    await expect(fetchSeoText(ID)).resolves.toEqual({
      title: 'Heron at dawn — photo · WiSaw',
      kind: 'photo',
      description: 'A heron standing in shallow water at sunrise.',
      imageTitle: 'Heron at dawn',
      imageCaption: 'A heron at dawn',
      labels: ['Heron', 'Wetland'],
      altText: 'A heron at dawn'
    })
  })

  it('caches per id and shares one in-flight read', async () => {
    const first = fetchSeoText(ID)
    const second = fetchSeoText(ID)
    await Promise.all([first, second])
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    expect(getCachedSeoText(ID)).not.toBeNull()
  })

  it('caches an absent sidecar as null instead of retrying on every render', async () => {
    // A 404 is the bucket answering: this photo has no published wording (yet).
    globalThis.fetch = vi.fn(() => Promise.resolve(response({}, false, 404)))
    await expect(fetchSeoText(ID)).resolves.toBeNull()
    await expect(fetchSeoText(ID)).resolves.toBeNull()
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('asks again when a read was never answered', async () => {
    // A throttled or server-side reply proves nothing about the photo, and caching it would leave
    // that page without its published wording for the rest of the session — prev, next, prev.
    globalThis.fetch = vi.fn(() => Promise.resolve(response({}, false, 503)))
    await expect(fetchSeoText(ID)).resolves.toBeNull()
    await expect(fetchSeoText(ID)).resolves.toBeNull()
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })

  it('survives a network failure and a missing fetch', async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('offline')))
    await expect(fetchSeoText(ID)).resolves.toBeNull()
    await expect(fetchSeoText(ID)).resolves.toBeNull()
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)

    __resetSeoTextForTests()
    delete globalThis.fetch
    await expect(fetchSeoText(ID)).resolves.toBeNull()
  })

  it('treats a sidecar with no title as no wording at all', () => {
    expect(parseSidecar({ seo: { description: 'orphan' } })).toBeNull()
    expect(parseSidecar(null)).toBeNull()
    expect(parseSidecar('not an object')).toBeNull()
  })

  it('falls back to the labels for alt text when there is no caption', () => {
    const parsed = parseSidecar({ labels: ['Heron'], seo: { title: 'T' } })
    expect(parsed.altText).toBe('Heron')
    expect(parsed.description).toBe('')
  })

  it('prefetches neighbours without rejecting on failure', async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('offline')))
    expect(() => prefetchSeoText([ID, null, undefined])).not.toThrow()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(globalThis.fetch).toHaveBeenCalledTimes(1) // one per distinct id, deduped by cache
  })

  it('ignores an empty id', async () => {
    await expect(fetchSeoText(null)).resolves.toBeNull()
    expect(getCachedSeoText(null)).toBeNull()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})
