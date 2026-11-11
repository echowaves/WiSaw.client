import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearSeoRecordCache, fetchSeoRecord, peekSeoRecord, recordUrl } from './seoRecord'

const ID = '3F1A2B3C-0000-4000-8000-000000000001'

function record (kind = 'photo') {
  return { v: 1, seo: { kind, title: 'Golden retriever - photo · WiSaw', description: 'Dog, Beach, Sunset', imageTitle: 'Dog, Beach', imageCaption: 'At the shore' } }
}

function respondWith (body, ok = true) {
  return vi.fn(() => Promise.resolve({ ok, json: () => Promise.resolve(body) }))
}

describe('seoRecord', () => {
  beforeEach(() => {
    clearSeoRecordCache()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('asks the media host for the record named by the id', () => {
    expect(recordUrl(ID)).toBe(`https://img.wisaw.com/${ID.toLowerCase()}.json`)
  })

  it('returns the record whose finished strings describe this kind of media', async () => {
    vi.stubGlobal('fetch', respondWith(record()))
    const got = await fetchSeoRecord(ID, 'photo')
    expect(got?.seo?.title).toBe('Golden retriever - photo · WiSaw')
  })

  it('treats a record of the other kind as absent', async () => {
    vi.stubGlobal('fetch', respondWith(record('video')))
    expect(await fetchSeoRecord(ID, 'photo')).toBeNull()
  })

  it('resolves to null instead of rejecting when there is nothing to read', async () => {
    for (const failure of [
      () => Promise.resolve({ ok: false, json: () => Promise.resolve({}) }), // 404
      () => Promise.reject(new Error('Failed to fetch')), // offline or blocked
      () => Promise.resolve({ ok: true, json: () => Promise.resolve('<html>the SPA shell</html>') }) // an error page served as JSON
    ]) {
      vi.stubGlobal('fetch', vi.fn(failure))
      clearSeoRecordCache()
      await expect(fetchSeoRecord(ID, 'photo')).resolves.toBeNull()
    }
  })

  it('reads a record once per id, and hands the cached copy to later views', async () => {
    const fetchMock = respondWith(record())
    vi.stubGlobal('fetch', fetchMock)

    await Promise.all([fetchSeoRecord(ID, 'photo'), fetchSeoRecord(ID, 'photo')])
    expect(fetchMock).toHaveBeenCalledTimes(1) // concurrent callers share one request

    expect(peekSeoRecord(ID, 'photo')?.seo?.title).toContain('Golden retriever')
    await fetchSeoRecord(ID, 'photo')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not ask again for a miss within the same session', async () => {
    const fetchMock = respondWith({}, false)
    vi.stubGlobal('fetch', fetchMock)

    await fetchSeoRecord(ID, 'photo')
    await fetchSeoRecord(ID, 'photo')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
