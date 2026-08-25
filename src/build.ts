import type { RawConfig } from '../config/teams.ts'
import { classify } from './classify.ts'
import { resolveConfig } from './config.ts'
import type { CalendarEntry, CompetitionId, Fixture } from './domain.ts'
import { dutchClubIds } from './dutch-clubs.ts'
import { assertPublishable } from './guards.ts'
import { render } from './ics/render.ts'
import { COMPETITIONS } from './source/competitions.ts'
import { fetchEvents as defaultFetchEvents } from './source/espn.ts'
import { mapEvent } from './source/map.ts'
import { seasonWindow } from './source/season.ts'

export type FetchEventsFn = (opts: {
  code: string
  from: string
  to: string
}) => Promise<unknown[]>

export type BuildDeps = {
  season: number
  rawConfig: RawConfig
  teamIds: Record<string, number>
  /** Injectable so tests never touch the network. */
  fetchEvents?: FetchEventsFn
}

export type CompetitionCount = {
  competition: CompetitionId
  /** Events ESPN returned, before mapping dropped any. */
  fetched: number
  /** Events mapEvent rejected — cancelled, or a shape we do not understand. */
  dropped: number
  required: number
  optional: number
}

export type BuildResult = {
  ics: string
  entries: CalendarEntry[]
  fixtures: Fixture[]
  counts: CompetitionCount[]
  /** Clubs derived to be Dutch from this run's domestic fixtures. Diagnostic. */
  dutchClubs: Set<number>
}

export async function buildCalendar(deps: BuildDeps): Promise<BuildResult> {
  const { season, rawConfig, teamIds } = deps
  const fetchEvents = deps.fetchEvents ?? defaultFetchEvents

  // Resolve config first: a typo in the club list should fail before we make
  // any network requests.
  const config = resolveConfig(rawConfig, teamIds)

  // Both the current and next season. In July `seasonFor` still reports the season that
  // is ending, so without the second window the calendar would contain nothing but
  // history for a month — and UEFA qualifiers, played in July, belong to the new season.
  const windows = [seasonWindow(season), seasonWindow(season + 1)]

  const fixtures: Fixture[] = []
  const counts: CompetitionCount[] = []
  const countsByCompetition = new Map<CompetitionId, CompetitionCount>()
  const seenFixtureIds = new Set<string>()

  // Pass 1 — fetch and map everything. Nothing is classified yet: whether a European
  // fixture belongs in the calendar can depend on the Dutch domestic feeds (rule 3d),
  // and those are not all in until this loop finishes. Classifying inside the loop
  // would quietly make the answer depend on the order of the COMPETITIONS keys.
  for (const [id, meta] of Object.entries(COMPETITIONS) as Array<
    [CompetitionId, (typeof COMPETITIONS)[CompetitionId]]
  >) {
    const rawEvents: unknown[] = []
    for (const window of windows) {
      rawEvents.push(...(await fetchEvents({ code: meta.code, from: window.from, to: window.to })))
    }

    const mapped = rawEvents
      .map((e) => mapEvent(e, id))
      .filter((f): f is Fixture => f !== null)

    const count: CompetitionCount = {
      competition: id,
      fetched: rawEvents.length,
      // Unmappable only — duplicates (ESPN has been seen returning the same event in
      // adjacent ranges, and a fixture can be rescheduled across a window boundary) are
      // silently skipped below, so the "every event dropped" signal stays meaningful.
      dropped: rawEvents.length - mapped.length,
      required: 0,
      optional: 0,
    }

    for (const fixture of mapped) {
      if (seenFixtureIds.has(fixture.id)) continue
      seenFixtureIds.add(fixture.id)
      fixtures.push(fixture)
    }

    counts.push(count)
    countsByCompetition.set(id, count)
  }

  // Which clubs are Dutch is evidence, not configuration — read it off the domestic
  // feeds now that all of them have been seen.
  const dutchClubs = dutchClubIds(fixtures)

  // Pass 2 — classify. `fixtures` is still in competition order, so entries come out
  // grouped exactly as before; render emits them in array order without sorting.
  const entries: CalendarEntry[] = []
  for (const fixture of fixtures) {
    const inclusion = classify(fixture, config, dutchClubs)
    if (inclusion === 'excluded') continue
    entries.push({ fixture, inclusion })
    const count = countsByCompetition.get(fixture.competition)
    if (count === undefined) continue
    if (inclusion === 'required') count.required++
    else count.optional++
  }

  assertPublishable({ fixtures, entries, myTeamId: config.myTeamId, counts })

  return { ics: render(entries, config.displayNames), entries, fixtures, counts, dutchClubs }
}
