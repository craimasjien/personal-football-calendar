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
 * The date range to ask ESPN for, in its YYYYMMDD format. 1 July to 30 June comfortably
 * brackets a European football season including early qualifiers and late finals.
 *
 * This is a statement about the season, not about the request ESPN receives: espn.ts
 * asks for whole calendar years and filters back down to this window, because ESPN
 * withdrew the `dates=FROM-TO` range syntax altogether. An earlier version of this file
 * ended the window on 30 June to stay under a 365-day range cap; that cap no longer
 * governs anything, since no range is ever sent.
 *
 * 30 June stays as the end anyway: build.ts fetches consecutive seasons, and this
 * window's 30 June is immediately followed by the next one's 1 July, so they tile with
 * neither gap nor overlap.
 */
export function seasonWindow(season: number): { from: string; to: string } {
  return { from: `${season}0701`, to: `${season + 1}0630` }
}
