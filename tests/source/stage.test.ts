import { describe, expect, it } from 'vitest'
import { STAGES } from '../../src/domain.ts'
import { toStage } from '../../src/source/stage.ts'

describe('toStage', () => {
  it('passes through every slug ESPN actually uses', () => {
    for (const slug of STAGES) {
      expect(toStage(slug)).toBe(slug)
    }
  })

  it('recognises the slugs observed in the spike', () => {
    expect(toStage('regular-season')).toBe('regular-season')
    expect(toStage('league-phase')).toBe('league-phase')
    expect(toStage('first-round')).toBe('first-round')
    expect(toStage('second-round')).toBe('second-round')
    expect(toStage('knockout-round-playoffs')).toBe('knockout-round-playoffs')
    expect(toStage('round-of-16')).toBe('round-of-16')
    expect(toStage('quarterfinals')).toBe('quarterfinals')
    expect(toStage('semifinals')).toBe('semifinals')
    expect(toStage('final')).toBe('final')
  })

  it('falls back to league-phase for an unknown slug', () => {
    expect(toStage('some-new-uefa-format')).toBe('league-phase')
  })

  it('falls back to league-phase for a missing slug', () => {
    expect(toStage(null)).toBe('league-phase')
    expect(toStage(undefined)).toBe('league-phase')
  })

  it('never returns a stage at or above the quarter-finals for unknown input', () => {
    // The fallback must be conservative: it may only make a fixture LESS likely
    // to be included, never more.
    const fallback = toStage('unrecognised')
    expect(STAGES.indexOf(fallback)).toBeLessThan(STAGES.indexOf('quarterfinals'))
  })
})
