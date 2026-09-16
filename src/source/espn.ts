import { amsterdamDate } from './map.ts'

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer'
const MAX_ATTEMPTS = 3
const DEFAULT_BACKOFF_MS = 1000

/**
 * A whole calendar year fits in one response at this limit — the widest feed
 * observed was 554 events (`club.friendly`, 2026), against 309 for a full
 * Eredivisie year. `limit` truncates rather than paginates, so a response that
 * comes back at exactly this size has silently lost fixtures and is rejected below.
 */
const LIMIT = 1000

export class SourceError extends Error {}

export type FetchEventsOptions = {
  /** ESPN league code, e.g. 'ned.1'. */
  code: string
  /** YYYYMMDD, inclusive. */
  from: string
  /** YYYYMMDD, inclusive. */
  to: string
  /** Base backoff, doubled per attempt. Tests pass 0. */
  backoffMs?: number
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** 429 and 5xx are transient; other 4xx means we are asking wrongly. */
function isRetryable(status: number): boolean {
  return status === 429 || status >= 500
}

/** The calendar years a YYYYMMDD window touches, inclusive, in order. */
function yearsSpanning(from: string, to: string): number[] {
  const first = Number(from.slice(0, 4))
  const last = Number(to.slice(0, 4))
  const years: number[] = []
  for (let year = first; year <= last; year++) years.push(year)
  return years
}

/**
 * Is this event inside the window we were asked for?
 *
 * Judged on the Amsterdam calendar day, the same way every other date in this
 * project is, so a late kickoff cannot land on a different day here than in the
 * rendered calendar.
 *
 * An event we cannot date is deliberately kept. mapEvent will reject it and count
 * it as dropped, which is what lets the wipe guard recognise a changed feed;
 * discarding it here would instead read downstream as a quiet competition.
 */
function isWithin(event: unknown, from: string, to: string): boolean {
  const iso = (event as { date?: unknown } | null)?.date
  if (typeof iso !== 'string') return true

  let day: string
  try {
    day = amsterdamDate(iso).replaceAll('-', '')
  } catch {
    return true
  }
  if (day.length !== 8) return true

  return day >= from && day <= to
}

/**
 * Fetch one competition's events for one calendar year.
 *
 * A calendar year is the narrowest slice ESPN still supports that is wider than a
 * month: `dates` accepts YYYY, YYYYMM and YYYYMMDD, but every `dates=FROM-TO`
 * range now answers HTTP 400 — see fetchEvents.
 */
async function fetchYear(code: string, year: number, backoffMs: number): Promise<unknown[]> {
  const url = `${BASE}/${code}/scoreboard?dates=${year}&limit=${LIMIT}`

  let lastError = ''

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res: Response
    try {
      res = await fetch(url)
    } catch (cause) {
      // Network-level failure: transient by nature, so retry.
      lastError = `network error for ${code} in ${year}: ${cause instanceof Error ? cause.message : cause}`
      if (attempt < MAX_ATTEMPTS) await sleep(backoffMs * 2 ** (attempt - 1))
      continue
    }

    if (!res.ok) {
      lastError = `HTTP ${res.status} for ${code} in ${year}`
      if (!isRetryable(res.status)) throw new SourceError(lastError)
      if (attempt < MAX_ATTEMPTS) await sleep(backoffMs * 2 ** (attempt - 1))
      continue
    }

    let body: unknown
    try {
      body = await res.json()
    } catch {
      // ESPN is undocumented; a maintenance page instead of JSON is a real
      // possibility and must fail loudly rather than publish an empty calendar.
      throw new SourceError(`Response for ${code} in ${year} was not JSON`)
    }

    if (typeof body !== 'object' || body === null) {
      throw new SourceError(`Response for ${code} in ${year} was not a JSON object`)
    }

    const events = (body as { events?: unknown }).events

    // A competition with nothing scheduled yet legitimately omits `events`.
    if (events === undefined || events === null) return []

    if (!Array.isArray(events)) {
      throw new SourceError(`Response for ${code} in ${year} had a non-array 'events' field`)
    }

    // Truncation is silent: ESPN returns the first `limit` events with no marker.
    // Publishing a season that is quietly missing its tail is worse than failing.
    if (events.length >= LIMIT) {
      throw new SourceError(
        `Response for ${code} in ${year} hit the ${LIMIT}-event limit, so fixtures were ` +
          'truncated — raise LIMIT or fetch a narrower slice than a calendar year.',
      )
    }

    return events
  }

  throw new SourceError(`Gave up after ${MAX_ATTEMPTS} attempts: ${lastError}`)
}

/**
 * Fetch every event for one competition inside a YYYYMMDD window.
 *
 * Unauthenticated — ESPN's public endpoint needs no key, which is why this project
 * has no secrets at all.
 *
 * The window is requested as whole calendar years and filtered back down here,
 * because ESPN withdrew the `dates=FROM-TO` range syntax: it answers HTTP 400 for
 * every range now, of any length and for every league code, including ranges that
 * used to work. That is what broke the build — not the range being too long, which
 * is why the earlier 365-day cap no longer explains anything.
 *
 * Asking per year rather than per month keeps this to a handful of requests per
 * competition; the surrounding months a calendar year drags in are filtered out, so
 * callers see exactly the window they asked for.
 */
export async function fetchEvents(opts: FetchEventsOptions): Promise<unknown[]> {
  const { code, from, to, backoffMs = DEFAULT_BACKOFF_MS } = opts

  const events: unknown[] = []
  for (const year of yearsSpanning(from, to)) {
    events.push(...(await fetchYear(code, year, backoffMs)))
  }

  return events.filter((event) => isWithin(event, from, to))
}
