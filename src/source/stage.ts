import { STAGES, type Stage } from '../domain.ts'

const KNOWN = new Set<string>(STAGES)

/**
 * ESPN reports the stage as a machine-readable `season.slug`, and our Stage values
 * mirror those slugs exactly — so this is validation, not translation.
 *
 * Unrecognised slugs do occur in practice: `ned.1` has been observed carrying
 * `conference-league-playoffs---semifinals` and `conference-league-playoffs---final`
 * for Eredivisie clubs' European play-off ties, and neither is in STAGES.
 *
 * An unrecognised or missing slug becomes 'regular-season': the conservative choice,
 * since a lower stage only ever makes a fixture less likely to be included, and it is
 * deliberately the *label-free* stage — DUTCH_STAGE['regular-season'] is null, so the
 * fixture is described by competition name alone rather than inventing a round name
 * that may be wrong (as 'league-phase' would: real conference-league-playoffs matches
 * are not the league phase). A new UEFA format inventing a slug we do not know must
 * never silently promote fixtures into the calendar.
 */
export function toStage(slug: string | null | undefined): Stage {
  return slug !== null && slug !== undefined && KNOWN.has(slug)
    ? (slug as Stage)
    : 'regular-season'
}
