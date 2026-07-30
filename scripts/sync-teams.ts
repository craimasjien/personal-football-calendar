import { writeFileSync } from 'node:fs'
import { rawConfig } from '../config/teams.ts'
import type { CompetitionId } from '../src/domain.ts'
import { COMPETITIONS } from '../src/source/competitions.ts'
import { fetchEvents } from '../src/source/espn.ts'
import { seasonFor, seasonWindow } from '../src/source/season.ts'

const OUT = new URL('../config/team-ids.json', import.meta.url)

type RawEvent = {
  competitions?: Array<{
    competitors?: Array<{ team?: { id?: string; displayName?: string } }>
  }>
}

/** Every club name referenced anywhere in the config. */
function configuredNames(): string[] {
  return [
    ...new Set([
      rawConfig.myTeam,
      ...rawConfig.eredivisie.tier1,
      ...rawConfig.eredivisie.tier2,
      ...rawConfig.europeElite,
    ]),
  ].sort()
}

/**
 * Harvest every club ESPN mentions across all five competitions, for both the
 * current and previous season. Two seasons because a club only appears if it has
 * a fixture: an elite side whose competition has not been drawn yet would be
 * invisible using the current season alone.
 */
async function harvest(): Promise<Map<string, number>> {
  const seen = new Map<string, number>()
  const current = seasonFor(new Date())

  for (const season of [current, current - 1]) {
    const { from, to } = seasonWindow(season)
    for (const [id, meta] of Object.entries(COMPETITIONS) as Array<
      [CompetitionId, (typeof COMPETITIONS)[CompetitionId]]
    >) {
      const events = (await fetchEvents({ code: meta.code, from, to })) as RawEvent[]
      let added = 0
      for (const event of events) {
        for (const competitor of event.competitions?.[0]?.competitors ?? []) {
          const espnId = competitor.team?.id
          const name = competitor.team?.displayName
          if (!espnId || !name) continue
          const numeric = Number(espnId)
          if (!Number.isFinite(numeric)) continue
          if (!seen.has(name)) added++
          seen.set(name, numeric)
        }
      }
      console.log(`  ${season} ${id.padEnd(12)} ${events.length} events, +${added} new clubs`)
    }
  }

  return seen
}

async function run(): Promise<void> {
  console.log('Harvesting club ids from fixture data...\n')
  const seen = await harvest()
  console.log(`\nSaw ${seen.size} distinct clubs.\n`)

  const names = configuredNames()
  const ids: Record<string, number> = {}
  const unmatched: string[] = []

  for (const name of names) {
    const id = seen.get(name)
    if (id !== undefined) {
      ids[name] = id
      console.log(`  ok      ${name} -> ${id}`)
    } else {
      unmatched.push(name)
      console.log(`  MISSING ${name}`)
    }
  }

  // Write what we did resolve, so a partial run is still progress.
  writeFileSync(OUT, `${JSON.stringify(ids, null, 2)}\n`)
  console.log(`\nWrote ${Object.keys(ids).length} of ${names.length} clubs to config/team-ids.json`)

  if (unmatched.length > 0) {
    console.log('\nCould not match these names. Edit config/teams.ts to use ESPN\'s spelling,')
    console.log('then run this again. Closest candidates:\n')
    for (const name of unmatched) {
      console.log(`  "${name}"`)
      for (const candidate of suggest(name, [...seen.keys()])) {
        console.log(`      - ${candidate}`)
      }
    }
    process.exit(1)
  }
}

/** Cheap suggestion: clubs sharing a significant word with the wanted name. */
function suggest(wanted: string, available: string[]): string[] {
  const words = wanted.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
  const hits = available.filter((candidate) => {
    const lower = candidate.toLowerCase()
    return words.some((w) => lower.includes(w))
  })
  return hits.slice(0, 8)
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
