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

/**
 * No club is known to be Dutch. Every rule-1 to rule-4 case below is asserted
 * against this, so it proves those rules still hold without help from rule 3d.
 */
const NO_DUTCH: ReadonlySet<number> = new Set()

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
    expect(classify(fixture('ucl', AJAX, BARCELONA, 'league-phase'), CONFIG, NO_DUTCH)).toBe('required')
  })

  it('includes an Ajax Conference League tie against a minor side', () => {
    expect(classify(fixture('uecl', AJAX, BODO, 'league-phase'), CONFIG, NO_DUTCH)).toBe('required')
  })

  it('includes an Ajax Europa League away tie against a minor side', () => {
    expect(classify(fixture('uel', SLAVIA, AJAX, 'league-phase'), CONFIG, NO_DUTCH)).toBe('required')
  })

  it('includes an Ajax play-off round tie, below the big-match threshold', () => {
    expect(
      classify(fixture('uecl', AJAX, BODO, 'knockout-round-playoffs'), CONFIG, NO_DUTCH),
    ).toBe('required')
  })

  it('requires an Ajax European final, which rule 3b would otherwise mark optional', () => {
    // Rule 3b admits any final on stage alone, ignoring club identity. Rule 1 must win.
    expect(classify(fixture('uel', AJAX, BODO, 'final'), CONFIG, NO_DUTCH)).toBe('required')
    expect(classify(fixture('ucl', BODO, AJAX, 'final'), CONFIG, NO_DUTCH)).toBe('required')
  })

  it('requires an Ajax quarter-final against a non-elite side, which 3c would exclude', () => {
    // 3c needs >=1 elite club; rule 1 must not depend on that.
    expect(classify(fixture('uecl', AJAX, BODO, 'quarterfinals'), CONFIG, NO_DUTCH)).toBe('required')
  })
})

describe('classify — rule 2: Ajax domestically depends on the opponent tier', () => {
  it('requires Ajax vs a tier 1 club', () => {
    expect(classify(fixture('eredivisie', AJAX, FEYENOORD), CONFIG, NO_DUTCH)).toBe('required')
  })

  it('requires Ajax vs a tier 2 club', () => {
    expect(classify(fixture('eredivisie', AJAX, TWENTE), CONFIG, NO_DUTCH)).toBe('required')
  })

  it('marks Ajax vs a tier 3 club optional', () => {
    expect(classify(fixture('eredivisie', AJAX, CAMBUUR), CONFIG, NO_DUTCH)).toBe('optional')
  })

  it('applies the same rule when Ajax are away', () => {
    expect(classify(fixture('eredivisie', CAMBUUR, AJAX), CONFIG, NO_DUTCH)).toBe('optional')
    expect(classify(fixture('eredivisie', FEYENOORD, AJAX), CONFIG, NO_DUTCH)).toBe('required')
  })

  it('applies the same rule in the KNVB Cup', () => {
    expect(classify(fixture('knvb-cup', AJAX, CAMBUUR, 'first-round'), CONFIG, NO_DUTCH)).toBe('optional')
    expect(classify(fixture('knvb-cup', AJAX, PSV, 'quarterfinals'), CONFIG, NO_DUTCH)).toBe('required')
  })

  it('does not let a late cup round promote a small opponent to required', () => {
    expect(classify(fixture('knvb-cup', AJAX, CAMBUUR, 'final'), CONFIG, NO_DUTCH)).toBe('optional')
  })
})

// Rule 3 change (owner-approved): a non-elite pairing below the final is
// EXCLUDED even at or beyond the stage threshold — it now takes at least one
// elite club to admit a late-stage match. Do not "restore" the old behaviour
// of admitting any late-stage match regardless of who's playing; that was
// the exact defect the owner flagged (28 Optional entries with no elite
// club on either side).
describe('classify — rule 3: big European matches without Ajax', () => {
  it('marks a league-phase match between two elite clubs optional (3a)', () => {
    expect(classify(fixture('ucl', BARCELONA, UNITED, 'league-phase'), CONFIG, NO_DUTCH)).toBe('optional')
  })

  it('marks a quarter-final between two elite clubs optional', () => {
    expect(classify(fixture('ucl', BARCELONA, UNITED, 'quarterfinals'), CONFIG, NO_DUTCH)).toBe('optional')
  })

  it('excludes a quarter-final between two non-elite clubs (owner-approved behaviour change)', () => {
    expect(classify(fixture('ucl', SLAVIA, BODO, 'quarterfinals'), CONFIG, NO_DUTCH)).toBe('excluded')
  })

  it('excludes a semi-final between two non-elite clubs', () => {
    expect(classify(fixture('ucl', SLAVIA, BODO, 'semifinals'), CONFIG, NO_DUTCH)).toBe('excluded')
  })

  it('marks a quarter-final optional with one elite club, elite at home (3c)', () => {
    expect(classify(fixture('ucl', BARCELONA, BODO, 'quarterfinals'), CONFIG, NO_DUTCH)).toBe('optional')
  })

  it('marks a quarter-final optional with one elite club, elite away (3c)', () => {
    expect(classify(fixture('ucl', BODO, BARCELONA, 'quarterfinals'), CONFIG, NO_DUTCH)).toBe('optional')
  })

  it('excludes one elite club at round-of-16, below the threshold', () => {
    expect(classify(fixture('ucl', BARCELONA, BODO, 'round-of-16'), CONFIG, NO_DUTCH)).toBe('excluded')
  })

  it('excludes one elite club in the league phase', () => {
    expect(classify(fixture('ucl', BARCELONA, BODO, 'league-phase'), CONFIG, NO_DUTCH)).toBe('excluded')
  })

  it('excludes two non-elite clubs in the league phase', () => {
    expect(classify(fixture('ucl', SLAVIA, BODO, 'league-phase'), CONFIG, NO_DUTCH)).toBe('excluded')
  })

  it('excludes stages below the threshold', () => {
    expect(classify(fixture('ucl', SLAVIA, BODO, 'round-of-16'), CONFIG, NO_DUTCH)).toBe('excluded')
    expect(
      classify(fixture('ucl', SLAVIA, BODO, 'knockout-round-playoffs'), CONFIG, NO_DUTCH),
    ).toBe('excluded')
  })

  it('marks a final between two non-elite clubs optional in all three competitions (3b)', () => {
    expect(classify(fixture('ucl', SLAVIA, BODO, 'final'), CONFIG, NO_DUTCH)).toBe('optional')
    expect(classify(fixture('uel', SLAVIA, BODO, 'final'), CONFIG, NO_DUTCH)).toBe('optional')
    expect(classify(fixture('uecl', SLAVIA, BODO, 'final'), CONFIG, NO_DUTCH)).toBe('optional')
  })

  it('applies the elite rules in the Europa and Conference Leagues too, not just the Champions League', () => {
    // 3a — two elite clubs, league phase, in each competition.
    expect(classify(fixture('uel', BARCELONA, UNITED, 'league-phase'), CONFIG, NO_DUTCH)).toBe('optional')
    expect(classify(fixture('uecl', BARCELONA, UNITED, 'league-phase'), CONFIG, NO_DUTCH)).toBe('optional')

    // 3c — one elite club at the threshold, in each competition.
    expect(classify(fixture('uel', BARCELONA, BODO, 'quarterfinals'), CONFIG, NO_DUTCH)).toBe('optional')
    expect(classify(fixture('uecl', BODO, BARCELONA, 'quarterfinals'), CONFIG, NO_DUTCH)).toBe('optional')

    // And the corresponding exclusions, so the above are not passing for the wrong reason.
    expect(classify(fixture('uel', SLAVIA, BODO, 'quarterfinals'), CONFIG, NO_DUTCH)).toBe('excluded')
    expect(classify(fixture('uecl', BARCELONA, BODO, 'round-of-16'), CONFIG, NO_DUTCH)).toBe('excluded')
  })

  it('respects a raised threshold', () => {
    const semisOnly: ResolvedConfig = { ...CONFIG, bigEuropeanStageFrom: 'semifinals' }
    expect(classify(fixture('ucl', BARCELONA, BODO, 'quarterfinals'), semisOnly, NO_DUTCH)).toBe('excluded')
    expect(classify(fixture('ucl', BARCELONA, BODO, 'semifinals'), semisOnly, NO_DUTCH)).toBe('optional')
  })

  it('excludes a non-elite home side against an elite away side before the threshold', () => {
    // Only fails if the elite check reads the away side twice instead of both sides.
    expect(classify(fixture('ucl', BODO, BARCELONA, 'league-phase'), CONFIG, NO_DUTCH)).toBe('excluded')
  })
})

describe('classify — rule 4: big Eredivisie matches without Ajax', () => {
  it('marks a tier 1 vs tier 1 match optional', () => {
    expect(classify(fixture('eredivisie', PSV, FEYENOORD), CONFIG, NO_DUTCH)).toBe('optional')
  })

  it('excludes tier 1 vs tier 3', () => {
    expect(classify(fixture('eredivisie', PSV, HERACLES), CONFIG, NO_DUTCH)).toBe('excluded')
  })

  it('excludes tier 1 vs tier 2', () => {
    expect(classify(fixture('eredivisie', PSV, TWENTE), CONFIG, NO_DUTCH)).toBe('excluded')
  })

  it('excludes tier 3 vs tier 3', () => {
    expect(classify(fixture('eredivisie', CAMBUUR, HERACLES), CONFIG, NO_DUTCH)).toBe('excluded')
  })

  it('excludes a tier 3 home side against a tier 1 away side', () => {
    // Only fails if the tier1 check reads the away side twice instead of both sides.
    expect(classify(fixture('eredivisie', HERACLES, PSV), CONFIG, NO_DUTCH)).toBe('excluded')
  })
})

describe('classify — the KNVB Cup without Ajax is never included', () => {
  it('excludes a cup tie between two tier 1 clubs', () => {
    expect(classify(fixture('knvb-cup', PSV, FEYENOORD, 'semifinals'), CONFIG, NO_DUTCH)).toBe('excluded')
  })

  it('excludes the cup final without Ajax', () => {
    expect(classify(fixture('knvb-cup', PSV, FEYENOORD, 'final'), CONFIG, NO_DUTCH)).toBe('excluded')
  })
})

describe('classify — UEFA qualifying is European, so rule 1 covers it', () => {
  it('requires Ajax in the Conference League qualifying second round (tonight\'s match)', () => {
    // AFC Ajax vs. Vojvodina, second-round leg 2, 30 July 2026 — the gap this
    // change closes. Rule 1 must fire here exactly as it does for the league phase.
    expect(classify(fixture('uecl-qual', AJAX, HERACLES, 'second-round'), CONFIG, NO_DUTCH)).toBe('required')
  })

  it('requires Ajax in the Champions League qualifying third round', () => {
    expect(classify(fixture('ucl-qual', AJAX, HERACLES, 'third-round'), CONFIG, NO_DUTCH)).toBe('required')
  })

  it('excludes two non-elite clubs in the Conference League qualifying play-off round', () => {
    // ~150-256 UECL qualifying events per season; almost none should land without
    // Ajax or an elite club involved, and playoff-round sits below the big-match
    // threshold (quarterfinals), so rule 3c does not admit it either.
    expect(classify(fixture('uecl-qual', SLAVIA, BODO, 'playoff-round'), CONFIG, NO_DUTCH)).toBe('excluded')
  })
})

describe('classify — the Johan Cruijff Schaal, a non-European domestic fixture', () => {
  it('requires Ajax vs a tier 1 club', () => {
    expect(classify(fixture('johan-cruijff-schaal', AJAX, PSV), CONFIG, NO_DUTCH)).toBe('required')
  })

  it('marks Ajax vs a tier 3 club optional', () => {
    expect(classify(fixture('johan-cruijff-schaal', AJAX, CAMBUUR), CONFIG, NO_DUTCH)).toBe('optional')
  })

  it('excludes two tier 1 clubs without Ajax (rule 4 is Eredivisie-only)', () => {
    // Exactly this Sunday's PSV vs. AZ: rule 4 only ever fires for competition ===
    // 'eredivisie', so a big non-Ajax Johan Cruijff Schaal match is never included,
    // even though both sides here are tier 1.
    expect(classify(fixture('johan-cruijff-schaal', PSV, FEYENOORD), CONFIG, NO_DUTCH)).toBe('excluded')
  })
})

describe('classify — friendlies, a non-European domestic fixture', () => {
  it('marks Ajax vs a tier 3 club optional', () => {
    expect(classify(fixture('friendly', AJAX, CAMBUUR), CONFIG, NO_DUTCH)).toBe('optional')
  })
})

describe('classify — rule 3d: any Dutch club in Europe', () => {
  // The Dutch set is derived from domestic fixtures at build time, so here it is
  // supplied directly. PSV and Feyenoord are also tier 1, so DUTCH deliberately
  // includes clubs of every tier — the rule must not depend on tier at all.
  const DUTCH = new Set([AJAX, PSV, FEYENOORD, TWENTE, CAMBUUR, HERACLES])

  it('marks a Dutch club in a Champions League qualifying round optional', () => {
    expect(classify(fixture('ucl-qual', PSV, SLAVIA, 'second-round'), CONFIG, DUTCH)).toBe(
      'optional',
    )
  })

  it('marks a Dutch club in the July first qualifying round optional', () => {
    // "Pre-season" in practice: UEFA's earliest rounds are played in July.
    expect(classify(fixture('uecl-qual', HERACLES, BODO, 'first-round'), CONFIG, DUTCH)).toBe(
      'optional',
    )
  })

  it('marks a Dutch club in a qualifying play-off round optional', () => {
    expect(classify(fixture('uel-qual', TWENTE, BODO, 'playoff-round'), CONFIG, DUTCH)).toBe(
      'optional',
    )
  })

  it('marks a Dutch club in the league phase optional', () => {
    // Below bigEuropeanStageFrom and against a non-elite side, so rules 3a-3c
    // all decline it — this can only pass because of rule 3d.
    expect(classify(fixture('uecl', CAMBUUR, BODO, 'league-phase'), CONFIG, DUTCH)).toBe('optional')
  })

  it('marks a Dutch club in the February knockout play-offs optional', () => {
    expect(
      classify(fixture('uel', FEYENOORD, SLAVIA, 'knockout-round-playoffs'), CONFIG, DUTCH),
    ).toBe('optional')
  })

  it('marks a Dutch club in a European final optional', () => {
    expect(classify(fixture('uecl', HERACLES, BODO, 'final'), CONFIG, DUTCH)).toBe('optional')
  })

  it('applies to the away side too', () => {
    expect(classify(fixture('ucl', BODO, TWENTE, 'league-phase'), CONFIG, DUTCH)).toBe('optional')
  })

  it('applies to a Dutch club that is in no configured tier', () => {
    // A promoted or cup-run side nobody listed in config/teams.ts still counts:
    // being Dutch is derived from fixtures, not from tier membership.
    const promoted = 9099
    const dutch = new Set([...DUTCH, promoted])
    expect(classify(fixture('uecl-qual', promoted, BODO, 'first-round'), CONFIG, dutch)).toBe(
      'optional',
    )
  })

  it('still excludes a European tie with no Dutch and no elite club', () => {
    expect(classify(fixture('uecl', SLAVIA, BODO, 'league-phase'), CONFIG, DUTCH)).toBe('excluded')
  })

  it('does not leak into domestic competitions', () => {
    // Two Dutch clubs meeting in the cup without Ajax stays excluded: rule 3d is
    // inside the European branch, so it cannot widen the domestic rules.
    expect(classify(fixture('knvb-cup', CAMBUUR, HERACLES), CONFIG, DUTCH)).toBe('excluded')
    expect(classify(fixture('friendly', CAMBUUR, HERACLES), CONFIG, DUTCH)).toBe('excluded')
    expect(classify(fixture('johan-cruijff-schaal', PSV, FEYENOORD), CONFIG, DUTCH)).toBe(
      'excluded',
    )
  })

  it('leaves Ajax in Europe required, not downgraded to optional', () => {
    // Rule 1 runs before rule 3d, so Ajax is unaffected by this change.
    expect(classify(fixture('ucl', AJAX, BODO, 'league-phase'), CONFIG, DUTCH)).toBe('required')
    expect(classify(fixture('uecl-qual', AJAX, SLAVIA, 'first-round'), CONFIG, DUTCH)).toBe(
      'required',
    )
    expect(classify(fixture('uel', SLAVIA, AJAX, 'league-phase'), CONFIG, DUTCH)).toBe('required')
  })
})
