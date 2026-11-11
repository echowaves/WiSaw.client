// Head values that are the same on every page. They mirror the strings the Lambda@Edge
// injector writes (WiSaw.cdk lambda-fns/lambdas/injectMetaTagsLambdaFunction/utils.js): a
// crawler that runs JavaScript and one that doesn't must not disagree about them. Ticket 7 of
// the seo-indexing initiative replaces both copies with a single source.

export const SITE_NAME = 'WiSaw'

// The directives are also sent as an X-Robots-Tag header at the edge, so the vocabulary here
// matches it - a page whose header excludes it while its body invites indexing gets crawled
// by whichever signal a crawler trusts more.
export const ROBOTS_INDEX = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
export const ROBOTS_NOINDEX = 'noindex, follow'

export const TWITTER_CARD = 'summary_large_image'
