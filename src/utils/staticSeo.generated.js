/* eslint-disable */
// GENERATED — do not edit. Written by WiSaw.cdk/scripts/publish-static-seo.js from
// lambda-fns/lambdas/injectMetaTagsLambdaFunction/static.js and utils.js, the files the
// Lambda@Edge injector serves. Edit the route table there and run the script; a stale copy is
// caught by WiSaw.cdk/tests/static-route-copy-once.js.

// Head values every page shares with the edge: one line each, no second copy to drift.

export const SITE_NAME = "WiSaw"
export const LOCALE = "en_US"
export const ROBOTS_INDEX = "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
export const ROBOTS_NOINDEX = "noindex, follow"
export const TWITTER_CARD = "summary_large_image"

// The static routes, exactly as the edge serves them: title, description, canonical, share
// image and whether the page is excluded from the index.
export const STATIC_ROUTES = {
  "/": {
    "title": "Free Stock Photos & Videos, Unaltered | WiSaw",
    "description": "Free stock photos and videos, unaltered and royalty free, taken with phone cameras. Browse recent shots and search by what is in them.",
    "canonical": "https://wisaw.com/",
    "image": "https://wisaw.com/android-chrome-512x512.png",
    "noindex": false
  },
  "/about": {
    "title": "About WiSaw — unaltered photos and videos from phone cameras",
    "description": "WiSaw publishes unaltered photos and videos taken with phone cameras: no staging, no studio lighting, no copyright traps. What the app is and why it exists.",
    "canonical": "https://wisaw.com/about",
    "image": "https://wisaw.com/android-chrome-512x512.png",
    "noindex": false
  },
  "/contact": {
    "title": "Contact WiSaw",
    "description": "Contact WiSaw: report a photo or video, request removal, ask about licensing, or send product feedback.",
    "canonical": "https://wisaw.com/contact",
    "image": "https://wisaw.com/android-chrome-512x512.png",
    "noindex": false
  },
  "/terms": {
    "title": "Terms and Conditions — WiSaw",
    "description": "The terms that apply to wisaw.com and the WiSaw apps, including what you may do with photos and videos published on the platform.",
    "canonical": "https://wisaw.com/terms",
    "image": "https://wisaw.com/android-chrome-512x512.png",
    "noindex": false
  },
  "/search": {
    "title": "Search WiSaw — free unaltered photos and videos",
    "description": "Search several thousand unaltered photos and videos taken with phone cameras by what appears in them.",
    "canonical": "https://wisaw.com/search",
    "image": "https://wisaw.com/android-chrome-512x512.png",
    "noindex": true,
    "titleTerm": "WiSaw: searching for {term}",
    "descriptionTerm": "WiSaw: searching for {term}",
    "canonicalTerm": "https://wisaw.com/search/{term}"
  }
}

/**
 * Head values for one app pathname, with `{term}` filled in for search results. Returns null for a
 * path the edge does not own, so a caller never invents copy for an unknown route.
 */
export function staticHead (pathname = '', term = '') {
  const clean = String(pathname || '').replace(/[?#].*$/, '').replace(/\/+$/, '') || '/'
  const key = STATIC_ROUTES[clean] ? clean : `/${clean.split('/')[1] || ''}`
  const route = STATIC_ROUTES[key]
  if (!route) return null

  if (String(term || '') !== '' && route.canonicalTerm) {
    const fill = (template) => String(template).replace(/\{term\}/g, term)
    return {
      title: fill(route.titleTerm),
      description: fill(route.descriptionTerm),
      canonical: String(route.canonicalTerm).replace('{term}', encodeURIComponent(term)),
      image: route.image,
      noindex: route.noindex
    }
  }

  return {
    title: route.title,
    description: route.description,
    canonical: route.canonical,
    image: route.image,
    noindex: route.noindex
  }
}
