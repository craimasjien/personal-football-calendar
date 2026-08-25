import type { Fixture } from './domain.ts'
import { isDutchDomestic } from './source/competitions.ts'

/**
 * Every club that appeared in a Dutch domestic fixture — i.e. every club we can
 * show is Dutch, derived rather than configured.
 *
 * Deriving beats a hand-maintained list because the evidence arrives free: the
 * build already fetches the Eredivisie, the KNVB Beker and the Johan Cruijff
 * Schaal, and between them they name every Dutch club that could plausibly reach
 * Europe — promoted sides and cup-run minnows included — without anyone editing
 * config after a relegation.
 *
 * The trade-off is that this set is only as complete as the fetch that produced
 * it. That is survivable rather than silent: it can only ever make the calendar
 * miss an optional match, never mislabel one, and `assertPublishable` still
 * refuses to publish a wholesale data loss.
 */
export function dutchClubIds(fixtures: Fixture[]): Set<number> {
  const ids = new Set<number>()
  for (const fixture of fixtures) {
    if (!isDutchDomestic(fixture.competition)) continue
    ids.add(fixture.home.id)
    ids.add(fixture.away.id)
  }
  return ids
}
