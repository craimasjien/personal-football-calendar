import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
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
 * Harvest every club ESPN mentions across all configured competitions, for both the
 * current and previous season. Two seasons because a club only appears if it has
 * a fixture: an elite side whose competition has not been drawn yet would be
 * invisible using the current season alone.
 */
async function harvest(): Promise<Map<string, number>> {
  const seen = new Map<string, number>()
  const current = seasonFor(new Date())

  // Oldest first: the newest season must be written last so its ids win. A previous
  // season is swept only to catch clubs whose current competition has not been drawn yet.
  for (const season of [current - 1, current]) {
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

  // Merge onto whatever is already committed, so a transient harvest gap cannot delete
  // ids that were previously resolved. Newly harvested values still win.
  let existing: Record<string, number> = {}
  try {
    existing = JSON.parse(readFileSync(OUT, 'utf8')) as Record<string, number>
  } catch {
    // No file yet, or unreadable — start from empty.
  }
  const merged = { ...existing, ...ids }
  const carriedOver = Object.keys(existing).filter((name) => !(name in ids)).length
  // Default string sort, matching configuredNames()'s convention — keeps the file's key
  // order stable across runs instead of drifting with locale-aware comparison.
  const sorted = Object.fromEntries(Object.keys(merged).sort().map((name) => [name, merged[name]]))

  writeFileSync(OUT, `${JSON.stringify(sorted, null, 2)}\n`)
  console.log(
    `\nWrote ${Object.keys(sorted).length} clubs to config/team-ids.json` +
      ` (${Object.keys(ids).length} newly harvested, ${carriedOver} carried over unchanged)`,
  )

  if (unmatched.length > 0) {
    console.log('\nCould not match these names. Edit config/teams.ts to use ESPN\'s spelling,')
    console.log('then run this again. Closest candidates:\n')
    for (const name of unmatched) {
      console.log(`  "${name}"`)
      for (const candidate of suggest(name, [...seen.keys()])) {
        console.log(`      - ${candidate}`)
      }
    }
    process.exitCode = 1
    return
  }
}

/** Strip diacritics and case so 'Atlético' matches 'Atletico'. */
function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/**
 * Rank harvested club names by how plausibly they are the club we wanted.
 * Substring either direction beats a shared-prefix word match, which beats nothing.
 */
function suggest(wanted: string, available: string[]): string[] {
  const w = fold(wanted)
  const words = w.split(/\s+/).filter((word) => word.length > 3)

  const scored = available
    .map((candidate) => {
      const c = fold(candidate)
      let score = 0
      if (c === w) score = 100
      else if (c.includes(w) || w.includes(c)) score = 50
      else if (words.some((word) => c.includes(word))) score = 20
      // A shared 4-char prefix catches 'Internazionale' / 'Inter Milan'.
      else if (c.slice(0, 4) === w.slice(0, 4)) score = 10
      return { candidate, score }
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.candidate.localeCompare(b.candidate))

  return scored.slice(0, 8).map((s) => s.candidate)
}

const isEntryPoint =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]

if (isEntryPoint) {
  run().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
