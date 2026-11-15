// Video-duration parsing — the consumer-side copy of the backend seoRules duration contract.
// The edge publishes the finished strings and this app no longer writes <head>, but the two
// implementations must still agree on every value: videoDuration.contract.test.js runs both
// against one table, so a one-sided edit (a different ceiling, a looser shape) fails there.

export const MAX_DURATION_SECONDS = 86400 // whole seconds; matches the container parser's ceiling

function normaliseSeconds (value) {
  const seconds = Math.floor(Number(value))
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > MAX_DURATION_SECONDS) return undefined
  return seconds
}

// "PT1H2M3S" -> seconds. Fractional seconds are floored; a designator-free "PT" is rejected.
function isoToSeconds (text) {
  const match = text.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?$/i)
  if (match == null || (match[1] == null && match[2] == null && match[3] == null)) return undefined
  const seconds = Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0)
  return normaliseSeconds(seconds)
}

// "9:05" and "1:02:03" - the clock shape players and some uploads use.
function clockToSeconds (text) {
  if (!/^\d{1,2}(:[0-5]?\d){1,2}$/.test(text)) return undefined
  const seconds = text.split(':').reduce((total, part) => total * 60 + Number(part), 0)
  return normaliseSeconds(seconds)
}

/**
 * Whole positive seconds from whatever a caller holds: a number, "48", "0:48", "1:02:03" or
 * "PT1M2S". Undefined means unknown - never 0, so no surface can render "0 seconds" for a video
 * nobody has measured. (The backend answers null; same meaning, two idioms.)
 */
export function durationSeconds (value) {
  if (typeof value === 'number') return normaliseSeconds(value)
  if (typeof value !== 'string') return undefined
  const text = value.trim()
  if (/^\d+$/.test(text)) return normaliseSeconds(Number(text))
  if (/^PT/i.test(text)) return isoToSeconds(text)
  return clockToSeconds(text)
}

/** The ISO 8601 form Google's VideoObject wants, or '' when the value is not a real duration. */
export function iso8601Duration (value) {
  const seconds = durationSeconds(value)
  if (seconds == null) return ''
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = seconds % 60
  if (hours > 0) return `PT${hours}H${minutes}M${rest}S`
  if (minutes > 0) return `PT${minutes}M${rest}S`
  return `PT${rest}S`
}
