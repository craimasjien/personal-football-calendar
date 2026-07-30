/**
 * A season is labelled by the calendar year it started in: 2026/27 is season 2026.
 * August–December belong to the season starting that year; January–July to the one
 * that started the year before.
 *
 * Derived from the date rather than configured, so season rollover needs no annual edit.
 */
export function seasonFor(now: Date): number {
  const month = now.getUTCMonth() // 0 = January
  const year = now.getUTCFullYear()
  const AUGUST = 7
  return month >= AUGUST ? year : year - 1
}

/**
 * The date range to ask ESPN for, in its YYYYMMDD format. 1 July to 1 July comfortably
 * brackets a European football season including early qualifiers and late finals.
 */
export function seasonWindow(season: number): { from: string; to: string } {
  return { from: `${season}0701`, to: `${season + 1}0701` }
}
