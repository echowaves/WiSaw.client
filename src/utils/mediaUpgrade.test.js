import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DETAIL_MOBILE_BREAKPOINT } from './detailLayout'
import {
  FULL_MEDIA_WARM_DELAY_MS,
  hasFirstInputHappened,
  scheduleAfterWindowLoad,
  shouldDeferFullMedia
} from './mediaUpgrade'

describe('shouldDeferFullMedia', () => {
  it('defers below the detail breakpoint', () => {
    expect(shouldDeferFullMedia(DETAIL_MOBILE_BREAKPOINT - 1)).toBe(true)
    expect(shouldDeferFullMedia(390)).toBe(true)
  })

  it('does not defer at or above the breakpoint, where nothing smaller exists', () => {
    expect(shouldDeferFullMedia(DETAIL_MOBILE_BREAKPOINT)).toBe(false)
    expect(shouldDeferFullMedia(1280)).toBe(false)
  })

  it('falls back to window.innerWidth when no override is given', () => {
    const original = window.innerWidth
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 320 })
    try {
      expect(shouldDeferFullMedia()).toBe(true)
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: original })
    }
  })

  it('ships the agreed quiet period', () => {
    expect(FULL_MEDIA_WARM_DELAY_MS).toBe(4000)
  })
})

describe('scheduleAfterWindowLoad', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('waits out the delay when the document is already complete', () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete')
    const run = vi.fn()

    scheduleAfterWindowLoad(FULL_MEDIA_WARM_DELAY_MS, run)

    vi.advanceTimersByTime(FULL_MEDIA_WARM_DELAY_MS - 1)
    expect(run).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('starts the delay only once the load event arrives', () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading')
    const run = vi.fn()

    scheduleAfterWindowLoad(FULL_MEDIA_WARM_DELAY_MS, run)

    vi.advanceTimersByTime(FULL_MEDIA_WARM_DELAY_MS * 2)
    expect(run).not.toHaveBeenCalled()

    window.dispatchEvent(new Event('load'))
    vi.advanceTimersByTime(FULL_MEDIA_WARM_DELAY_MS)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('cancels a pending warm', () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete')
    const run = vi.fn()

    scheduleAfterWindowLoad(FULL_MEDIA_WARM_DELAY_MS, run)()

    vi.advanceTimersByTime(FULL_MEDIA_WARM_DELAY_MS * 2)
    expect(run).not.toHaveBeenCalled()
  })

  it('cancels a warm that was waiting for the load event', () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading')
    const run = vi.fn()

    scheduleAfterWindowLoad(FULL_MEDIA_WARM_DELAY_MS, run)()

    window.dispatchEvent(new Event('load'))
    vi.advanceTimersByTime(FULL_MEDIA_WARM_DELAY_MS)
    expect(run).not.toHaveBeenCalled()
  })

  it('runs the warm exactly once', () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete')
    const run = vi.fn()

    scheduleAfterWindowLoad(10, run)
    window.dispatchEvent(new Event('load'))
    vi.advanceTimersByTime(50)

    expect(run).toHaveBeenCalledTimes(1)
  })
})

describe('hasFirstInputHappened', () => {
  const setUserActivation = (value) => {
    Object.defineProperty(window.navigator, 'userActivation', { configurable: true, value })
  }

  afterEach(() => {
    setUserActivation(undefined)
    vi.restoreAllMocks()
  })

  it('says no while the browser reports no interaction', () => {
    setUserActivation({ hasBeenActive: false })
    vi.spyOn(performance, 'getEntriesByType').mockReturnValue([])

    expect(hasFirstInputHappened()).toBe(false)
  })

  it('says yes once the document has been activated, however long ago', () => {
    setUserActivation({ hasBeenActive: true })
    vi.spyOn(performance, 'getEntriesByType').mockReturnValue([])

    expect(hasFirstInputHappened()).toBe(true)
  })

  it('falls back to the buffered first-input entry on browsers without userActivation', () => {
    setUserActivation(undefined)
    vi.spyOn(performance, 'getEntriesByType').mockReturnValue([{ name: 'pointerdown' }])

    expect(hasFirstInputHappened()).toBe(true)
  })

  it('says no when a browser offers neither signal', () => {
    setUserActivation(undefined)
    vi.spyOn(performance, 'getEntriesByType').mockImplementation(() => {
      throw new TypeError('not supported')
    })

    expect(hasFirstInputHappened()).toBe(false)
  })
})
