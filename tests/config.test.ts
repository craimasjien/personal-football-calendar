import { describe, expect, it } from 'vitest'
import type { RawConfig } from '../config/teams.ts'
import { UnknownTeamError, loadTeamIds, resolveConfig } from '../src/config.ts'

const RAW: RawConfig = {
  myTeam: 'Ajax Amsterdam',
  eredivisie: { tier1: ['Ajax Amsterdam', 'Feyenoord Rotterdam'], tier2: ['AZ Alkmaar'] },
  europeElite: ['Barcelona'],
  bigEuropeanStageFrom: 'quarterfinals',
  displayNames: { 'Ajax Amsterdam': 'AFC Ajax' },
}

const IDS = {
  'Ajax Amsterdam': 139,
  'Feyenoord Rotterdam': 142,
  'AZ Alkmaar': 140,
  Barcelona: 83,
}

describe('resolveConfig', () => {
  it('resolves every configured name to its provider id', () => {
    const c = resolveConfig(RAW, IDS)
    expect(c.myTeamId).toBe(139)
    expect([...c.tier1].sort((a, b) => a - b)).toEqual([139, 142])
    expect([...c.tier2]).toEqual([140])
    expect([...c.europeElite]).toEqual([83])
  })

  it('carries the threshold and display names through unchanged', () => {
    const c = resolveConfig(RAW, IDS)
    expect(c.bigEuropeanStageFrom).toBe('quarterfinals')
    expect(c.displayNames).toEqual({ 'Ajax Amsterdam': 'AFC Ajax' })
  })

  it('throws UnknownTeamError naming the club and the fix', () => {
    const withUnknown: RawConfig = { ...RAW, europeElite: ['Barcelona', 'Girona'] }
    expect(() => resolveConfig(withUnknown, IDS)).toThrow(UnknownTeamError)
    expect(() => resolveConfig(withUnknown, IDS)).toThrow(/Girona/)
    expect(() => resolveConfig(withUnknown, IDS)).toThrow(/sync-teams/)
  })

  it('reports every unknown club at once, not just the first', () => {
    const withUnknown: RawConfig = { ...RAW, europeElite: ['Girona', 'Bologna'] }
    expect(() => resolveConfig(withUnknown, IDS)).toThrow(/Girona/)
    expect(() => resolveConfig(withUnknown, IDS)).toThrow(/Bologna/)
  })

  it('throws when myTeam itself cannot be resolved', () => {
    expect(() => resolveConfig({ ...RAW, myTeam: 'Nobody' }, IDS)).toThrow(UnknownTeamError)
  })
})

describe('loadTeamIds', () => {
  it('reads the committed mapping and includes Ajax', () => {
    const ids = loadTeamIds()
    expect(ids['Ajax Amsterdam']).toBe(139)
  })

  it('maps every name to a number', () => {
    for (const [name, id] of Object.entries(loadTeamIds())) {
      expect(typeof id, `${name} should map to a number`).toBe('number')
    }
  })
})
