import { describe, expect, it } from 'vitest'
import { durationSeconds, iso8601Duration } from './mediaSeo.js'

// The cross-stack table lives in src/videoDuration.contract.test.js; this suite pins the client
// idiom (undefined for unknown) and the shared ceiling.
describe('durationSeconds', () => {
  it('reads numbers, numeric strings, clock times and ISO durations', () => {
    expect(durationSeconds(48)).toBe(48)
    expect(durationSeconds('120')).toBe(120)
    expect(durationSeconds('0:48')).toBe(48)
    expect(durationSeconds('9:05')).toBe(545)
    expect(durationSeconds('1:02:03')).toBe(3723)
    expect(durationSeconds('PT1H2M3S')).toBe(3723)
  })

  it('says undefined when nothing measured, never 0', () => {
    expect(durationSeconds(0)).toBeUndefined()
    expect(durationSeconds(-4)).toBeUndefined()
    expect(durationSeconds('yesterday')).toBeUndefined()
    expect(durationSeconds('')).toBeUndefined()
    expect(durationSeconds(null)).toBeUndefined()
    expect(durationSeconds(undefined)).toBeUndefined()
  })

  it('keeps corrupt containers off the page at the shared ceiling', () => {
    expect(durationSeconds(86400)).toBe(86400)
    expect(durationSeconds(86401)).toBeUndefined()
  })
})

describe('iso8601Duration', () => {
  it('formats the ISO forms VideoObject asks for', () => {
    expect(iso8601Duration(48)).toBe('PT48S')
    expect(iso8601Duration(125)).toBe('PT2M5S')
    expect(iso8601Duration(3723)).toBe('PT1H2M3S')
  })

  it('formats nothing for a length nobody measured', () => {
    expect(iso8601Duration(null)).toBe('')
    expect(iso8601Duration(undefined)).toBe('')
    expect(iso8601Duration(0)).toBe('')
  })
})
