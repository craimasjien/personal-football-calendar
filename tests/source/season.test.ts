import { describe, expect, it } from 'vitest'
import { MAX_RANGE_DAYS, seasonFor, seasonWindow } from '../../src/source/season.ts'

const DAY_MS = 86_400_000

/** Length of an ESPN `dates=from-to` range, in days. */
function spanInDays({ from, to }: { from: string; to: string }): number {
  const parse = (d: string) =>
    Date.UTC(Number(d.slice(0, 4)), Number(d.slice(4, 6)) - 1, Number(d.slice(6, 8)))
  return (parse(to) - parse(from)) / DAY_MS
}

describe('seasonFor', () => {
  it('treats August as the start of a new season', () => {
    expect(seasonFor(new Date('2026-08-01T00:00:00Z'))).toBe(2026)
  })

  it('treats July as still belonging to the previous season', () => {
    expect(seasonFor(new Date('2026-07-31T23:59:59Z'))).toBe(2025)
  })

  it('keeps December in the season that started that year', () => {
    expect(seasonFor(new Date('2026-12-31T00:00:00Z'))).toBe(2026)
  })

  it('keeps January in the season that started the previous year', () => {
    expect(seasonFor(new Date('2027-01-01T00:00:00Z'))).toBe(2026)
  })

  it('keeps May in the season that started the previous year', () => {
    expect(seasonFor(new Date('2027-05-20T00:00:00Z'))).toBe(2026)
  })
})

describe('seasonWindow', () => {
  it('spans 1 July to 30 June of the following year, in ESPN date format', () => {
    expect(seasonWindow(2026)).toEqual({ from: '20260701', to: '20270630' })
  })

  it('handles a different season', () => {
    expect(seasonWindow(2025)).toEqual({ from: '20250701', to: '20260630' })
  })

  /**
   * ESPN answers HTTP 400 for any range longer than 365 days. A 1-July-to-1-July
   * window is 366 days whenever the season contains a leap day, which is exactly
   * what took the build down: on 1 August 2026 `seasonFor` began reporting 2026, so
   * build.ts asked for seasonWindow(2027) = 20270701-20280701 — 366 days, because
   * 2028 is a leap year.
   */
  it("never exceeds ESPN's range cap, including seasons containing a leap day", () => {
    for (let season = 2024; season <= 2044; season++) {
      const window = seasonWindow(season)
      expect(spanInDays(window), `season ${season} window ${window.from}-${window.to}`).
        toBeLessThanOrEqual(MAX_RANGE_DAYS)
    }
  })

  it('is at its longest across a leap day, and still within the cap', () => {
    expect(spanInDays(seasonWindow(2027))).toBe(365)
    expect(spanInDays(seasonWindow(2026))).toBe(364)
  })

  /**
   * build.ts fetches seasonWindow(season) and seasonWindow(season + 1). Ending on
   * 30 June instead of 1 July must not open a one-day hole between them.
   */
  it('tiles consecutive seasons with no gap', () => {
    const first = seasonWindow(2026)
    const second = seasonWindow(2027)
    expect(spanInDays({ from: first.to, to: second.from })).toBe(1)
  })
})
