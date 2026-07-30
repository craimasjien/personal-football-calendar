import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { amsterdamDate, mapEvent } from '../../src/source/map.ts'

/** Minimal ESPN-shaped event, overridable per test. */
function event(overrides: Record<string, unknown> = {}, compOverrides: Record<string, unknown> = {}) {
  return {
    id: '401875655',
    date: '2026-03-15T13:30Z',
    season: { slug: 'regular-season' },
    status: { type: { name: 'STATUS_SCHEDULED' } },
    competitions: [
      {
        timeValid: true,
        leg: null,
        venue: { fullName: 'Johan Cruijff ArenA', address: { city: 'Amsterdam' } },
        competitors: [
          { homeAway: 'home', team: { id: '139', displayName: 'Ajax Amsterdam' } },
          { homeAway: 'away', team: { id: '142', displayName: 'Feyenoord Rotterdam' } },
        ],
        ...compOverrides,
      },
    ],
    ...overrides,
  }
}

describe('mapEvent', () => {
  it('maps a confirmed league fixture', () => {
    const f = mapEvent(event(), 'eredivisie')!
    expect(f.id).toBe('401875655')
    expect(f.competition).toBe('eredivisie')
    expect(f.stage).toBe('regular-season')
    expect(f.leg).toBeNull()
    expect(f.home).toEqual({ id: 139, name: 'Ajax Amsterdam' })
    expect(f.away).toEqual({ id: 142, name: 'Feyenoord Rotterdam' })
    expect(f.venue).toEqual({ name: 'Johan Cruijff ArenA', city: 'Amsterdam' })
    expect(f.kickoff).toEqual({ kind: 'confirmed', utc: new Date('2026-03-15T13:30Z') })
  })

  it('converts ESPN string team ids to numbers, so comparisons are numeric', () => {
    const f = mapEvent(event(), 'eredivisie')!
    expect(typeof f.home.id).toBe('number')
    expect(typeof f.away.id).toBe('number')
  })

  it('reads home and away from homeAway, not from array order', () => {
    const reversed = event({}, {
      competitors: [
        { homeAway: 'away', team: { id: '142', displayName: 'Feyenoord Rotterdam' } },
        { homeAway: 'home', team: { id: '139', displayName: 'Ajax Amsterdam' } },
      ],
    })
    const f = mapEvent(reversed, 'eredivisie')!
    expect(f.home.id).toBe(139)
    expect(f.away.id).toBe(142)
  })

  it('treats timeValid false as a provisional kickoff on the Amsterdam date', () => {
    const f = mapEvent(event({}, { timeValid: false }), 'eredivisie')!
    expect(f.kickoff).toEqual({ kind: 'provisional', date: '2026-03-15' })
  })

  it('treats a missing timeValid as provisional, not confirmed', () => {
    const f = mapEvent(event({}, { timeValid: undefined }), 'eredivisie')!
    expect(f.kickoff.kind).toBe('provisional')
  })

  it('maps a missing venue to null rather than guessing', () => {
    const f = mapEvent(event({}, { venue: null }), 'eredivisie')!
    expect(f.venue).toBeNull()
  })

  it('maps a venue with no city to null rather than a half address', () => {
    const f = mapEvent(event({}, { venue: { fullName: 'Somewhere', address: {} } }), 'eredivisie')!
    expect(f.venue).toBeNull()
  })

  it('maps the stage slug and leg of a knockout fixture', () => {
    const f = mapEvent(
      event({ season: { slug: 'quarterfinals' } }, { leg: { value: 2 } }),
      'ucl',
    )!
    expect(f.stage).toBe('quarterfinals')
    expect(f.leg).toBe(2)
  })

  it('ignores a leg value outside 1 and 2', () => {
    const f = mapEvent(event({}, { leg: { value: 7 } }), 'ucl')!
    expect(f.leg).toBeNull()
  })

  it('drops cancelled events entirely', () => {
    const cancelled = event({ status: { type: { name: 'STATUS_CANCELED' } } })
    expect(mapEvent(cancelled, 'eredivisie')).toBeNull()
  })

  it('treats a postponed event as provisional, since its listed time is stale', () => {
    const postponed = event({ status: { type: { name: 'STATUS_POSTPONED' } } })
    expect(mapEvent(postponed, 'eredivisie')!.kickoff).toEqual({
      kind: 'provisional',
      date: '2026-03-15',
    })
  })

  it('drops an event missing a home or away competitor', () => {
    const oneSided = event({}, {
      competitors: [{ homeAway: 'home', team: { id: '139', displayName: 'Ajax Amsterdam' } }],
    })
    expect(mapEvent(oneSided, 'eredivisie')).toBeNull()
  })

  it('drops an event with no competitions array', () => {
    expect(mapEvent({ id: '1', competitions: [] }, 'eredivisie')).toBeNull()
  })

  it('returns null for null or undefined input instead of throwing', () => {
    expect(mapEvent(null, 'eredivisie')).toBeNull()
    expect(mapEvent(undefined, 'eredivisie')).toBeNull()
  })

  it('returns null for a non-object input instead of throwing', () => {
    expect(mapEvent('nope', 'eredivisie')).toBeNull()
    expect(mapEvent(42, 'eredivisie')).toBeNull()
  })

  it('drops a malformed element without affecting its neighbours', () => {
    const good = event()
    const mapped = [good, null, 'garbage', undefined].map((e) => mapEvent(e, 'eredivisie'))
    expect(mapped.filter((f) => f !== null)).toHaveLength(1)
  })
})

describe('amsterdamDate', () => {
  it('uses the Amsterdam calendar day, not the UTC one', () => {
    // 23:30 UTC is already the next day in Amsterdam (CET, +1).
    expect(amsterdamDate('2026-01-10T23:30:00Z')).toBe('2026-01-11')
  })

  it('handles summer time', () => {
    // 22:30 UTC is the next day in Amsterdam during CEST (+2).
    expect(amsterdamDate('2026-06-10T22:30:00Z')).toBe('2026-06-11')
  })

  it('leaves a midday timestamp on its own day', () => {
    expect(amsterdamDate('2026-03-15T13:30:00Z')).toBe('2026-03-15')
  })
})

type Recorded = { events: unknown[] }

function recorded(name: string): unknown[] {
  const raw = readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8')
  return (JSON.parse(raw) as Recorded).events
}

describe('mapEvent against recorded ESPN responses', () => {
  const cases = [
    { file: 'espn-eredivisie.json', competition: 'eredivisie' as const, min: 5 },
    { file: 'espn-ucl.json', competition: 'ucl' as const, min: 15 },
    { file: 'espn-knvb-cup.json', competition: 'knvb-cup' as const, min: 10 },
    { file: 'espn-uecl-qual.json', competition: 'uecl-qual' as const, min: 8 },
  ]

  for (const { file, competition, min } of cases) {
    describe(file, () => {
      const events = recorded(file)

      it('has a non-trivial recorded response', () => {
        expect(events.length).toBeGreaterThanOrEqual(min)
      })

      it('maps every event without throwing', () => {
        for (const e of events) {
          expect(() => mapEvent(e, competition)).not.toThrow()
        }
      })

      it('produces well-formed fixtures for everything it does not drop', () => {
        const mapped = events.map((e) => mapEvent(e, competition)).filter((f) => f !== null)
        expect(mapped.length).toBeGreaterThan(0)

        for (const f of mapped) {
          expect(f.id).toMatch(/^\d+$/)
          expect(f.competition).toBe(competition)
          expect(Number.isInteger(f.home.id)).toBe(true)
          expect(Number.isInteger(f.away.id)).toBe(true)
          expect(f.home.id).not.toBe(f.away.id)
          expect(f.home.name.length).toBeGreaterThan(0)
          expect(f.away.name.length).toBeGreaterThan(0)
          if (f.kickoff.kind === 'confirmed') {
            expect(Number.isNaN(f.kickoff.utc.getTime())).toBe(false)
          } else {
            expect(f.kickoff.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
          }
        }
      })
    })
  }

  it('finds Ajax in the recorded Eredivisie season', () => {
    const mapped = recorded('espn-eredivisie.json')
      .map((e) => mapEvent(e, 'eredivisie'))
      .filter((f) => f !== null)
    expect(mapped.some((f) => f.home.id === 139 || f.away.id === 139)).toBe(true)
  })

  it('recovers both provisional and confirmed kickoffs from the Eredivisie recording', () => {
    const kinds = new Set(
      recorded('espn-eredivisie.json')
        .map((e) => mapEvent(e, 'eredivisie'))
        .filter((f) => f !== null)
        .map((f) => f.kickoff.kind),
    )
    expect(kinds).toEqual(new Set(['confirmed', 'provisional']))
  })

  it('recovers every knockout stage from the Champions League recording', () => {
    const stages = new Set(
      recorded('espn-ucl.json')
        .map((e) => mapEvent(e, 'ucl'))
        .filter((f) => f !== null)
        .map((f) => f.stage),
    )
    for (const expected of [
      'league-phase',
      'knockout-round-playoffs',
      'round-of-16',
      'quarterfinals',
      'semifinals',
      'final',
    ]) {
      expect(stages).toContain(expected)
    }
  })

  it('recovers both legs from the Champions League recording', () => {
    const legs = new Set(
      recorded('espn-ucl.json')
        .map((e) => mapEvent(e, 'ucl'))
        .filter((f) => f !== null)
        .map((f) => f.leg),
    )
    expect(legs).toContain(1)
    expect(legs).toContain(2)
  })

  it('recovers the domestic cup rounds from the KNVB Beker recording', () => {
    const stages = new Set(
      recorded('espn-knvb-cup.json')
        .map((e) => mapEvent(e, 'knvb-cup'))
        .filter((f) => f !== null)
        .map((f) => f.stage),
    )
    expect(stages).toContain('first-round')
    expect(stages).toContain('second-round')
    expect(stages).toContain('final')
  })

  it('recovers all four qualifying rounds from the Conference League qualifying recording', () => {
    // Live-recorded from uefa.europa.conf_qual, season 2025 (dates 20250701-20260701),
    // which is the window that carries first through play-off round. This is what
    // evidences that 'third-round' and 'playoff-round' are real ESPN slugs, not a guess —
    // without a committed recording, a wrong guess (e.g. 'qualifying-play-off-round')
    // would fall back silently to 'regular-season' and STAGES would carry dead code.
    const stages = new Set(
      recorded('espn-uecl-qual.json')
        .map((e) => mapEvent(e, 'uecl-qual'))
        .filter((f) => f !== null)
        .map((f) => f.stage),
    )
    expect(stages).toContain('first-round')
    expect(stages).toContain('second-round')
    expect(stages).toContain('third-round')
    expect(stages).toContain('playoff-round')
  })
})
