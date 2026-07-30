import { describe, expect, it } from 'vitest'
import { seasonFor, seasonWindow } from '../../src/source/season.ts'

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
  it('spans 1 July to 1 July of the following year, in ESPN date format', () => {
    expect(seasonWindow(2026)).toEqual({ from: '20260701', to: '20270701' })
  })

  it('handles a different season', () => {
    expect(seasonWindow(2025)).toEqual({ from: '20250701', to: '20260701' })
  })
})
