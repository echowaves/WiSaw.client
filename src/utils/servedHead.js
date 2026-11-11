// What the server said about this page, read once before React touches the head.
//
// Lambda@Edge injects a complete head for every media URL, and Helmet removes any injected tag the
// app does not declare itself - so the app has to say something even when it has no SEO record for
// the media yet. Re-declaring what was served is the only option that cannot disagree with what the
// crawler already saw: the bytes are literally the ones the edge wrote.
//
// The snapshot is taken at import time, which is after the HTML is parsed and before the first
// render commits - the only moment these values still exist unmodified.

const readContent = function (selector) {
  const value = document.querySelector(selector)?.getAttribute('content')
  return typeof value === 'string' && value !== '' ? value : undefined
}

function readServedHead () {
  if (typeof document === 'undefined') return {}
  return {
    // The tags belong to the URL that was requested. After a client-side navigation they describe a
    // different page, so repeating them would put yesterday's title on today's media.
    path: document.location?.pathname || undefined,
    title: document.title || undefined,
    description: readContent('meta[name="description"]'),
    imageTitle: readContent('meta[property="og:image:title"]'),
    imageCaption: readContent('meta[property="og:image:caption"]')
  }
}

let snapshot = null

/** The first-byte head for this page, captured once per document. */
export function servedHead () {
  if (snapshot == null) snapshot = readServedHead()
  return snapshot
}

/**
 * The snapshot only for the URL it was taken on. On any other path this returns null, which sends
 * the caller to its next option instead of putting one media item's title on another's page.
 */
export function servedHeadFor (pathname) {
  const head = servedHead()
  if (head.path == null || pathname == null) return head
  return head.path === pathname ? head : null
}

/** Test hook: forget the snapshot so a fixture can seed its own head. */
export function resetServedHead (value = null) {
  snapshot = value
}
