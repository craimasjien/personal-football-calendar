import type { CalendarEntry, Fixture } from './domain.ts'

export class GuardError extends Error {}

/**
 * Minimum events before "everything was dropped" is evidence of anything.
 *
 * The Johan Cruijff Schaal returns exactly one fixture per season window, so a single
 * cancelled supercup would otherwise block the entire calendar — including my team's
 * matches. Below this threshold a total drop is indistinguishable from ordinary noise,
 * so it is reported as a warning by main.ts rather than treated as fatal.
 */
const MIN_EVENTS_FOR_WIPE_GUARD = 5

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
  counts: Array<{ competition: string; fetched: number; dropped: number }>
}): void {
  const { fixtures, entries, myTeamId, counts } = input

  // A competition that returned a meaningful number of events but mapped none means ESPN
  // changed shape for that feed. Without this the build goes green with a whole competition
  // missing — the per-competition warning alone is indistinguishable from a quiet
  // competition. The threshold matters: some competitions (the Johan Cruijff Schaal) return
  // as few as one event per season window, and a single cancelled fixture there is ordinary
  // noise, not a shape change — treating it as fatal would take down the whole calendar,
  // Ajax's own matches included, over a total sample size of one.
  const wiped = counts.filter(
    (c) => c.fetched >= MIN_EVENTS_FOR_WIPE_GUARD && c.dropped === c.fetched,
  )
  if (wiped.length > 0) {
    const names = wiped.map((c) => `${c.competition} (${c.fetched} events)`).join(', ')
    throw new GuardError(
      `Every event was unmappable for: ${names} — refusing to publish. ` +
        'ESPN has probably changed the shape of that feed.',
    )
  }

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
