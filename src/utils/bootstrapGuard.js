/**
 * Guards against a stale deployment leaving the app dead.
 *
 * Every build emits new hashed bundles under /assets/. If a visitor keeps an old
 * index.html (it is currently served with `cache-control: max-age=31536000`) or a
 * lazy route chunk disappears mid-session, the module script fails and React never
 * mounts — the visitor is left with the static fallback markup in #root.
 *
 * A reload re-requests the main resource while bypassing the HTTP cache, which is
 * enough to pick up the current index.html. The guard below makes sure we only pay
 * for that reload once per cooldown window.
 */

const RELOAD_GUARD_KEY = 'wisaw-reload-at'
const RELOAD_COOLDOWN_MS = 60000

const readLastReloadAt = () => {
  try {
    return Number(window.sessionStorage.getItem(RELOAD_GUARD_KEY)) || 0
  } catch {
    return 0
  }
}

const writeLastReloadAt = (now) => {
  try {
    window.sessionStorage.setItem(RELOAD_GUARD_KEY, String(now))
  } catch {
    // Private mode or blocked storage: fall back to an in-memory guard.
    window.__wisawLastReloadAt = now
  }
}

export const shouldHardReload = (now = Date.now()) => {
  const lastReloadAt = window.__wisawLastReloadAt ?? readLastReloadAt()
  return now - lastReloadAt >= RELOAD_COOLDOWN_MS
}

/**
 * Reloads once to escape a stale bundle, rate limited so a broken deploy can never
 * turn into a reload loop. Returns true when a reload was requested.
 */
export const hardReload = () => {
  if (!shouldHardReload()) {
    return false
  }

  writeLastReloadAt(Date.now())
  window.location.reload()
  return true
}

export const isChunkLoadError = (error) => {
  const message = typeof error?.message === 'string' ? error.message : String(error ?? '')
  return /dynamically imported module|module script failed|error loading dynamically|Failed to fetch|MIME type|Loading chunk \d+ failed/i.test(message)
}
