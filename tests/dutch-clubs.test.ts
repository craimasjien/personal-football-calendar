import { describe, expect, it } from 'vitest'
import { dutchClubIds } from '../src/dutch-clubs.ts'
import type { CompetitionId, Fixture } from '../src/domain.ts'

const AJAX = 139
const FEYENOORD = 142
const TELSTAR = 3735 // Eerste Divisie — only ever seen in the cup
const BARCELONA = 83
const SLAVIA = 9002

function fixture(competition: CompetitionId, homeId: number, awayId: number): Fixture {
  return {
    id: `${competition}-${homeId}-${awayId}`,
    competition,
    stage: 'regular-season',
    leg: null,
    home: { id: homeId, name: `team-${homeId}` },
    away: { id: awayId, name: `team-${awayId}` },
    venue: null,
    kickoff: { kind: 'confirmed', utc: new Date('2026-03-15T13:30:00Z') },
  }
}

describe('dutchClubIds', () => {
  it('collects both clubs from an Eredivisie fixture', () => {
    expect(dutchClubIds([fixture('eredivisie', AJAX, FEYENOORD)])).toEqual(
      new Set([AJAX, FEYENOORD]),
    )
  })

  it('collects lower-division clubs the cup reaches but the league never does', () => {
    // The whole point of deriving rather than hand-listing: a Telstar or an
    // amateur side can win through to Europe without ever playing an Eredivisie game.
    expect(dutchClubIds([fixture('knvb-cup', TELSTAR, AJAX)])).toEqual(new Set([TELSTAR, AJAX]))
  })

  it('collects from the Johan Cruijff Schaal', () => {
    expect(dutchClubIds([fixture('johan-cruijff-schaal', AJAX, FEYENOORD)])).toEqual(
      new Set([AJAX, FEYENOORD]),
    )
  })

  it('ignores European fixtures, so a foreign opponent is never marked Dutch', () => {
    expect(dutchClubIds([fixture('ucl', AJAX, BARCELONA)])).toEqual(new Set())
  })

  it('ignores friendlies, which say nothing about nationality', () => {
    expect(dutchClubIds([fixture('friendly', AJAX, SLAVIA)])).toEqual(new Set())
  })

  it('takes the union across competitions and deduplicates', () => {
    const ids = dutchClubIds([
      fixture('eredivisie', AJAX, FEYENOORD),
      fixture('knvb-cup', AJAX, TELSTAR),
      fixture('ucl', AJAX, BARCELONA),
    ])
    expect(ids).toEqual(new Set([AJAX, FEYENOORD, TELSTAR]))
  })

  it('is empty for no fixtures', () => {
    expect(dutchClubIds([])).toEqual(new Set())
  })
})
