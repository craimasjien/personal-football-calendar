import { describe, expect, it } from 'vitest'
import { COMPETITION_IDS } from '../../src/domain.ts'
import { COMPETITIONS, isEuropean } from '../../src/source/competitions.ts'

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

  it('uses the separate ESPN codes UEFA qualifying is filed under', () => {
    // ESPN never puts qualifying events under the main competition's own code —
    // this is the fact that made tonight's Ajax qualifier go unfetched.
    expect(COMPETITIONS['ucl-qual'].code).toBe('uefa.champions_qual')
    expect(COMPETITIONS['uel-qual'].code).toBe('uefa.europa_qual')
    expect(COMPETITIONS['uecl-qual'].code).toBe('uefa.europa.conf_qual')
  })

  it('uses the ESPN codes for the Johan Cruijff Schaal and friendlies', () => {
    expect(COMPETITIONS['johan-cruijff-schaal'].code).toBe('ned.supercup')
    expect(COMPETITIONS.friendly.code).toBe('club.friendly')
  })

  it('covers all ten competitions', () => {
    expect(Object.keys(COMPETITIONS)).toHaveLength(10)
  })

  it('gives every competition a distinct code', () => {
    const codes = Object.values(COMPETITIONS).map((c) => c.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('names competitions in Dutch', () => {
    expect(COMPETITIONS.eredivisie.dutchName).toBe('Eredivisie')
    expect(COMPETITIONS['knvb-cup'].dutchName).toBe('KNVB Beker')
    expect(COMPETITIONS['ucl-qual'].dutchName).toBe('UEFA Champions League kwalificatie')
    expect(COMPETITIONS['uel-qual'].dutchName).toBe('UEFA Europa League kwalificatie')
    expect(COMPETITIONS['uecl-qual'].dutchName).toBe('UEFA Conference League kwalificatie')
    expect(COMPETITIONS['johan-cruijff-schaal'].dutchName).toBe('Johan Cruijff Schaal')
    expect(COMPETITIONS.friendly.dutchName).toBe('Oefenwedstrijd')
  })
})

describe('isEuropean', () => {
  it('is true for the three UEFA competitions', () => {
    expect(isEuropean('ucl')).toBe(true)
    expect(isEuropean('uel')).toBe(true)
    expect(isEuropean('uecl')).toBe(true)
  })

  it('is true for the three UEFA qualifying competitions, so rule 1 covers them', () => {
    expect(isEuropean('ucl-qual')).toBe(true)
    expect(isEuropean('uel-qual')).toBe(true)
    expect(isEuropean('uecl-qual')).toBe(true)
  })

  it('is false for domestic competitions', () => {
    expect(isEuropean('eredivisie')).toBe(false)
    expect(isEuropean('knvb-cup')).toBe(false)
  })

  it('is false for the Johan Cruijff Schaal and friendlies', () => {
    expect(isEuropean('johan-cruijff-schaal')).toBe(false)
    expect(isEuropean('friendly')).toBe(false)
  })
})
