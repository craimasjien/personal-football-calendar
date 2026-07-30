/**
 * Ordered stage scale. Values mirror ESPN's `season.slug` verbatim so no lossy
 * translation is needed. Index order is meaningful — see classify.ts.
 *
 * 'regular-season' and 'league-phase' both mean "not a knockout round"; they sit
 * at the bottom so any threshold comparison excludes them.
 */
export const STAGES = [
  'regular-season',
  'league-phase',
  'first-round',
  'second-round',
  'knockout-round-playoffs',
  'round-of-16',
  'quarterfinals',
  'semifinals',
  'final',
] as const
export type Stage = (typeof STAGES)[number]

export const COMPETITION_IDS = ['eredivisie', 'knvb-cup', 'ucl', 'uel', 'uecl'] as const
export type CompetitionId = (typeof COMPETITION_IDS)[number]

export type Team = {
  /** ESPN team ID. The only field ever compared. */
  id: number
  /** ESPN display name, e.g. "Ajax Amsterdam". Mapped through displayNames for output. */
  name: string
}

export type Venue = { name: string; city: string }

export type Kickoff =
  | { kind: 'confirmed'; utc: Date }
  /** `date` is YYYY-MM-DD in Europe/Amsterdam. Kickoff time not yet fixed. */
  | { kind: 'provisional'; date: string }

export type Fixture = {
  /** ESPN event ID as a string. Becomes the ICS UID. */
  id: string
  competition: CompetitionId
  stage: Stage
  /** Leg of a two-legged knockout tie, else null. */
  leg: 1 | 2 | null
  home: Team
  away: Team
  venue: Venue | null
  kickoff: Kickoff
}

export type Inclusion = 'required' | 'optional' | 'excluded'

export type CalendarEntry = {
  fixture: Fixture
  /** Excluded fixtures never become entries. */
  inclusion: 'required' | 'optional'
}
