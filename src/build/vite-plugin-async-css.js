/**
 * Build-time only: stop the application stylesheet from blocking first paint.
 *
 * Vite emits `<link rel="stylesheet" href="/assets/index-*.css">` into the head, and a stylesheet
 * in the head is render-blocking - the browser will not paint the LCP image the edge injector put
 * into #root until ~32 KB gz of CSS has arrived. This applies the standard async-CSS trick:
 * `media="print"` makes the sheet non-blocking, and the inline `onload` promotes it to `all` as
 * soon as it lands, and a matching `rel=preload as=style` hint stops that demotion from delaying
 * the download itself. A `<noscript>` copy keeps the sheet working with JavaScript disabled.
 *
 * Only links inside <head> are touched, and only stylesheet ones - module scripts and
 * modulepreload hints keep their behaviour. The pure helper is exported so the transform (and its
 * idempotence) can be unit-tested without running a build.
 */

// Either a <noscript> block (skipped whole, so the copies we add are never re-processed) or a
// <link> tag. One alternation means one pass and no risk of rewriting inside the noscript copy.
const SCAN = /<noscript\b[\s\S]*?<\/noscript>|<link\b[^>]*>/gi
const REL_STYLESHEET = /\brel\s*=\s*["']?stylesheet["']?/i
const ALREADY_ASYNC = /\bmedia\s*=\s*["']print["']/i
const MEDIA_ATTR = /\bmedia\s*=\s*(["'])([^"']*)\1/i
const CROSSORIGIN_ATTR = /\bcrossorigin\b/i
const HREF_ATTR = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i

/** The URL a link points at, in whichever quoting style the tag happened to use. */
const hrefOf = (tag) => {
  const match = tag.match(HREF_ATTR)
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? ''
}

/**
 * Rewrites one stylesheet link into the preload + print/onload=all form and appends its noscript copy.
 *
 * The `rel=preload as=style` hint is not decoration: `media="print"` also demotes the request to
 * Low priority, so on a slow connection the sheet can land after React has already painted - which
 * restyles live content and turns an LCP win into a Cumulative Layout Shift loss. Preloading keeps
 * the fetch at High priority while the link itself stays non-render-blocking.
 */
const asyncify = (tag) => {
  // Respect an existing media query by restoring that instead of a blanket `all`.
  const media = tag.match(MEDIA_ATTR)?.[2] ?? 'all'
  const selfClosing = /\s*\/\s*>$/.test(tag)
  const body = tag
    .slice(0, -1)
    .replace(/\s*\/$/, '')
    .replace(MEDIA_ATTR, '')

  // The hint has to request the sheet in the same mode as the link that consumes it. Vite emits
  // its asset links with `crossorigin`, and a crossorigin-less preload is fetched no-cors, so the
  // browser keeps two cache entries and downloads the sheet twice.
  const href = hrefOf(tag)
  const crossorigin = CROSSORIGIN_ATTR.test(tag) ? ' crossorigin' : ''
  const preload = href ? `<link rel="preload" as="style"${crossorigin} href="${href}">` : ''

  return `${preload}${body} media="print" onload="this.media='${media}'"${selfClosing ? ' /' : ''}>` +
    `<noscript>${tag}</noscript>`
}

/**
 * Makes every stylesheet link in <head> non-render-blocking. Safe to call more than once: links
 * already carrying `media="print"` are left alone, so a second pass returns the same string.
 */
export const makeStylesheetLinksAsync = (html) => {
  if (typeof html !== 'string' || html.length === 0) { return html }

  const headEnd = html.search(/<\/head>/i)
  if (headEnd === -1) { return html }

  const head = html.slice(0, headEnd)
  const transformedHead = head.replace(SCAN, (match) => {
    if (/^<noscript/i.test(match)) { return match }
    if (!REL_STYLESHEET.test(match) || ALREADY_ASYNC.test(match)) { return match }
    return asyncify(match)
  })

  return transformedHead + html.slice(headEnd)
}

/** Vite plugin: applies {@link makeStylesheetLinksAsync} to the emitted index.html. */
export const asyncCssPlugin = () => ({
  name: 'wisaw:async-css',
  enforce: 'post',
  transformIndexHtml: {
    order: 'post',
    handler (html) {
      return makeStylesheetLinksAsync(html)
    }
  }
})

export default asyncCssPlugin
