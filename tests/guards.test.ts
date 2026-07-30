import { describe, expect, it } from 'vitest'
import type { CalendarEntry, Fixture } from '../src/domain.ts'
import { GuardError, assertPublishable } from '../src/guards.ts'

const AJAX = 139

function fixture(homeId: number, awayId: number): Fixture {
  return {
    id: '1',
    competition: 'eredivisie',
    stage: 'regular-season',
    leg: null,
    home: { id: homeId, name: 'h' },
    away: { id: awayId, name: 'a' },
    venue: null,
    kickoff: { kind: 'confirmed', utc: new Date('2026-03-15T13:30:00Z') },
  }
}

const entry = (f: Fixture): CalendarEntry => ({ fixture: f, inclusion: 'required' })

describe('assertPublishable', () => {
  it('passes when my team has fixtures and the calendar has events', () => {
    const f = fixture(AJAX, 142)
    expect(() =>
      assertPublishable({ fixtures: [f], entries: [entry(f)], myTeamId: AJAX }),
    ).not.toThrow()
  })

  it('refuses when my team has no fixtures at all', () => {
    const f = fixture(148, 142)
    expect(() =>
      assertPublishable({ fixtures: [f], entries: [entry(f)], myTeamId: AJAX }),
    ).toThrow(GuardError)
  })

  it('explains why it refused when my team is missing', () => {
    const f = fixture(148, 142)
    expect(() =>
      assertPublishable({ fixtures: [f], entries: [entry(f)], myTeamId: AJAX }),
    ).toThrow(/no fixtures/i)
  })

  it('refuses when the calendar would be empty', () => {
    const f = fixture(AJAX, 142)
    expect(() => assertPublishable({ fixtures: [f], entries: [], myTeamId: AJAX })).toThrow(
      GuardError,
    )
  })

  it('refuses when there is no data at all', () => {
    expect(() => assertPublishable({ fixtures: [], entries: [], myTeamId: AJAX })).toThrow(
      GuardError,
    )
  })

  it('counts my team whether at home or away', () => {
    const away = fixture(142, AJAX)
    expect(() =>
      assertPublishable({ fixtures: [away], entries: [entry(away)], myTeamId: AJAX }),
    ).not.toThrow()
  })
})
