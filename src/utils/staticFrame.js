/**
 * The handoff of index.html's own first frame.
 *
 * `index.html` paints the app's chrome, intro copy and a reserved feed area inside the mount point,
 * so the split second before this bundle runs shows a page rather than raw unstyled markup. That
 * frame has to go in the same paint as whatever replaces it — two headers or two h1s on screen at
 * once is exactly the flicker it exists to remove — so `src/index.js` only *marks* it here and
 * App.js clears it from a layout effect in the commit that renders Header plus route content.
 *
 * Both helpers live outside App.js because the fatal-error path needs them too: see
 * containers/AppErrorBoundary.js, which is the last thing that can still reach a frame no route will
 * ever replace.
 */

export const STATIC_FRAME_ATTRIBUTE = 'data-wisaw-static-frame'

/** The mount point while it still holds the static first frame; null once anything else owns it. */
export const getStaticFrameHost = () => {
  if (typeof document === 'undefined') {
    return null
  }
  const host = document.getElementById('root')
  return host && host.hasAttribute(STATIC_FRAME_ATTRIBUTE) ? host : null
}

/**
 * Hands the mount point back to React. Idempotent — safe to call from a layout effect, from its
 * cleanup, and from an error boundary in the same commit. Returns whether it cleared anything.
 */
export const releaseStaticFrame = () => {
  const host = getStaticFrameHost()
  if (!host) {
    return false
  }
  host.removeAttribute(STATIC_FRAME_ATTRIBUTE)
  host.textContent = ''
  return true
}
