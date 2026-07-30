import { describe, expect, it } from 'vitest'
import { COMPETITION_IDS } from '../../src/domain.ts'
import { AJAX_TEAM_ID, COMPETITIONS, isEuropean } from '../../src/source/competitions.ts'

describe('COMPETITIONS', () => {
  it('covers every competition id', () => {
    expect(Object.keys(COMPETITIONS).sort()).toEqual([...COMPETITION_IDS].sort())
  })

  it('uses the ESPN codes confirmed by the spike', () => {
    expect(COMPETITIONS.eredivisie.code).toBe('ned.1')
    expect(COMPETITIONS['knvb-cup'].code).toBe('ned.cup')
    expect(COMPETITIONS.ucl.code).toBe('uefa.champions')
    expect(COMPETITIONS.uel.code).toBe('uefa.europa')
    expect(COMPETITIONS.uecl.code).toBe('uefa.europa.conf')
  })

  it('gives every competition a distinct code', () => {
    const codes = Object.values(COMPETITIONS).map((c) => c.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('names competitions in Dutch', () => {
    expect(COMPETITIONS.eredivisie.dutchName).toBe('Eredivisie')
    expect(COMPETITIONS['knvb-cup'].dutchName).toBe('KNVB Beker')
  })
})

describe('AJAX_TEAM_ID', () => {
  it('is the ESPN id confirmed by the spike', () => {
    expect(AJAX_TEAM_ID).toBe(139)
  })
})

describe('isEuropean', () => {
  it('is true for the three UEFA competitions', () => {
    expect(isEuropean('ucl')).toBe(true)
    expect(isEuropean('uel')).toBe(true)
    expect(isEuropean('uecl')).toBe(true)
  })

  it('is false for domestic competitions', () => {
    expect(isEuropean('eredivisie')).toBe(false)
    expect(isEuropean('knvb-cup')).toBe(false)
  })
})
