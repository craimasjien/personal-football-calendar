import type { CompetitionId } from '../domain.ts'

/** ESPN league codes, confirmed by the Task 1 spike. */
export const COMPETITIONS: Record<CompetitionId, { code: string; dutchName: string }> = {
  eredivisie: { code: 'ned.1', dutchName: 'Eredivisie' },
  'knvb-cup': { code: 'ned.cup', dutchName: 'KNVB Beker' },
  ucl: { code: 'uefa.champions', dutchName: 'UEFA Champions League' },
  uel: { code: 'uefa.europa', dutchName: 'UEFA Europa League' },
  uecl: { code: 'uefa.europa.conf', dutchName: 'UEFA Conference League' },
}

/** ESPN's id for Ajax Amsterdam. Confirmed by the spike. */
export const AJAX_TEAM_ID = 139

const EUROPEAN = new Set<CompetitionId>(['ucl', 'uel', 'uecl'])

export function isEuropean(id: CompetitionId): boolean {
  return EUROPEAN.has(id)
}
