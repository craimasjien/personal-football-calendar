import type { CalendarEntry, Fixture, Stage } from '../domain.ts'
import { COMPETITIONS } from '../source/competitions.ts'

const OPTIONAL_PREFIX = 'Optioneel: '

/**
 * Dutch label per stage. `null` means "add nothing" — a domestic league fixture
 * is just "Eredivisie", because ESPN provides no matchday number to append.
 */
const DUTCH_STAGE: Record<Stage, string | null> = {
  'regular-season': null,
  'league-phase': 'Competitiefase',
  'first-round': 'Eerste ronde',
  'second-round': 'Tweede ronde',
  'knockout-round-playoffs': 'Tussenronde',
  'round-of-16': 'Achtste finale',
  quarterfinals: 'Kwartfinale',
  semifinals: 'Halve finale',
  final: 'Finale',
}

const DUTCH_LEG: Record<1 | 2, string> = {
  1: 'Heenwedstrijd',
  2: 'Returnwedstrijd',
}

function display(name: string, displayNames: Record<string, string>): string {
  return displayNames[name] ?? name
}

export function summary(entry: CalendarEntry, displayNames: Record<string, string>): string {
  const { home, away } = entry.fixture
  const title = `${display(home.name, displayNames)} vs. ${display(away.name, displayNames)}`
  return entry.inclusion === 'optional' ? `${OPTIONAL_PREFIX}${title}` : title
}

export function describe(fixture: Fixture): string {
  const parts: string[] = [COMPETITIONS[fixture.competition].dutchName]

  const stage = DUTCH_STAGE[fixture.stage]
  if (stage !== null) parts.push(stage)

  if (fixture.leg !== null) parts.push(DUTCH_LEG[fixture.leg])

  return parts.join(' · ')
}
