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
      assertPublishable({ fixtures: [f], entries: [entry(f)], myTeamId: AJAX, counts: [] }),
    ).not.toThrow()
  })

  it('refuses when my team has no fixtures at all', () => {
    const f = fixture(148, 142)
    expect(() =>
      assertPublishable({ fixtures: [f], entries: [entry(f)], myTeamId: AJAX, counts: [] }),
    ).toThrow(GuardError)
  })

  it('explains why it refused when my team is missing', () => {
    const f = fixture(148, 142)
    expect(() =>
      assertPublishable({ fixtures: [f], entries: [entry(f)], myTeamId: AJAX, counts: [] }),
    ).toThrow(/no fixtures/i)
  })

  it('refuses when the calendar would be empty', () => {
    const f = fixture(AJAX, 142)
    expect(() =>
      assertPublishable({ fixtures: [f], entries: [], myTeamId: AJAX, counts: [] }),
    ).toThrow(GuardError)
  })

  it('refuses when there is no data at all', () => {
    expect(() =>
      assertPublishable({ fixtures: [], entries: [], myTeamId: AJAX, counts: [] }),
    ).toThrow(GuardError)
  })

  it('counts my team whether at home or away', () => {
    const away = fixture(142, AJAX)
    expect(() =>
      assertPublishable({ fixtures: [away], entries: [entry(away)], myTeamId: AJAX, counts: [] }),
    ).not.toThrow()
  })

  it('refuses when a competition returned events but mapped none, signalling a shape change', () => {
    const f = fixture(AJAX, 142)
    expect(() =>
      assertPublishable({
        fixtures: [f],
        entries: [entry(f)],
        myTeamId: AJAX,
        counts: [{ competition: 'ucl', fetched: 189, dropped: 189 }],
      }),
    ).toThrow(GuardError)
  })

  it('names the wiped competition and event count in the error', () => {
    const f = fixture(AJAX, 142)
    expect(() =>
      assertPublishable({
        fixtures: [f],
        entries: [entry(f)],
        myTeamId: AJAX,
        counts: [{ competition: 'ucl', fetched: 189, dropped: 189 }],
      }),
    ).toThrow(/ucl \(189 events\)/)
  })

  it('does not refuse a competition with fetched=0, dropped=0 — a quiet competition is normal', () => {
    const f = fixture(AJAX, 142)
    expect(() =>
      assertPublishable({
        fixtures: [f],
        entries: [entry(f)],
        myTeamId: AJAX,
        counts: [{ competition: 'knvb-cup', fetched: 0, dropped: 0 }],
      }),
    ).not.toThrow()
  })

  it('does not refuse a competition with only partial drops', () => {
    const f = fixture(AJAX, 142)
    expect(() =>
      assertPublishable({
        fixtures: [f],
        entries: [entry(f)],
        myTeamId: AJAX,
        counts: [{ competition: 'eredivisie', fetched: 10, dropped: 3 }],
      }),
    ).not.toThrow()
  })

  it('does not refuse a total wipe below the wipe-guard threshold of 5 (the supercup case)', () => {
    // johan-cruijff-schaal returns exactly one event per season window: a single
    // cancelled supercup must not take down the whole calendar.
    const f = fixture(AJAX, 142)
    expect(() =>
      assertPublishable({
        fixtures: [f],
        entries: [entry(f)],
        myTeamId: AJAX,
        counts: [{ competition: 'johan-cruijff-schaal', fetched: 1, dropped: 1 }],
      }),
    ).not.toThrow()
  })

  it('does not refuse a total wipe of 4 events, just below the wipe-guard threshold of 5', () => {
    const f = fixture(AJAX, 142)
    expect(() =>
      assertPublishable({
        fixtures: [f],
        entries: [entry(f)],
        myTeamId: AJAX,
        counts: [{ competition: 'johan-cruijff-schaal', fetched: 4, dropped: 4 }],
      }),
    ).not.toThrow()
  })

  it('refuses a total wipe of 5 events, exactly at the wipe-guard threshold of 5', () => {
    const f = fixture(AJAX, 142)
    expect(() =>
      assertPublishable({
        fixtures: [f],
        entries: [entry(f)],
        myTeamId: AJAX,
        counts: [{ competition: 'johan-cruijff-schaal', fetched: 5, dropped: 5 }],
      }),
    ).toThrow(GuardError)
  })

  it('still refuses a total wipe at large volume, above the wipe-guard threshold', () => {
    const f = fixture(AJAX, 142)
    expect(() =>
      assertPublishable({
        fixtures: [f],
        entries: [entry(f)],
        myTeamId: AJAX,
        counts: [{ competition: 'ucl', fetched: 189, dropped: 189 }],
      }),
    ).toThrow(GuardError)
  })
})
