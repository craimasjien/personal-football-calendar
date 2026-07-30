import type { CompetitionId } from '../domain.ts'

/**
 * ESPN league codes for each competition we track.
 *
 * ESPN files UEFA qualifying rounds under entirely separate league codes from the
 * main competition (e.g. `uefa.champions_qual`, not `uefa.champions`) — a fixture
 * played in a Champions League qualifying round never appears under `uefa.champions`
 * at all. Missing this is what let an Ajax European qualifier go unfetched, so the
 * three `-qual` codes below are not optional extras: without them, rule 1's "Ajax in
 * Europe, no exceptions" silently fails to cover qualifying.
 */
export const COMPETITIONS: Record<CompetitionId, { code: string; dutchName: string }> = {
  eredivisie: { code: 'ned.1', dutchName: 'Eredivisie' },
  'knvb-cup': { code: 'ned.cup', dutchName: 'KNVB Beker' },
  'johan-cruijff-schaal': { code: 'ned.supercup', dutchName: 'Johan Cruijff Schaal' },
  ucl: { code: 'uefa.champions', dutchName: 'UEFA Champions League' },
  uel: { code: 'uefa.europa', dutchName: 'UEFA Europa League' },
  uecl: { code: 'uefa.europa.conf', dutchName: 'UEFA Conference League' },
  'ucl-qual': { code: 'uefa.champions_qual', dutchName: 'UEFA Champions League kwalificatie' },
  'uel-qual': { code: 'uefa.europa_qual', dutchName: 'UEFA Europa League kwalificatie' },
  'uecl-qual': { code: 'uefa.europa.conf_qual', dutchName: 'UEFA Conference League kwalificatie' },
  friendly: { code: 'club.friendly', dutchName: 'Oefenwedstrijd' },
}

/**
 * European for classify.ts purposes. The three qualifying competitions are included
 * deliberately: they are what makes rule 1 ("my team in Europe: always, no
 * exceptions") cover Ajax's qualifying ties, not just the group/league phase onward.
 * `johan-cruijff-schaal` and `friendly` are domestic/non-UEFA fixtures and stay out,
 * so Ajax matches in them fall to rule 2 (opponent-tier) instead.
 */
const EUROPEAN = new Set<CompetitionId>(['ucl', 'uel', 'uecl', 'ucl-qual', 'uel-qual', 'uecl-qual'])

export function isEuropean(id: CompetitionId): boolean {
  return EUROPEAN.has(id)
}
