import { describe, expect, it } from 'vitest'
import type { CalendarEntry, CompetitionId, Fixture, Stage } from '../../src/domain.ts'
import { describe as describeFixture, summary } from '../../src/ics/dutch.ts'
import { toStage } from '../../src/source/stage.ts'

function fixture(
  competition: CompetitionId,
  stage: Stage,
  leg: 1 | 2 | null = null,
  homeName = 'Ajax Amsterdam',
  awayName = 'Feyenoord Rotterdam',
): Fixture {
  return {
    id: '1',
    competition,
    stage,
    leg,
    home: { id: 139, name: homeName },
    away: { id: 142, name: awayName },
    venue: null,
    kickoff: { kind: 'confirmed', utc: new Date('2026-03-15T13:30:00Z') },
  }
}

const entry = (f: Fixture, inclusion: 'required' | 'optional'): CalendarEntry => ({
  fixture: f,
  inclusion,
})

describe('summary', () => {
  it('joins the teams with "vs."', () => {
    expect(summary(entry(fixture('eredivisie', 'regular-season'), 'required'), {})).toBe(
      'Ajax Amsterdam vs. Feyenoord Rotterdam',
    )
  })

  it('prefixes optional entries with "Optioneel: "', () => {
    expect(summary(entry(fixture('eredivisie', 'regular-season'), 'optional'), {})).toBe(
      'Optioneel: Ajax Amsterdam vs. Feyenoord Rotterdam',
    )
  })

  it('applies display-name overrides to both sides', () => {
    const names = { 'Ajax Amsterdam': 'AFC Ajax', 'Feyenoord Rotterdam': 'Feyenoord' }
    expect(summary(entry(fixture('eredivisie', 'regular-season'), 'required'), names)).toBe(
      'AFC Ajax vs. Feyenoord',
    )
  })

  it('leaves names without an override untouched', () => {
    expect(
      summary(entry(fixture('eredivisie', 'regular-season', null, 'Telstar', 'Excelsior'), 'required'), {
        'Ajax Amsterdam': 'AFC Ajax',
      }),
    ).toBe('Telstar vs. Excelsior')
  })
})

describe('describe', () => {
  it('names a domestic league fixture by competition alone, since no matchday exists', () => {
    expect(describeFixture(fixture('eredivisie', 'regular-season'))).toBe('Eredivisie')
  })

  it('names a European league phase in Dutch', () => {
    expect(describeFixture(fixture('ucl', 'league-phase'))).toBe(
      'UEFA Champions League · Competitiefase',
    )
  })

  it('uses Dutch knockout round names', () => {
    expect(describeFixture(fixture('ucl', 'quarterfinals'))).toBe(
      'UEFA Champions League · Kwartfinale',
    )
    expect(describeFixture(fixture('ucl', 'semifinals'))).toBe(
      'UEFA Champions League · Halve finale',
    )
    expect(describeFixture(fixture('ucl', 'final'))).toBe('UEFA Champions League · Finale')
    expect(describeFixture(fixture('knvb-cup', 'round-of-16'))).toBe(
      'KNVB Beker · Achtste finale',
    )
    expect(describeFixture(fixture('uel', 'knockout-round-playoffs'))).toBe(
      'UEFA Europa League · Tussenronde',
    )
    expect(describeFixture(fixture('knvb-cup', 'first-round'))).toBe('KNVB Beker · Eerste ronde')
    expect(describeFixture(fixture('knvb-cup', 'second-round'))).toBe('KNVB Beker · Tweede ronde')
  })

  it('appends the leg for a two-legged tie', () => {
    expect(describeFixture(fixture('ucl', 'quarterfinals', 1))).toBe(
      'UEFA Champions League · Kwartfinale · Heenwedstrijd',
    )
    expect(describeFixture(fixture('ucl', 'quarterfinals', 2))).toBe(
      'UEFA Champions League · Kwartfinale · Returnwedstrijd',
    )
  })

  it('omits the leg for a single-match round', () => {
    expect(describeFixture(fixture('ucl', 'final', null))).not.toContain('wedstrijd')
  })

  it('describes a fixture with an unrecognised ESPN slug by competition alone, inventing no round', () => {
    // Real slugs like 'conference-league-playoffs---final' appear under ned.1 and are not
    // in STAGES. The fallback must not label them 'Competitiefase'.
    const f = fixture('eredivisie', toStage('conference-league-playoffs---final'))
    expect(describeFixture(f)).toBe('Eredivisie')
    expect(describeFixture(f)).not.toContain('Competitiefase')
  })

  it('never emits an English round name', () => {
    const english = /quarter|semi|round of|playoff|regular season|league phase/i
    const stages: Stage[] = [
      'regular-season',
      'league-phase',
      'first-round',
      'second-round',
      'knockout-round-playoffs',
      'round-of-16',
      'quarterfinals',
      'semifinals',
      'final',
    ]
    for (const stage of stages) {
      expect(describeFixture(fixture('ucl', stage))).not.toMatch(english)
    }
  })
})
