import { afterEach, describe, expect, it, vi } from 'vitest'
import { SourceError, fetchEvents } from '../../src/source/espn.ts'

const OPTS = { code: 'ned.1', from: '20260701', to: '20261231', backoffMs: 0 }

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchEvents', () => {
  it('returns the events array on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ events: [{ id: '1' }] })))
    await expect(fetchEvents(OPTS)).resolves.toEqual([{ id: '1' }])
  })

  it('asks for a whole calendar year, because ESPN rejects a from-to range', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ events: [] }))
    vi.stubGlobal('fetch', fetchMock)

    await fetchEvents(OPTS)

    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain('/soccer/ned.1/scoreboard')
    expect(url).toContain('dates=2026')
    expect(url).toContain('limit=1000')
  })

  /**
   * The regression that took the build down: ESPN answers 400 for every
   * `dates=FROM-TO` value, whatever its length. No request may contain one.
   */
  it('never sends a date range, whatever window it is given', async () => {
    const fetchMock = vi.fn().mockImplementation(() => jsonResponse({ events: [] }))
    vi.stubGlobal('fetch', fetchMock)

    await fetchEvents({ ...OPTS, from: '20260701', to: '20280630' })

    for (const call of fetchMock.mock.calls) {
      const dates = new URL(String(call[0])).searchParams.get('dates')
      expect(dates).toMatch(/^\d{4}$/)
    }
  })

  it('covers every calendar year the window touches', async () => {
    const fetchMock = vi.fn().mockImplementation(() => jsonResponse({ events: [] }))
    vi.stubGlobal('fetch', fetchMock)

    await fetchEvents({ ...OPTS, from: '20260701', to: '20280630' })

    const years = fetchMock.mock.calls.map((c) =>
      new URL(String(c[0])).searchParams.get('dates'),
    )
    expect(years).toEqual(['2026', '2027', '2028'])
  })

  /**
   * A calendar year is wider than the season window we were asked for, so the
   * surrounding months must not leak into the calendar.
   */
  it('filters events back to the requested window', async () => {
    const events = [
      { id: 'before', date: '2026-05-01T18:00Z' },
      { id: 'inside', date: '2026-09-04T18:00Z' },
      { id: 'after', date: '2027-02-01T18:00Z' },
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ events })))

    await expect(fetchEvents(OPTS)).resolves.toEqual([{ id: 'inside', date: '2026-09-04T18:00Z' }])
  })

  it('keeps the window boundaries themselves', async () => {
    const events = [
      { id: 'first-day', date: '2026-07-01T18:00Z' },
      { id: 'last-day', date: '2026-12-31T18:00Z' },
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ events })))

    await expect(fetchEvents(OPTS)).resolves.toHaveLength(2)
  })

  /**
   * Dropping undateable events here would read downstream as a quiet competition
   * rather than a changed feed, which is exactly what the wipe guard exists to catch.
   */
  it('keeps events it cannot date, so the wipe guard still sees a shape change', async () => {
    const events = [{ id: 'no-date' }, { id: 'bad-date', date: 'not-a-date' }]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ events })))

    await expect(fetchEvents(OPTS)).resolves.toHaveLength(2)
  })

  /**
   * `limit` truncates rather than paginating, so a year that comes back exactly
   * full has silently lost fixtures.
   */
  it('throws when a year comes back at the limit, because that means truncation', async () => {
    const events = Array.from({ length: 1000 }, (_, i) => ({
      id: String(i),
      date: '2026-09-04T18:00Z',
    }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ events })))

    await expect(fetchEvents(OPTS)).rejects.toThrow(SourceError)
  })

  it('sends no credentials, because the endpoint needs none', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ events: [] }))
    vi.stubGlobal('fetch', fetchMock)

    await fetchEvents(OPTS)

    const init = fetchMock.mock.calls[0][1] as RequestInit | undefined
    const headers = JSON.stringify(init?.headers ?? {}).toLowerCase()
    expect(headers).not.toContain('authorization')
    expect(headers).not.toContain('key')
  })

  it('treats a missing events array as an empty competition, not an error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({})))
    await expect(fetchEvents(OPTS)).resolves.toEqual([])
  })

  it('throws when events is present but not an array', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ events: 'nope' })))
    await expect(fetchEvents(OPTS)).rejects.toThrow(SourceError)
  })

  it('throws when the body is not json at all', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>maintenance</html>', { status: 200 })),
    )
    await expect(fetchEvents(OPTS)).rejects.toThrow(SourceError)
  })

  it('retries on 429 and succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 429))
      .mockResolvedValueOnce(jsonResponse({ events: [{ id: '2' }] }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchEvents(OPTS)).resolves.toEqual([{ id: '2' }])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('retries on 500 and gives up after three attempts', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, 500))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchEvents(OPTS)).rejects.toThrow(SourceError)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('retries a network failure', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(jsonResponse({ events: [] }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchEvents(OPTS)).resolves.toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not retry a 404, since a wrong competition code will not fix itself', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, 404))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchEvents(OPTS)).rejects.toThrow(SourceError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('names the competition code in its error, so a broken code is obvious', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 404)))
    await expect(fetchEvents(OPTS)).rejects.toThrow(/ned\.1/)
  })

  it('throws SourceError when the body is valid json but null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(null)))
    await expect(fetchEvents(OPTS)).rejects.toThrow(SourceError)
  })

  it('throws SourceError when the body is valid json but a primitive', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse('surprise')))
    await expect(fetchEvents(OPTS)).rejects.toThrow(SourceError)
  })

  it('names the competition code when the body is not a json object', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(null)))
    await expect(fetchEvents(OPTS)).rejects.toThrow(/ned\.1/)
  })
})
