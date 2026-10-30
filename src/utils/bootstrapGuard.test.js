import { describe, expect, it, vi, beforeEach } from 'vitest'
import { hardReload, isChunkLoadError, shouldHardReload } from './bootstrapGuard'
import { withChunkRecovery } from './lazyWithRetry'

describe('bootstrapGuard', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    delete window.__wisawLastReloadAt
  })

  it('allows a reload when none happened recently', () => {
    expect(shouldHardReload()).toBe(true)
  })

  it('blocks a second reload inside the cooldown window', () => {
    const reloadSpy = vi.fn()
    vi.stubGlobal('location', { reload: reloadSpy })

    expect(hardReload()).toBe(true)
    expect(reloadSpy).toHaveBeenCalledTimes(1)
    expect(hardReload()).toBe(false)
    expect(reloadSpy).toHaveBeenCalledTimes(1)

    vi.unstubAllGlobals()
  })

  it('recognises stale bundle failures', () => {
    expect(isChunkLoadError(new Error('Failed to fetch dynamically imported module: /assets/Home-abc.js'))).toBe(true)
    expect(isChunkLoadError(new Error('Loading chunk 12 failed'))).toBe(true)
    expect(isChunkLoadError(new Error('boom'))).toBe(false)
  })
})

describe('withChunkRecovery', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    delete window.__wisawLastReloadAt
  })

  it('requests a reload when a chunk cannot be fetched, and still rejects', async () => {
    const reloadSpy = vi.fn()
    vi.stubGlobal('location', { reload: reloadSpy })

    const chunkError = new Error('Failed to fetch dynamically imported module')
    await expect(withChunkRecovery(() => Promise.reject(chunkError))).rejects.toBe(chunkError)
    expect(reloadSpy).toHaveBeenCalledTimes(1)

    vi.unstubAllGlobals()
  })

  it('leaves unrelated import errors alone', async () => {
    const reloadSpy = vi.fn()
    vi.stubGlobal('location', { reload: reloadSpy })

    const otherError = new Error('boom')
    await expect(withChunkRecovery(() => Promise.reject(otherError))).rejects.toBe(otherError)
    expect(reloadSpy).not.toHaveBeenCalled()

    vi.unstubAllGlobals()
  })

  it('passes successful imports straight through', async () => {
    const module = { default: () => null }
    await expect(withChunkRecovery(() => Promise.resolve(module))).resolves.toBe(module)
  })
})
