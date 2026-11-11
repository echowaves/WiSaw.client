/**
 * Full-resolution media on the photo/video detail page is multi-megabyte, while the `-thumb.webp`
 * variant of the same record is a few tens of kilobytes. Below the mobile breakpoint the thumb is
 * therefore what gets painted first, and the original is only *warmed* in the background: painting
 * it later would itself become the LCP candidate, because Largest Contentful Paint is finalised at
 * first user input and equal-sized candidates tie-break on the later paint time.
 *
 * The two gates this module serves live in PhotosComponent.js: `warm` may open once the document is
 * quiet, `paint` only once the visitor has interacted (or above the breakpoint).
 */

import { DETAIL_MOBILE_BREAKPOINT } from './detailLayout'

/** Quiet period after `window.load` before the background full-resolution pull starts. */
export const FULL_MEDIA_WARM_DELAY_MS = 4000

/** True when this viewport must not paint the full-resolution source during hydration. */
export const shouldDeferFullMedia = (screenOverride) => {
  if (typeof window === 'undefined' && screenOverride == null) {
    return false
  }

  const screenWidth = screenOverride ?? window.innerWidth
  return screenWidth < DETAIL_MOBILE_BREAKPOINT
}

/**
 * True when the visitor has already interacted with the document - including interactions that
 * happened before this route chunk existed. Those still freeze Largest Contentful Paint, so a page
 * that hydrates after a tap or a scroll is free to paint the sharp image straight away. Both signals
 * are read from the browser rather than tracked here: `navigator.userActivation` is a live record of
 * activation, and `first-input` performance entries are buffered from navigation start. When a
 * browser offers neither, this says no and the component keeps waiting for an interaction it can see.
 */
export const hasFirstInputHappened = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false
  }

  if (window.navigator?.userActivation?.hasBeenActive === true) {
    return true
  }

  try {
    return (performance.getEntriesByType('first-input') ?? []).length > 0
  } catch {
    return false
  }
}

/**
 * Runs `run` once the document has finished loading and `delayMs` of quiet have passed on top of
 * that. Returns a cancel function; cancelling before, during or after the wait is always safe.
 */
export const scheduleAfterWindowLoad = (delayMs, run) => {
  if (typeof window === 'undefined') {
    return () => { }
  }

  let timer = null
  let cancelled = false

  const arm = () => {
    if (cancelled) {
      return
    }
    timer = window.setTimeout(() => {
      timer = null
      if (!cancelled) {
        run()
      }
    }, delayMs)
  }

  if (document.readyState === 'complete') {
    arm()
  } else {
    window.addEventListener('load', arm, { once: true })
  }

  return () => {
    cancelled = true
    window.removeEventListener('load', arm)
    if (timer !== null) {
      window.clearTimeout(timer)
      timer = null
    }
  }
}
