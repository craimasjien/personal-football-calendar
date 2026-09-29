import type { CalendarEntry, Fixture, Stage } from '../domain.ts'
import { COMPETITIONS, isInternational } from '../source/competitions.ts'
import { DUTCH_COUNTRY } from './countries.ts'

const OPTIONAL_PREFIX = 'Optioneel: '

/**
 * Dutch label per stage. `null` means "add nothing" — a domestic league fixture
 * is just "Eredivisie", because ESPN provides no matchday number to append.
 */
const DUTCH_STAGE: Record<Stage, string | null> = {
  'regular-season': null,
  'league-phase': 'Competitiefase',
  'group-stage': 'Groepsfase',
  'first-round': 'Eerste ronde',
  'second-round': 'Tweede ronde',
  'third-round': 'Derde ronde',
  'playoff-round': 'Play-offronde',
  'knockout-round-playoffs': 'Tussenronde',
  'round-of-32': 'Zestiende finale',
  'round-of-16': 'Achtste finale',
  quarterfinals: 'Kwartfinale',
  semifinals: 'Halve finale',
  '3rd-place-match': 'Troostfinale',
  final: 'Finale',
}

const DUTCH_LEG: Record<1 | 2, string> = {
  1: 'Heenwedstrijd',
  2: 'Returnwedstrijd',
}

/**
 * Configured overrides win. Otherwise a national team gets its Dutch country name —
 * only in international competitions, so a club never collides with a country.
 */
function display(name: string, displayNames: Record<string, string>, international: boolean): string {
  return displayNames[name] ?? (international ? DUTCH_COUNTRY[name] : undefined) ?? name
}

export function summary(entry: CalendarEntry, displayNames: Record<string, string>): string {
  const { home, away, competition } = entry.fixture
  const intl = isInternational(competition)
  const title = `${display(home.name, displayNames, intl)} vs. ${display(away.name, displayNames, intl)}`
  return entry.inclusion === 'optional' ? `${OPTIONAL_PREFIX}${title}` : title
}

export function describe(fixture: Fixture): string {
  const parts: string[] = [COMPETITIONS[fixture.competition].dutchName]

  const stage = DUTCH_STAGE[fixture.stage]
  if (stage !== null) parts.push(stage)

  if (fixture.leg !== null) parts.push(DUTCH_LEG[fixture.leg])

  return parts.join(' · ')
}
