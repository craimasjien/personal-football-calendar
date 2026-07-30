import { afterEach, describe, expect, it, vi } from 'vitest'
import { SourceError, fetchEvents } from '../../src/source/espn.ts'

const OPTS = { code: 'ned.1', from: '20260701', to: '20270701', backoffMs: 0 }

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

  it('builds the documented ESPN url with the date window and a high limit', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ events: [] }))
    vi.stubGlobal('fetch', fetchMock)

    await fetchEvents(OPTS)

    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain('/soccer/ned.1/scoreboard')
    expect(url).toContain('dates=20260701-20270701')
    expect(url).toContain('limit=1000')
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
