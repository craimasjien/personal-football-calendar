import { fileURLToPath } from 'node:url'
import { rawConfig } from '../config/teams.ts'
import { buildCalendar } from '../src/build.ts'
import { loadTeamIds } from '../src/config.ts'
import { summary } from '../src/ics/dutch.ts'
import { seasonFor } from '../src/source/season.ts'

/**
 * Real fetch, printed for eyeballing. Writes nothing.
 * This is the deliberate stand-in for an end-to-end test in CI.
 */
async function run(): Promise<void> {
  const season = seasonFor(new Date())
  const result = await buildCalendar({ season, rawConfig, teamIds: loadTeamIds() })

  /** Sort key: the actual instant, so same-day matches are ordered by kickoff. */
  const sortKey = (e: (typeof result.entries)[number]): number =>
    e.fixture.kickoff.kind === 'confirmed'
      ? e.fixture.kickoff.utc.getTime()
      : // Time unknown: sort at the start of that day. Parsed as UTC midnight, which is
        // consistent across process timezones.
        new Date(`${e.fixture.kickoff.date}T00:00:00Z`).getTime()

  const sorted = [...result.entries].sort((a, b) => sortKey(a) - sortKey(b))

  for (const entry of sorted) {
    const { kickoff } = entry.fixture
    const when =
      kickoff.kind === 'confirmed'
        ? new Intl.DateTimeFormat('nl-NL', {
            timeZone: 'Europe/Amsterdam',
            dateStyle: 'short',
            timeStyle: 'short',
          }).format(kickoff.utc)
        : `${kickoff.date} (tijd nog onbekend)`
    console.log(`${when.padEnd(30)} ${summary(entry, rawConfig.displayNames)}`)
  }

  console.log(`\n${result.entries.length} events across ${result.fixtures.length} fixtures`)
  for (const c of result.counts) {
    console.log(
      `  ${c.competition.padEnd(12)} fetched=${c.fetched} dropped=${c.dropped}` +
        ` required=${c.required} optional=${c.optional}`,
    )
  }
}

const isEntryPoint =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]

if (isEntryPoint) {
  run().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
