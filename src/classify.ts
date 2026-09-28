import type { ResolvedConfig } from './config.ts'
import { STAGES, type Fixture, type Inclusion, type Stage } from './domain.ts'
import { isEuropean, isInternational } from './source/competitions.ts'

/** True when `stage` is at or beyond `threshold` on the ordered stage scale. */
function atOrBeyond(stage: Stage, threshold: Stage): boolean {
  return STAGES.indexOf(stage) >= STAGES.indexOf(threshold)
}

/**
 * Decide whether a fixture belongs in the calendar, and how prominently.
 *
 * Rules are evaluated in order; the first match wins. Rule 0 handles national-team
 * football on its own and returns before any club rule runs, so nothing below it
 * ever sees an international fixture. Rule 1 deliberately precedes rule 2 so that
 * every Ajax match in Europe is required regardless of opponent or stage — and,
 * since rule 3d would otherwise catch Ajax too, that ordering is now what keeps
 * Ajax `required` rather than `optional`.
 *
 * `dutchClubs` is derived from fetched domestic fixtures rather than configured;
 * see dutch-clubs.ts. It has no default on purpose: a silently-empty set would
 * turn rule 3d off without failing anything, so an unwired call site should be a
 * type error instead.
 */
export function classify(
  fixture: Fixture,
  config: ResolvedConfig,
  dutchClubs: ReadonlySet<number>,
): Inclusion {
  const { home, away, competition, stage } = fixture

  // Rule 0 — my country: always, no exceptions. Numbered 0 rather than renumbering the
  // club rules, which the README, the spec and the tests all cite by number. Anchored on
  // the competition set as well as the id so an international fixture can never fall
  // through to the club rules: a World Cup final without the Netherlands is excluded
  // here, not left for rule 3b to mistake for a European final. Friendlies count too —
  // "non-optional" means every Oranje match, and there is no opponent tier for nations.
  if (isInternational(competition)) {
    const involvesMyCountry = home.id === config.myCountryId || away.id === config.myCountryId
    return involvesMyCountry ? 'required' : 'excluded'
  }

  const involvesMyTeam = home.id === config.myTeamId || away.id === config.myTeamId
  const european = isEuropean(competition)

  // Rule 1 — my team in Europe: always, no exceptions.
  if (involvesMyTeam && european) return 'required'

  // Rule 2 — my team domestically: depends on the opponent's tier. Reached for any
  // non-European competition — today that's 'eredivisie' and 'knvb-cup' — so adding a
  // new domestic competition later automatically includes my team's matches in it too.
  if (involvesMyTeam) {
    const opponentId = home.id === config.myTeamId ? away.id : home.id
    const notable = config.tier1.has(opponentId) || config.tier2.has(opponentId)
    return notable ? 'required' : 'optional'
  }

  // Rule 3 — big European matches. Three parts; see the spec for why.
  if (european) {
    const eliteCount =
      (config.europeElite.has(home.id) ? 1 : 0) + (config.europeElite.has(away.id) ? 1 : 0)

    // 3a — two elite clubs are a big night at any stage, league phase included.
    if (eliteCount === 2) return 'optional'

    // 3b — a European final is a European final, in all three competitions.
    if (stage === 'final') return 'optional'

    // 3c — a late round needs at least one elite club. Without this the threshold
    // admits Europa/Conference quarter-finals between clubs nobody asked about.
    if (atOrBeyond(stage, config.bigEuropeanStageFrom) && eliteCount >= 1) return 'optional'

    // 3d — any Dutch club, anywhere in Europe: qualifying rounds (played in July),
    // the play-off round, the league phase, the knockouts, the final. No tier and no
    // stage threshold applies, because the point is to see Dutch clubs in Europe at
    // all, not only when the tie is a big one. Ajax never reaches here — rule 1 took
    // it already — so this is every Dutch club *except* my own.
    if (dutchClubs.has(home.id) || dutchClubs.has(away.id)) return 'optional'

    return 'excluded'
  }

  // Rule 4 — big Eredivisie matches: both clubs tier 1.
  if (competition === 'eredivisie') {
    const bothTier1 = config.tier1.has(home.id) && config.tier1.has(away.id)
    if (bothTier1) return 'optional'
  }

  return 'excluded'
}
