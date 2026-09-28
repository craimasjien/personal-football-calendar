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

  it('recognises the slugs national-team competitions use', () => {
    // Observed live under fifa.world 2026, uefa.euro 2024 and fifa.worldq.uefa 2025.
    expect(toStage('group-stage')).toBe('group-stage')
    expect(toStage('round-of-32')).toBe('round-of-32')
    expect(toStage('3rd-place-match')).toBe('3rd-place-match')
  })

  it('falls back to regular-season for the national-team slugs it does not model', () => {
    // uefa.nations carries 'relegation-playoffs'; fifa.worldq.uefa carries
    // 'playoff-semifinals' and 'playoff-finals' for the March play-offs.
    expect(toStage('relegation-playoffs')).toBe('regular-season')
    expect(toStage('playoff-semifinals')).toBe('regular-season')
    expect(toStage('playoff-finals')).toBe('regular-season')
    expect(toStage('2026-international-friendly')).toBe('regular-season')
  })

  it('falls back to regular-season for an unknown slug', () => {
    expect(toStage('some-new-uefa-format')).toBe('regular-season')
  })

  it('falls back to regular-season for a missing slug', () => {
    expect(toStage(null)).toBe('regular-season')
    expect(toStage(undefined)).toBe('regular-season')
  })

  it('falls back to regular-season for slugs observed live under ned.1', () => {
    // Real ESPN data: Eredivisie clubs' European play-off ties carry these slugs,
    // which are not in STAGES. The fallback must not label them 'Competitiefase'.
    expect(toStage('conference-league-playoffs---semifinals')).toBe('regular-season')
    expect(toStage('conference-league-playoffs---final')).toBe('regular-season')
  })

  it('never returns a stage at or above the quarter-finals for unknown input', () => {
    // The fallback must be conservative: it may only make a fixture LESS likely
    // to be included, never more.
    const fallback = toStage('unrecognised')
    expect(STAGES.indexOf(fallback)).toBeLessThan(STAGES.indexOf('quarterfinals'))
  })
})
