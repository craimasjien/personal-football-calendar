import type { CompetitionId } from '../domain.ts'

/** ESPN league codes for each competition we track. */
export const COMPETITIONS: Record<CompetitionId, { code: string; dutchName: string }> = {
  eredivisie: { code: 'ned.1', dutchName: 'Eredivisie' },
  'knvb-cup': { code: 'ned.cup', dutchName: 'KNVB Beker' },
  ucl: { code: 'uefa.champions', dutchName: 'UEFA Champions League' },
  uel: { code: 'uefa.europa', dutchName: 'UEFA Europa League' },
  uecl: { code: 'uefa.europa.conf', dutchName: 'UEFA Conference League' },
}

const EUROPEAN = new Set<CompetitionId>(['ucl', 'uel', 'uecl'])

export function isEuropean(id: CompetitionId): boolean {
  return EUROPEAN.has(id)
}
