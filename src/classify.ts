import type { ResolvedConfig } from './config.ts'
import { STAGES, type Fixture, type Inclusion, type Stage } from './domain.ts'
import { isEuropean } from './source/competitions.ts'

/** True when `stage` is at or beyond `threshold` on the ordered stage scale. */
function atOrBeyond(stage: Stage, threshold: Stage): boolean {
  return STAGES.indexOf(stage) >= STAGES.indexOf(threshold)
}

/**
 * Decide whether a fixture belongs in the calendar, and how prominently.
 *
 * Rules are evaluated in order; the first match wins. Rule 1 deliberately
 * precedes rule 2 so that every Ajax match in Europe is required regardless
 * of opponent or stage.
 */
export function classify(fixture: Fixture, config: ResolvedConfig): Inclusion {
  const { home, away, competition, stage } = fixture
  const involvesMyTeam = home.id === config.myTeamId || away.id === config.myTeamId
  const european = isEuropean(competition)

  // Rule 1 — my team in Europe: always, no exceptions.
  if (involvesMyTeam && european) return 'required'

  // Rule 2 — my team domestically: depends on the opponent's tier.
  if (involvesMyTeam) {
    const opponentId = home.id === config.myTeamId ? away.id : home.id
    const notable = config.tier1.has(opponentId) || config.tier2.has(opponentId)
    return notable ? 'required' : 'optional'
  }

  // Rule 3 — big European matches: a late stage, or two elite clubs.
  if (european) {
    const lateStage = atOrBeyond(stage, config.bigEuropeanStageFrom)
    const bothElite = config.europeElite.has(home.id) && config.europeElite.has(away.id)
    return lateStage || bothElite ? 'optional' : 'excluded'
  }

  // Rule 4 — big Eredivisie matches: both clubs tier 1.
  if (competition === 'eredivisie') {
    const bothTier1 = config.tier1.has(home.id) && config.tier1.has(away.id)
    if (bothTier1) return 'optional'
  }

  return 'excluded'
}
