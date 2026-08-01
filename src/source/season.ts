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
 * ESPN rejects any `dates=from-to` range longer than this with HTTP 400. Undocumented,
 * and verified against the live API: 20230701-20240630 (365 days) answers 200 while
 * 20230701-20240701 (366) answers 400, for every league code.
 */
export const MAX_RANGE_DAYS = 365

/**
 * The date range to ask ESPN for, in its YYYYMMDD format. 1 July to 30 June comfortably
 * brackets a European football season including early qualifiers and late finals.
 *
 * The window ends on 30 June rather than 1 July to stay inside MAX_RANGE_DAYS. A
 * 1-July-to-1-July window is 366 days whenever the season contains a leap day, and ESPN
 * answers 400 — which is what broke every build from 1 August 2026, the day `seasonFor`
 * started reporting 2026 and build.ts began asking for 20270701-20280701 (2028 being a
 * leap year). Ending on 30 June keeps every window at 364–365 days forever.
 *
 * Dropping 1 July loses no coverage: build.ts fetches consecutive seasons, and this
 * window's 30 June is immediately followed by the next one's 1 July.
 */
export function seasonWindow(season: number): { from: string; to: string } {
  return { from: `${season}0701`, to: `${season + 1}0630` }
}
