import { describe, expect, it, vi } from 'vitest'
import type { RawConfig } from '../config/teams.ts'
import { buildCalendar } from '../src/build.ts'
import { COMPETITIONS } from '../src/source/competitions.ts'

const AJAX = 139
const FEYENOORD = 142
const CAMBUUR = 3736

const RAW: RawConfig = {
  myTeam: 'Ajax Amsterdam',
  eredivisie: { tier1: ['Ajax Amsterdam', 'Feyenoord Rotterdam'], tier2: [] },
  europeElite: [],
  bigEuropeanStageFrom: 'quarterfinals',
  displayNames: { 'Ajax Amsterdam': 'AFC Ajax' },
}

const TEAM_IDS = { 'Ajax Amsterdam': AJAX, 'Feyenoord Rotterdam': FEYENOORD }

// ESPN's displayName is the same string used as a key in RAW.displayNames for
// known clubs (that's how the pipeline maps provider name -> calendar name),
// so known ids must echo their real name here rather than a placeholder.
const TEAM_NAMES: Record<number, string> = {
  [AJAX]: 'Ajax Amsterdam',
  [FEYENOORD]: 'Feyenoord Rotterdam',
}

function espnEvent(id: string, homeId: number, awayId: number, slug = 'regular-season') {
  const nameFor = (teamId: number) => TEAM_NAMES[teamId] ?? `t${teamId}`
  return {
    id,
    date: '2026-03-15T13:30Z',
    season: { slug },
    status: { type: { name: 'STATUS_SCHEDULED' } },
    competitions: [
      {
        timeValid: true,
        leg: null,
        venue: { fullName: 'Johan Cruijff ArenA', address: { city: 'Amsterdam' } },
        competitors: [
          { homeAway: 'home', team: { id: String(homeId), displayName: nameFor(homeId) } },
          { homeAway: 'away', team: { id: String(awayId), displayName: nameFor(awayId) } },
        ],
      },
    ],
  }
}

const ERE = COMPETITIONS.eredivisie.code

/**
 * Real ESPN season windows are disjoint (overlap=0, verified live), so a fixture
 * appears in exactly one of the two windows fetched. Serve the configured events
 * only on the first request per code, and nothing on the second, to mirror that
 * rather than have every existing count-based test double under the hood.
 */
function fetcherFor(byCode: Record<string, unknown[]>) {
  const served = new Set<string>()
  return vi.fn(async ({ code }: { code: string; from: string; to: string }) => {
    if (served.has(code)) return []
    served.add(code)
    return byCode[code] ?? []
  })
}

describe('buildCalendar', () => {
  it('fetches every configured competition for both the current and next season window', async () => {
    const fetchEvents = fetcherFor({ [ERE]: [espnEvent('1', AJAX, FEYENOORD)] })

    await buildCalendar({ season: 2025, rawConfig: RAW, teamIds: TEAM_IDS, fetchEvents })

    expect(fetchEvents).toHaveBeenCalledTimes(Object.keys(COMPETITIONS).length * 2)
  })

  it('asks for both the current and the next season window', async () => {
    const fetchEvents = fetcherFor({ [ERE]: [espnEvent('1', AJAX, FEYENOORD)] })
    await buildCalendar({ season: 2026, rawConfig: RAW, teamIds: TEAM_IDS, fetchEvents })
    const windows = fetchEvents.mock.calls.map((c) => `${c[0].from}-${c[0].to}`)
    expect(windows).toContain('20260701-20270701')
    expect(windows).toContain('20270701-20280701')
  })

  it('does not emit the same fixture twice when both windows return it', async () => {
    // Two windows touching at 1 July could in principle both return one event.
    const dup = espnEvent('1', AJAX, FEYENOORD)
    const fetchEvents = vi.fn(async ({ code }: { code: string }) => (code === ERE ? [dup] : []))
    const result = await buildCalendar({
      season: 2026,
      rawConfig: RAW,
      teamIds: TEAM_IDS,
      fetchEvents,
    })
    expect(result.fixtures.filter((f) => f.id === '1')).toHaveLength(1)
    expect(result.ics.match(/UID:fixture-1@football-calendar/g)).toHaveLength(1)
  })

  it('asks for the right season window', async () => {
    const fetchEvents = fetcherFor({ [ERE]: [espnEvent('1', AJAX, FEYENOORD)] })

    await buildCalendar({ season: 2026, rawConfig: RAW, teamIds: TEAM_IDS, fetchEvents })

    expect(fetchEvents).toHaveBeenCalledWith(
      expect.objectContaining({ from: '20260701', to: '20270701' }),
    )
  })

  it('includes required and optional fixtures and drops excluded ones', async () => {
    const fetchEvents = fetcherFor({
      [ERE]: [
        espnEvent('1', AJAX, FEYENOORD), // required
        espnEvent('2', AJAX, CAMBUUR), // optional
        espnEvent('3', CAMBUUR, 9999), // excluded
      ],
    })

    const result = await buildCalendar({
      season: 2025,
      rawConfig: RAW,
      teamIds: TEAM_IDS,
      fetchEvents,
    })

    expect(result.entries).toHaveLength(2)
    expect(result.ics.match(/BEGIN:VEVENT/g)).toHaveLength(2)
    expect(result.ics).toContain('AFC Ajax')
    expect(result.ics).toContain('Optioneel:')
  })

  it('reports per-competition counts', async () => {
    const fetchEvents = fetcherFor({
      [ERE]: [espnEvent('1', AJAX, FEYENOORD), espnEvent('2', AJAX, CAMBUUR)],
    })

    const result = await buildCalendar({
      season: 2025,
      rawConfig: RAW,
      teamIds: TEAM_IDS,
      fetchEvents,
    })

    const ere = result.counts.find((c) => c.competition === 'eredivisie')!
    expect(ere).toEqual({
      competition: 'eredivisie',
      fetched: 2,
      dropped: 0,
      required: 1,
      optional: 1,
    })
  })

  it('counts events ESPN returned, not events that survived mapping', async () => {
    const cancelled = espnEvent('9', AJAX, FEYENOORD)
    cancelled.status.type.name = 'STATUS_CANCELED'
    const result = await buildCalendar({
      season: 2025,
      rawConfig: RAW,
      teamIds: TEAM_IDS,
      fetchEvents: fetcherFor({ [ERE]: [espnEvent('1', AJAX, FEYENOORD), cancelled] }),
    })
    const ere = result.counts.find((c) => c.competition === 'eredivisie')!
    expect(ere.fetched).toBe(2)
    expect(ere.dropped).toBe(1)
    expect(ere.required).toBe(1)
    expect(result.entries).toHaveLength(1)
    expect(result.fixtures).toHaveLength(1)
  })

  it('keeps past fixtures, so weekly rebuilds never delete watched matches', async () => {
    const past = espnEvent('9', AJAX, FEYENOORD)
    past.date = '2025-09-01T13:30Z'
    past.status.type.name = 'STATUS_FULL_TIME'

    const result = await buildCalendar({
      season: 2025,
      rawConfig: RAW,
      teamIds: TEAM_IDS,
      fetchEvents: fetcherFor({ [ERE]: [past] }),
    })

    expect(result.entries).toHaveLength(1)
  })

  it('fails the guard rather than publishing when a competition is entirely unmappable', async () => {
    // Simulates ESPN changing shape for one feed only: events come back but none of
    // them have a recognisable team, so mapEvent drops every single one.
    const shapeChanged = { id: '1', date: '2026-03-15T13:30Z', competitions: [{}] }
    const fetchEvents = fetcherFor({
      [ERE]: [espnEvent('1', AJAX, FEYENOORD)],
      [COMPETITIONS.ucl.code]: [shapeChanged],
    })

    await expect(
      buildCalendar({ season: 2025, rawConfig: RAW, teamIds: TEAM_IDS, fetchEvents }),
    ).rejects.toThrow(/unmappable/i)
  })

  it('fails the guard rather than publishing when my team is absent', async () => {
    const fetchEvents = fetcherFor({ [ERE]: [espnEvent('1', FEYENOORD, CAMBUUR)] })

    await expect(
      buildCalendar({ season: 2025, rawConfig: RAW, teamIds: TEAM_IDS, fetchEvents }),
    ).rejects.toThrow(/no fixtures/i)
  })

  it('propagates an unknown team in the config instead of publishing a wrong calendar', async () => {
    await expect(
      buildCalendar({
        season: 2025,
        rawConfig: { ...RAW, europeElite: ['Girona'] },
        teamIds: TEAM_IDS,
        fetchEvents: fetcherFor({}),
      }),
    ).rejects.toThrow(/Girona/)
  })

  it('resolves the config before fetching, so a typo costs no requests', async () => {
    const fetchEvents = fetcherFor({})

    await expect(
      buildCalendar({
        season: 2025,
        rawConfig: { ...RAW, europeElite: ['Girona'] },
        teamIds: TEAM_IDS,
        fetchEvents,
      }),
    ).rejects.toThrow()

    expect(fetchEvents).not.toHaveBeenCalled()
  })

  it('propagates a fetch failure instead of publishing a partial calendar', async () => {
    const boom = vi.fn(async () => {
      throw new Error('ESPN unreachable')
    })
    await expect(
      buildCalendar({ season: 2025, rawConfig: RAW, teamIds: TEAM_IDS, fetchEvents: boom }),
    ).rejects.toThrow(/ESPN unreachable/)
  })

  it('tags each event with the competition it was fetched from', async () => {
    const UCL = COMPETITIONS.ucl.code
    const result = await buildCalendar({
      season: 2025,
      rawConfig: RAW,
      teamIds: TEAM_IDS,
      fetchEvents: fetcherFor({
        [ERE]: [espnEvent('1', AJAX, FEYENOORD)],
        [UCL]: [espnEvent('2', AJAX, 9999, 'league-phase')],
      }),
    })
    const byId = new Map(result.fixtures.map((f) => [f.id, f]))
    expect(byId.get('1')!.competition).toBe('eredivisie')
    expect(byId.get('2')!.competition).toBe('ucl')
    // Rule 1: Ajax in Europe is required regardless of opponent. Misattributing the
    // competition would make this 'optional' via the domestic rule.
    expect(result.entries.find((e) => e.fixture.id === '2')!.inclusion).toBe('required')
  })

  it('fetches exactly the ten configured competition codes, each for both windows', async () => {
    const fetchEvents = fetcherFor({ [ERE]: [espnEvent('1', AJAX, FEYENOORD)] })
    await buildCalendar({ season: 2025, rawConfig: RAW, teamIds: TEAM_IDS, fetchEvents })

    const codes = fetchEvents.mock.calls.map((c) => c[0].code)
    const expectedCodes = Object.values(COMPETITIONS).map((c) => c.code)
    // Every code appears, and each exactly twice — once per season window.
    expect(new Set(codes)).toEqual(new Set(expectedCodes))
    for (const code of expectedCodes) {
      expect(codes.filter((c) => c === code)).toHaveLength(2)
    }
  })
})
