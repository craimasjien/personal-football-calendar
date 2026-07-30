import type { CompetitionId, Fixture, Kickoff, Team, Venue } from '../domain.ts'
import { toStage } from './stage.ts'

/** The shape we rely on from ESPN. Everything else in the response is ignored. */
type RawCompetitor = {
  homeAway?: string
  team?: { id?: string; displayName?: string }
}

type RawCompetition = {
  timeValid?: boolean
  leg?: { value?: number } | null
  venue?: { fullName?: string; address?: { city?: string } } | null
  competitors?: RawCompetitor[]
}

type RawEvent = {
  id?: string
  date?: string
  season?: { slug?: string } | null
  status?: { type?: { name?: string } } | null
  competitions?: RawCompetition[]
}

/** Events in these states must not appear in the calendar at all. */
const DROPPED_STATUSES = new Set(['STATUS_CANCELED', 'STATUS_CANCELLED'])

/** States where the listed kickoff time is not trustworthy. */
const PROVISIONAL_STATUSES = new Set(['STATUS_POSTPONED'])

/** Format an instant as a YYYY-MM-DD calendar day in Amsterdam. */
export function amsterdamDate(iso: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

function toTeam(raw: RawCompetitor | undefined): Team | null {
  const id = raw?.team?.id
  const name = raw?.team?.displayName
  if (id === undefined || name === undefined) return null
  const numericId = Number(id)
  if (!Number.isFinite(numericId)) return null
  return { id: numericId, name }
}

function toVenue(raw: RawCompetition['venue']): Venue | null {
  const name = raw?.fullName
  const city = raw?.address?.city
  // A venue without a city would render as a half address; omit it instead.
  if (!name || !city) return null
  return { name, city }
}

function toLeg(raw: RawCompetition['leg']): 1 | 2 | null {
  const value = raw?.value
  return value === 1 || value === 2 ? value : null
}

function toKickoff(date: string, competition: RawCompetition, status: string): Kickoff {
  // `timeValid: false` is ESPN's signal that the date is fixed but the kickoff
  // time is not. A missing value is treated the same way — better an all-day
  // event than a confidently wrong time on two phones.
  const timeIsKnown = competition.timeValid === true && !PROVISIONAL_STATUSES.has(status)
  if (!timeIsKnown) return { kind: 'provisional', date: amsterdamDate(date) }
  return { kind: 'confirmed', utc: new Date(date) }
}

/** Returns null when the event must not appear in the calendar. */
export function mapEvent(input: unknown, competition: CompetitionId): Fixture | null {
  if (input === null || typeof input !== 'object') return null
  const raw = input as RawEvent

  const status = raw.status?.type?.name ?? ''
  if (DROPPED_STATUSES.has(status)) return null

  const comp = raw.competitions?.[0]
  if (!comp || !raw.id || !raw.date) return null

  const home = toTeam(comp.competitors?.find((c) => c.homeAway === 'home'))
  const away = toTeam(comp.competitors?.find((c) => c.homeAway === 'away'))
  if (!home || !away) return null

  return {
    id: raw.id,
    competition,
    stage: toStage(raw.season?.slug),
    leg: toLeg(comp.leg),
    home,
    away,
    venue: toVenue(comp.venue),
    kickoff: toKickoff(raw.date, comp, status),
  }
}
