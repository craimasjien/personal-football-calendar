import { describe, expect, it } from 'vitest'
import { STAGES } from '../src/domain.ts'
import { rawConfig } from '../config/teams.ts'

describe('config/teams.ts', () => {
  it('lists myTeam in tier1', () => {
    expect(rawConfig.eredivisie.tier1).toContain(rawConfig.myTeam)
  })

  it('has no club in both tier1 and tier2', () => {
    const overlap = rawConfig.eredivisie.tier1.filter((t) =>
      rawConfig.eredivisie.tier2.includes(t),
    )
    expect(overlap).toEqual([])
  })

  it('has no duplicate names in any list', () => {
    for (const list of [
      rawConfig.eredivisie.tier1,
      rawConfig.eredivisie.tier2,
      rawConfig.europeElite,
    ]) {
      expect(new Set(list).size).toBe(list.length)
    }
  })

  it('uses a real stage for bigEuropeanStageFrom', () => {
    expect(STAGES).toContain(rawConfig.bigEuropeanStageFrom)
  })

  it('picks a knockout stage for bigEuropeanStageFrom, not a league phase', () => {
    expect(['regular-season', 'league-phase']).not.toContain(rawConfig.bigEuropeanStageFrom)
  })
})

describe('STAGES', () => {
  it('orders league phases below every knockout round', () => {
    expect(STAGES.indexOf('league-phase')).toBeLessThan(STAGES.indexOf('round-of-16'))
    expect(STAGES.indexOf('regular-season')).toBeLessThan(STAGES.indexOf('quarterfinals'))
  })

  it('orders knockout rounds from earliest to latest', () => {
    const order = ['round-of-16', 'quarterfinals', 'semifinals', 'final'] as const
    const indices = order.map((s) => STAGES.indexOf(s))
    expect(indices).toEqual([...indices].sort((a, b) => a - b))
  })
})
