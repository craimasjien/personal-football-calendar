import { describe, expect, it } from 'vitest'
import { COMPETITION_IDS } from '../../src/domain.ts'
import {
  COMPETITIONS,
  isDutchDomestic,
  isEuropean,
  isInternational,
} from '../../src/source/competitions.ts'

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

  it('uses the ESPN codes for national-team competitions, confirmed live', () => {
    // Qualifying campaigns live under their own codes, as with the UEFA club qualifiers.
    // World Cup qualifying is split by confederation; UEFA's zone is the only one the
    // Netherlands can ever appear in.
    expect(COMPETITIONS['world-cup'].code).toBe('fifa.world')
    expect(COMPETITIONS['world-cup-qual'].code).toBe('fifa.worldq.uefa')
    expect(COMPETITIONS.euro.code).toBe('uefa.euro')
    expect(COMPETITIONS['euro-qual'].code).toBe('uefa.euroq')
    expect(COMPETITIONS['nations-league'].code).toBe('uefa.nations')
    expect(COMPETITIONS['international-friendly'].code).toBe('fifa.friendly')
  })

  it('covers all sixteen competitions', () => {
    expect(Object.keys(COMPETITIONS)).toHaveLength(16)
  })

  it('keeps the original ten competitions first, so the ICS event order is unchanged', () => {
    expect(Object.keys(COMPETITIONS).slice(0, 10)).toEqual([
      'eredivisie',
      'knvb-cup',
      'johan-cruijff-schaal',
      'ucl',
      'uel',
      'uecl',
      'ucl-qual',
      'uel-qual',
      'uecl-qual',
      'friendly',
    ])
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
    expect(COMPETITIONS['world-cup'].dutchName).toBe('WK')
    expect(COMPETITIONS['world-cup-qual'].dutchName).toBe('WK-kwalificatie')
    expect(COMPETITIONS.euro.dutchName).toBe('EK')
    expect(COMPETITIONS['euro-qual'].dutchName).toBe('EK-kwalificatie')
    expect(COMPETITIONS['nations-league'].dutchName).toBe('Nations League')
    expect(COMPETITIONS['international-friendly'].dutchName).toBe('Oefeninterland')
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

  it('is false for every national-team competition, so rules 3a-3d never see one', () => {
    for (const id of COMPETITION_IDS) {
      if (isInternational(id)) expect(isEuropean(id), id).toBe(false)
    }
  })
})

describe('isInternational', () => {
  it('is true for the six national-team competitions', () => {
    expect(isInternational('world-cup')).toBe(true)
    expect(isInternational('world-cup-qual')).toBe(true)
    expect(isInternational('euro')).toBe(true)
    expect(isInternational('euro-qual')).toBe(true)
    expect(isInternational('nations-league')).toBe(true)
    expect(isInternational('international-friendly')).toBe(true)
  })

  it('is false for club friendlies, which live under a different ESPN code', () => {
    expect(isInternational('friendly')).toBe(false)
  })

  it('never overlaps with isDutchDomestic, so a nation is never derived as a Dutch club', () => {
    for (const id of COMPETITION_IDS) {
      expect(isInternational(id) && isDutchDomestic(id)).toBe(false)
    }
  })

  it('leaves no competition unclassified', () => {
    // Every id belongs to exactly one family. A new competition that fits none of them
    // would silently take the domestic path in classify.
    for (const id of COMPETITION_IDS) {
      const families = [isEuropean(id), isDutchDomestic(id), isInternational(id), id === 'friendly']
      expect(families.filter(Boolean), id).toHaveLength(1)
    }
  })
})

describe('isDutchDomestic', () => {
  it('is true for the three Dutch domestic competitions', () => {
    expect(isDutchDomestic('eredivisie')).toBe(true)
    expect(isDutchDomestic('knvb-cup')).toBe(true)
    expect(isDutchDomestic('johan-cruijff-schaal')).toBe(true)
  })

  it('is false for every European competition', () => {
    expect(isDutchDomestic('ucl')).toBe(false)
    expect(isDutchDomestic('uel')).toBe(false)
    expect(isDutchDomestic('uecl')).toBe(false)
    expect(isDutchDomestic('ucl-qual')).toBe(false)
    expect(isDutchDomestic('uel-qual')).toBe(false)
    expect(isDutchDomestic('uecl-qual')).toBe(false)
  })

  it('is false for friendlies, which cannot attest nationality', () => {
    // `club.friendly` is worldwide: a club appearing there says nothing about
    // where it is from, so harvesting Dutch identity from it would be wrong.
    expect(isDutchDomestic('friendly')).toBe(false)
  })

  it('never overlaps with isEuropean', () => {
    for (const id of COMPETITION_IDS) {
      expect(isDutchDomestic(id) && isEuropean(id)).toBe(false)
    }
  })
})
