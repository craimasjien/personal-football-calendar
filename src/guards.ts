import type { CalendarEntry, Fixture } from './domain.ts'

export class GuardError extends Error {}

/**
 * Refuse to publish a calendar we are not confident in.
 *
 * GitHub Pages keeps serving the last successful file, so aborting degrades to
 * a slightly stale calendar rather than an empty one — which makes bailing out
 * the safe default. This matters more than usual here: the data source is an
 * undocumented API that could change shape without notice.
 *
 * Note what is deliberately *not* guarded: per-competition emptiness. The KNVB
 * Beker has no scheduled fixtures in early August and European competitions sit
 * empty between draws, so that check would fire falsely and often. Guarding on
 * my team's fixtures and on the total event count catches wholesale data loss
 * without turning normal calendar gaps into red builds.
 */
export function assertPublishable(input: {
  fixtures: Fixture[]
  entries: CalendarEntry[]
  myTeamId: number
}): void {
  const { fixtures, entries, myTeamId } = input

  const mine = fixtures.filter((f) => f.home.id === myTeamId || f.away.id === myTeamId)
  if (mine.length === 0) {
    throw new GuardError(
      `Found no fixtures for team ${myTeamId} in the whole season — refusing to publish. ` +
        'This means a changed competition code, a season-derivation bug, or a provider outage.',
    )
  }

  if (entries.length === 0) {
    throw new GuardError('The rendered calendar would contain zero events — refusing to publish.')
  }
}
