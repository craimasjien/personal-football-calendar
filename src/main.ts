import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { rawConfig } from '../config/teams.ts'
import { buildCalendar } from './build.ts'
import { loadTeamIds } from './config.ts'
import { seasonFor } from './source/season.ts'

const OUT_DIR = 'dist'
const ICS_NAME = 'football.ics'

/** A tap-to-subscribe page, so adding the feed on a phone is one tap. */
function indexHtml(icsUrl: string): string {
  return `<!doctype html>
<html lang="nl">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Voetbalkalender</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 3rem auto; max-width: 32rem; padding: 0 1rem; line-height: 1.5; }
  a.button { display: inline-block; padding: .75rem 1.25rem; background: #b4162b; color: #fff; border-radius: .5rem; text-decoration: none; font-weight: 600; }
  code { word-break: break-all; }
</style>
<h1>Voetbalkalender</h1>
<p>Abonneer op deze agenda om te zien welke wedstrijden ik wil kijken.</p>
<p><a class="button" href="webcal://${icsUrl}">Abonneren op iPhone</a></p>
<p>Of voeg deze URL handmatig toe: <code>https://${icsUrl}</code></p>
`
}

async function run(): Promise<void> {
  const season = seasonFor(new Date())
  console.log(`Building calendar for season ${season}/${String(season + 1).slice(2)}`)

  const result = await buildCalendar({
    season,
    rawConfig,
    teamIds: loadTeamIds(),
  })

  for (const c of result.counts) {
    // fetched=0 is normal out of season and between draws. fetched>0 with everything
    // dropped means ESPN changed shape — that must look different from a quiet competition.
    const note =
      c.fetched === 0
        ? '  <-- nothing scheduled yet'
        : c.dropped === c.fetched
          ? '  <-- WARNING: every event dropped; ESPN shape may have changed'
          : c.dropped > 0
            ? `  <-- ${c.dropped} dropped`
            : ''
    console.log(
      `  ${c.competition.padEnd(20)} fetched=${String(c.fetched).padStart(4)}` +
        ` required=${String(c.required).padStart(3)} optional=${String(c.optional).padStart(3)}${note}`,
    )
  }
  console.log(`Total events: ${result.entries.length}`)

  // Written only after every guard has passed.
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(`${OUT_DIR}/${ICS_NAME}`, result.ics)

  // Host and path only — no scheme, no trailing slash, e.g. "user.github.io/repo".
  // The scheme is added below, so including one here silently breaks the subscribe link.
  const host = process.env.CALENDAR_HOST
  if (host) writeFileSync(`${OUT_DIR}/index.html`, indexHtml(`${host}/${ICS_NAME}`))

  console.log(`Wrote ${OUT_DIR}/${ICS_NAME}`)
}

/**
 * Only build when executed directly. Keeping the module import-safe is what allows the
 * write-after-guards ordering below to be tested at all.
 *
 * INVARIANT: every mkdirSync/writeFileSync call must stay after `await buildCalendar(...)`.
 * GitHub Pages serves the last successful file, so a write that happens before the guards
 * would replace a good calendar with a bad one.
 */
const isEntryPoint =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]

if (isEntryPoint) {
  run().catch((error: unknown) => {
    console.error(
      `\nFAILED — calendar not published.\n${error instanceof Error ? error.message : error}`,
    )
    process.exitCode = 1
  })
}

export { run }
