import { readFileSync } from 'node:fs'
import type { RawConfig } from '../config/teams.ts'
import type { BigStageThreshold } from './domain.ts'

export class UnknownTeamError extends Error {}

export type ResolvedConfig = {
  myTeamId: number
  tier1: Set<number>
  tier2: Set<number>
  europeElite: Set<number>
  bigEuropeanStageFrom: BigStageThreshold
  /** Provider name → calendar display name. */
  displayNames: Record<string, string>
}

export function loadTeamIds(): Record<string, number> {
  const path = new URL('../config/team-ids.json', import.meta.url)
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, number>
}

/**
 * Resolve configured club names to provider IDs.
 *
 * Names are used only here. Everywhere downstream compares numeric IDs, so a
 * provider rename can never silently drop a club from a tier — it fails the build.
 */
export function resolveConfig(raw: RawConfig, ids: Record<string, number>): ResolvedConfig {
  const missing: string[] = []

  const idFor = (name: string): number => {
    const id = ids[name]
    if (id === undefined) {
      missing.push(name)
      return -1
    }
    return id
  }

  const toIdSet = (names: string[]): Set<number> => new Set(names.map(idFor))

  const resolved: ResolvedConfig = {
    myTeamId: idFor(raw.myTeam),
    tier1: toIdSet(raw.eredivisie.tier1),
    tier2: toIdSet(raw.eredivisie.tier2),
    europeElite: toIdSet(raw.europeElite),
    bigEuropeanStageFrom: raw.bigEuropeanStageFrom,
    displayNames: raw.displayNames,
  }

  if (missing.length > 0) {
    const names = [...new Set(missing)].map((n) => `"${n}"`).join(', ')
    throw new UnknownTeamError(
      `Unknown team(s) ${names} — not in config/team-ids.json. Run: npm run sync-teams`,
    )
  }

  return resolved
}
