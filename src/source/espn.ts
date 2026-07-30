const BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer'
const MAX_ATTEMPTS = 3
const DEFAULT_BACKOFF_MS = 1000

/**
 * A full season fits in one response at this limit — 309 Eredivisie fixtures and
 * 189 Champions League events were observed, so no date-window chunking is needed.
 */
const LIMIT = 1000

export class SourceError extends Error {}

export type FetchEventsOptions = {
  /** ESPN league code, e.g. 'ned.1'. */
  code: string
  /** YYYYMMDD. */
  from: string
  /** YYYYMMDD. */
  to: string
  /** Base backoff, doubled per attempt. Tests pass 0. */
  backoffMs?: number
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** 429 and 5xx are transient; other 4xx means we are asking wrongly. */
function isRetryable(status: number): boolean {
  return status === 429 || status >= 500
}

/**
 * Fetch one competition's season. Unauthenticated — ESPN's public endpoint needs
 * no key, which is why this project has no secrets at all.
 */
export async function fetchEvents(opts: FetchEventsOptions): Promise<unknown[]> {
  const { code, from, to, backoffMs = DEFAULT_BACKOFF_MS } = opts
  const url = `${BASE}/${code}/scoreboard?dates=${from}-${to}&limit=${LIMIT}`

  let lastError = ''

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res: Response
    try {
      res = await fetch(url)
    } catch (cause) {
      // Network-level failure: transient by nature, so retry.
      lastError = `network error for ${code}: ${cause instanceof Error ? cause.message : cause}`
      if (attempt < MAX_ATTEMPTS) await sleep(backoffMs * 2 ** (attempt - 1))
      continue
    }

    if (!res.ok) {
      lastError = `HTTP ${res.status} for ${code}`
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
      throw new SourceError(`Response for ${code} was not JSON`)
    }

    if (typeof body !== 'object' || body === null) {
      throw new SourceError(`Response for ${code} was not a JSON object`)
    }

    const events = (body as { events?: unknown }).events

    // A competition with nothing scheduled yet legitimately omits `events`.
    if (events === undefined || events === null) return []

    if (!Array.isArray(events)) {
      throw new SourceError(`Response for ${code} had a non-array 'events' field`)
    }

    return events
  }

  throw new SourceError(`Gave up after ${MAX_ATTEMPTS} attempts: ${lastError}`)
}
