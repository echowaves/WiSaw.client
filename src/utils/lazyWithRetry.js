import { lazy } from 'react'
import { hardReload, isChunkLoadError } from './bootstrapGuard'

/**
 * Reloads once when a lazily imported chunk can no longer be fetched - the usual cause is a
 * new deployment removing the old hashed files - then rethrows so the error boundary renders.
 */
export const withChunkRecovery = (importModule) => importModule().catch((error) => {
  if (isChunkLoadError(error)) {
    hardReload()
  }

  throw error
})

/** Drop-in replacement for React.lazy that recovers from a stale-deploy chunk error. */
export const lazyWithRetry = (importModule) => lazy(() => withChunkRecovery(importModule))
