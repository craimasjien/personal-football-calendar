import { STAGES, type Stage } from '../domain.ts'

const KNOWN = new Set<string>(STAGES)

/**
 * ESPN reports the stage as a machine-readable `season.slug`, and our Stage values
 * mirror those slugs exactly — so this is validation, not translation.
 *
 * An unrecognised or missing slug becomes 'league-phase': the conservative choice,
 * since a lower stage only ever makes a fixture less likely to be included. A new
 * UEFA format inventing a slug we do not know must never silently promote fixtures
 * into the calendar.
 */
export function toStage(slug: string | null | undefined): Stage {
  return slug !== null && slug !== undefined && KNOWN.has(slug) ? (slug as Stage) : 'league-phase'
}
