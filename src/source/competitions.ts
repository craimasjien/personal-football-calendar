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
  // National teams. Like the UEFA club qualifiers, each tournament's qualifying campaign
  // lives under its own code — `fifa.worldq.uefa` is the UEFA zone of World Cup
  // qualifying, which is the only zone the Netherlands can appear in. All six codes were
  // confirmed live on 2026-09-28 (the empty ones return `{leagues: [...]}` with no
  // `events`, exactly like a club competition between draws).
  'world-cup': { code: 'fifa.world', dutchName: 'WK' },
  'world-cup-qual': { code: 'fifa.worldq.uefa', dutchName: 'WK-kwalificatie' },
  euro: { code: 'uefa.euro', dutchName: 'EK' },
  'euro-qual': { code: 'uefa.euroq', dutchName: 'EK-kwalificatie' },
  'nations-league': { code: 'uefa.nations', dutchName: 'Nations League' },
  'international-friendly': { code: 'fifa.friendly', dutchName: 'Oefeninterland' },
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

/**
 * The Dutch domestic competitions — the ones that attest a club is Dutch.
 *
 * This is what `dutchClubIds` reads to decide nationality, so membership is a
 * claim about the club, not just about the fixture. `friendly` is deliberately
 * absent: `club.friendly` is worldwide, so a club appearing there tells us
 * nothing about where it is from. The KNVB Beker is deliberately present — it
 * reaches down into the amateur and Eerste Divisie sides, which is exactly the
 * long tail that a hand-maintained club list would keep missing.
 */
const DUTCH_DOMESTIC = new Set<CompetitionId>([
  'eredivisie',
  'knvb-cup',
  'johan-cruijff-schaal',
])

export function isDutchDomestic(id: CompetitionId): boolean {
  return DUTCH_DOMESTIC.has(id)
}

/**
 * National-team competitions — the ones rule 0 (my country: always) applies to.
 *
 * Deliberately disjoint from both sets above: an international fixture is neither
 * European club football (so rules 3a-3d never see it) nor evidence that a side is a
 * Dutch *club* (so `dutchClubIds` ignores it — the Netherlands playing Germany says
 * nothing about Eredivisie membership). `international-friendly` is included even
 * though `friendly` is worldwide noise, because the rule keys on my country's own
 * id, not on who else appears in the feed.
 */
const INTERNATIONAL = new Set<CompetitionId>([
  'world-cup',
  'world-cup-qual',
  'euro',
  'euro-qual',
  'nations-league',
  'international-friendly',
])

export function isInternational(id: CompetitionId): boolean {
  return INTERNATIONAL.has(id)
}
