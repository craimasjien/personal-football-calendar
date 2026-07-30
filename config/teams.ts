import type { BigStageThreshold } from '../src/domain.ts'

export type RawConfig = {
  myTeam: string
  eredivisie: { tier1: string[]; tier2: string[] }
  europeElite: string[]
  bigEuropeanStageFrom: BigStageThreshold
  /** Provider name → the name to show in the calendar. */
  displayNames: Record<string, string>
}

export const rawConfig: RawConfig = {
  myTeam: 'Ajax Amsterdam',

  eredivisie: {
    tier1: ['Ajax Amsterdam', 'PSV Eindhoven', 'Feyenoord Rotterdam'],
    tier2: ['AZ Alkmaar', 'FC Twente', 'FC Utrecht'],
  },

  /**
   * Best-guess ESPN spellings. `npm run sync-teams` reports any it cannot
   * match, so expect to correct a few of these.
   */
  europeElite: [
    'Real Madrid',
    'Barcelona',
    'Bayern Munich',
    'Manchester City',
    'Liverpool',
    'Paris Saint-Germain',
    'Internazionale',
    'AC Milan',
    'Manchester United',
    'Arsenal',
    'Chelsea',
    'Atlético Madrid',
    'Borussia Dortmund',
    'Juventus',
    'Napoli',
    'Tottenham Hotspur',
  ],

  /** Quarter-finals onward count as big. 'semifinals' if the calendar feels crowded. */
  bigEuropeanStageFrom: 'quarterfinals',

  /** ESPN's names are not always what should appear in the calendar. */
  displayNames: {
    'Ajax Amsterdam': 'AFC Ajax',
    'Feyenoord Rotterdam': 'Feyenoord',
    'AZ Alkmaar': 'AZ',
    'PSV Eindhoven': 'PSV',
  },
}
