import { describe, expect, it } from 'vitest'
import { seasonFor, seasonWindow } from '../../src/source/season.ts'

const DAY_MS = 86_400_000

/** Distance between two YYYYMMDD dates, in days. */
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
   * build.ts fetches seasonWindow(season) and seasonWindow(season + 1). Ending on
   * 30 June instead of 1 July must not open a one-day hole between them.
   */
  it('tiles consecutive seasons with no gap', () => {
    const first = seasonWindow(2026)
    const second = seasonWindow(2027)
    expect(spanInDays({ from: first.to, to: second.from })).toBe(1)
  })

  it('tiles without a gap across a leap day too', () => {
    for (let season = 2024; season <= 2044; season++) {
      const gap = spanInDays({ from: seasonWindow(season).to, to: seasonWindow(season + 1).from })
      expect(gap, `seasons ${season} and ${season + 1}`).toBe(1)
    }
  })
})
