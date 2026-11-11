/**
 * Ticket 8 contract: a page may only state a video's length when something measured the file, and
 * both stacks must say the same thing about the same number. The backend publishes seconds in the
 * SEO record and ISO 8601 in its JSON-LD; the app re-declares those values after hydration from its
 * own copy of the rules. These tests pin the copies together — a one-sided edit (a different
 * ceiling, a looser shape, a formatter that emits "PT0S") fails here rather than showing up as two
 * different durations for one URL.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { durationSeconds, iso8601Duration } from './utils/mediaSeo'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SEO_RULES_PATH = path.join(HERE, '..', '..', 'WiSaw.cdk', 'lambda-fns', 'lambdas', 'injectMetaTagsLambdaFunction', 'seoRules.js')

// Every shape a stored value can arrive in, and what it means. Kept as data so the backend module
// is asked about exactly the same table rather than a paraphrase of it.
const CASES = [
  [48, 48],
  [3725, 3725],
  ['120', 120],
  ['0:48', 48],
  ['9:05', 545],
  ['1:02:03', 3723],
  ['PT1H2M3S', 3723],
  ['PT48S', 48],
  [0, undefined],
  [-4, undefined],
  [86401, undefined],
  [86400, 86400],
  ['yesterday', undefined],
  ['', undefined],
  [null, undefined],
  [undefined, undefined]
]

describe('duration rules', () => {
  it.each(CASES)('reads %p as %p seconds', (input, expected) => {
    expect(durationSeconds(input)).toBe(expected)
  })

  it('formats the ISO forms VideoObject asks for', () => {
    expect(iso8601Duration(48)).toBe('PT48S')
    expect(iso8601Duration(125)).toBe('PT2M5S')
    expect(iso8601Duration(3723)).toBe('PT1H2M3S')
  })

  it('formats nothing for a length nobody measured', () => {
    for (const unknown of [null, undefined, '', 'yesterday', 0]) {
      expect(iso8601Duration(unknown)).toBe('')
    }
  })
})

// The sibling checkout is not always present (a client-only clone, a CI box without the backend).
// When it is, the two implementations must agree on every row of the table above.
describe.skipIf(!existsSync(SEO_RULES_PATH))('agrees with the backend seoRules', () => {
  const backend = createRequire(import.meta.url)(SEO_RULES_PATH)

  it.each(CASES)('reads %p the same way', (input, expected) => {
    // The backend answers null for unknown, the app undefined: same meaning, two idioms.
    expect(backend.durationSeconds(input) ?? undefined).toBe(expected)
  })

  it.each([48, 125, 3723, 86400])('formats %p seconds identically', (seconds) => {
    expect(iso8601Duration(seconds)).toBe(backend.iso8601Duration(seconds))
  })

  it('shares the ceiling that keeps a corrupt container off the page', () => {
    expect(backend.MAX_DURATION_SECONDS).toBe(86400)
  })

  it('names the tag and the record field the edge publishes', () => {
    const load = createRequire(import.meta.url)
    const dir = path.dirname(SEO_RULES_PATH)
    const utils = load(path.join(dir, 'utils.js'))
    // The injector only edits a document that has the mount point it is looking for, so it is run
    // against the shell it really receives rather than a hand-written approximation of one.
    const shell = readFileSync(path.join(dir, '..', '..', '..', 'tests', 'fixtures', 'served-index.html'), 'utf8')
    const html = utils.injectMetaTags(shell, { entityLabel: 'video', ogType: 'video', pathSegment: 'videos', imageIdText: 'vid-9', videoUrl: 'https://img.wisaw.com/vid-9.mov', videoDuration: 48 })
    expect(html).toContain('<meta property="og:video:duration" content="48"')
    expect(utils.buildSeoBody({ entityLabel: 'video', duration: 48 })).toContain('"duration":"PT48S"')
  })
})

// The API answers with a wrapper ({ photo, comments, recognitions }), so `duration` beside
// `photo { }` instead of inside it is a schema error that fails the whole query — and the page
// shows a failed query as a missing photo. Pin the nesting, not just the word.
describe('the detail-page queries', () => {
  const source = readFileSync(path.join(HERE, 'containers', 'PhotosComponent.js'), 'utf8')
  const queries = source.match(/query getPhotoAll(?:Curr|Next|Prev)[\s\S]*?`\s*,/g) ?? []

  it('selects duration inside photo { } in every query', () => {
    expect(queries.length).toBe(3)
    for (const query of queries) {
      const photo = query.match(/photo \{([\s\S]*?)\n\s*\}/)
      expect(photo, 'no photo selection block').toBeTruthy()
      expect(photo[1]).toMatch(/^\s*duration$/m)
    }
  })
})
