import { Helmet } from '@dr.pogodin/react-helmet'
import { staticHead } from '../utils/staticSeo.generated'
import { SITE_NAME, LOCALE, ROBOTS_INDEX, ROBOTS_NOINDEX, TWITTER_CARD } from '../utils/seoDefaults'

/**
 * The head for a route the edge owns: home, about, contact, terms and search. The wording comes
 * from `src/utils/staticSeo.generated.js`, which is generated from the backend's route table, so a
 * crawler that runs no JavaScript and a browser that does read the same title, description,
 * canonical and share image for one URL.
 *
 * Every tag the edge marks with data-rh is declared here on purpose: Helmet removes a marked tag
 * the app stops declaring, which is how these pages used to end up with no site name, no locale
 * and no robots directive after hydration.
 */
const RouteSeo = function ({ pathname, term = '' }) {
  const head = staticHead(pathname, term)
  // A path the edge does not own has no copy to publish; inventing one here is how drift starts.
  if (head == null) return null

  return (
    <Helmet prioritizeSeoTags>
      <title>{head.title}</title>
      <meta name='description' content={head.description} />
      <link rel='canonical' href={head.canonical} />

      <meta property='og:type' content='website' />
      <meta property='og:url' content={head.canonical} />
      <meta property='og:title' content={head.title} />
      <meta property='og:description' content={head.description} />
      <meta property='og:image' content={head.image} />
      <meta property='og:site_name' content={SITE_NAME} />
      <meta property='og:locale' content={LOCALE} />
      <meta name='robots' content={head.noindex ? ROBOTS_NOINDEX : ROBOTS_INDEX} />

      <meta name='twitter:card' content={TWITTER_CARD} />
      <meta name='twitter:title' content={head.title} />
      <meta name='twitter:description' content={head.description} />
      <meta name='twitter:image' content={head.image} />
    </Helmet>
  )
}

export default RouteSeo
