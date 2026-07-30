import { describe, expect, it } from 'vitest'
import { classify } from '../src/classify.ts'
import type { ResolvedConfig } from '../src/config.ts'
import type { CompetitionId, Fixture, Stage } from '../src/domain.ts'

const AJAX = 139
const FEYENOORD = 142
const PSV = 148
const TWENTE = 152 // tier 2
const CAMBUUR = 3736 // tier 3
const HERACLES = 9001 // tier 3
const BARCELONA = 83 // elite
const UNITED = 360 // elite
const SLAVIA = 9002 // not elite
const BODO = 9003 // not elite

const CONFIG: ResolvedConfig = {
  myTeamId: AJAX,
  tier1: new Set([AJAX, PSV, FEYENOORD]),
  tier2: new Set([TWENTE]),
  europeElite: new Set([BARCELONA, UNITED]),
  bigEuropeanStageFrom: 'quarterfinals',
  displayNames: {},
}

function fixture(
  competition: CompetitionId,
  homeId: number,
  awayId: number,
  stage: Stage = 'regular-season',
): Fixture {
  return {
    id: '1',
    competition,
    stage,
    leg: null,
    home: { id: homeId, name: `team-${homeId}` },
    away: { id: awayId, name: `team-${awayId}` },
    venue: null,
    kickoff: { kind: 'confirmed', utc: new Date('2026-03-15T13:30:00Z') },
  }
}

describe('classify — rule 1: Ajax in Europe is always required', () => {
  it('includes an Ajax Champions League league-phase match', () => {
    expect(classify(fixture('ucl', AJAX, BARCELONA, 'league-phase'), CONFIG)).toBe('required')
  })

  it('includes an Ajax Conference League tie against a minor side', () => {
    expect(classify(fixture('uecl', AJAX, BODO, 'league-phase'), CONFIG)).toBe('required')
  })

  it('includes an Ajax Europa League away tie against a minor side', () => {
    expect(classify(fixture('uel', SLAVIA, AJAX, 'league-phase'), CONFIG)).toBe('required')
  })

  it('includes an Ajax play-off round tie, below the big-match threshold', () => {
    expect(
      classify(fixture('uecl', AJAX, BODO, 'knockout-round-playoffs'), CONFIG),
    ).toBe('required')
  })
})

describe('classify — rule 2: Ajax domestically depends on the opponent tier', () => {
  it('requires Ajax vs a tier 1 club', () => {
    expect(classify(fixture('eredivisie', AJAX, FEYENOORD), CONFIG)).toBe('required')
  })

  it('requires Ajax vs a tier 2 club', () => {
    expect(classify(fixture('eredivisie', AJAX, TWENTE), CONFIG)).toBe('required')
  })

  it('marks Ajax vs a tier 3 club optional', () => {
    expect(classify(fixture('eredivisie', AJAX, CAMBUUR), CONFIG)).toBe('optional')
  })

  it('applies the same rule when Ajax are away', () => {
    expect(classify(fixture('eredivisie', CAMBUUR, AJAX), CONFIG)).toBe('optional')
    expect(classify(fixture('eredivisie', FEYENOORD, AJAX), CONFIG)).toBe('required')
  })

  it('applies the same rule in the KNVB Cup', () => {
    expect(classify(fixture('knvb-cup', AJAX, CAMBUUR, 'first-round'), CONFIG)).toBe('optional')
    expect(classify(fixture('knvb-cup', AJAX, PSV, 'quarterfinals'), CONFIG)).toBe('required')
  })

  it('does not let a late cup round promote a small opponent to required', () => {
    expect(classify(fixture('knvb-cup', AJAX, CAMBUUR, 'final'), CONFIG)).toBe('optional')
  })
})

describe('classify — rule 3: big European matches without Ajax', () => {
  it('marks a quarter-final between two non-elite clubs optional', () => {
    expect(classify(fixture('ucl', SLAVIA, BODO, 'quarterfinals'), CONFIG)).toBe('optional')
  })

  it('excludes those same clubs in the league phase', () => {
    expect(classify(fixture('ucl', SLAVIA, BODO, 'league-phase'), CONFIG)).toBe('excluded')
  })

  it('marks a league-phase match between two elite clubs optional', () => {
    expect(classify(fixture('ucl', BARCELONA, UNITED, 'league-phase'), CONFIG)).toBe('optional')
  })

  it('excludes an elite club against a non-elite club before the quarter-finals', () => {
    expect(classify(fixture('ucl', BARCELONA, BODO, 'league-phase'), CONFIG)).toBe('excluded')
  })

  it('includes every stage at or beyond the threshold', () => {
    expect(classify(fixture('ucl', SLAVIA, BODO, 'semifinals'), CONFIG)).toBe('optional')
    expect(classify(fixture('ucl', SLAVIA, BODO, 'final'), CONFIG)).toBe('optional')
  })

  it('excludes stages below the threshold', () => {
    expect(classify(fixture('ucl', SLAVIA, BODO, 'round-of-16'), CONFIG)).toBe('excluded')
    expect(
      classify(fixture('ucl', SLAVIA, BODO, 'knockout-round-playoffs'), CONFIG),
    ).toBe('excluded')
  })

  it('respects a raised threshold', () => {
    const semisOnly: ResolvedConfig = { ...CONFIG, bigEuropeanStageFrom: 'semifinals' }
    expect(classify(fixture('ucl', SLAVIA, BODO, 'quarterfinals'), semisOnly)).toBe('excluded')
    expect(classify(fixture('ucl', SLAVIA, BODO, 'semifinals'), semisOnly)).toBe('optional')
  })

  it('excludes a non-elite home side against an elite away side before the threshold', () => {
    // Only fails if the elite check reads the away side twice instead of both sides.
    expect(classify(fixture('ucl', BODO, BARCELONA, 'league-phase'), CONFIG)).toBe('excluded')
  })
})

describe('classify — rule 4: big Eredivisie matches without Ajax', () => {
  it('marks a tier 1 vs tier 1 match optional', () => {
    expect(classify(fixture('eredivisie', PSV, FEYENOORD), CONFIG)).toBe('optional')
  })

  it('excludes tier 1 vs tier 3', () => {
    expect(classify(fixture('eredivisie', PSV, HERACLES), CONFIG)).toBe('excluded')
  })

  it('excludes tier 1 vs tier 2', () => {
    expect(classify(fixture('eredivisie', PSV, TWENTE), CONFIG)).toBe('excluded')
  })

  it('excludes tier 3 vs tier 3', () => {
    expect(classify(fixture('eredivisie', CAMBUUR, HERACLES), CONFIG)).toBe('excluded')
  })

  it('excludes a tier 3 home side against a tier 1 away side', () => {
    // Only fails if the tier1 check reads the away side twice instead of both sides.
    expect(classify(fixture('eredivisie', HERACLES, PSV), CONFIG)).toBe('excluded')
  })
})

describe('classify — the KNVB Cup without Ajax is never included', () => {
  it('excludes a cup tie between two tier 1 clubs', () => {
    expect(classify(fixture('knvb-cup', PSV, FEYENOORD, 'semifinals'), CONFIG)).toBe('excluded')
  })

  it('excludes the cup final without Ajax', () => {
    expect(classify(fixture('knvb-cup', PSV, FEYENOORD, 'final'), CONFIG)).toBe('excluded')
  })
})
