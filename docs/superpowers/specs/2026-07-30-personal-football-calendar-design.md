# Personal Football Calendar — Design

**Date:** 2026-07-30
**Status:** Approved

## Purpose

Publish a single subscribable calendar feed containing the football matches I intend to
watch, so I can show my wife what my viewing plans are without either of us maintaining
anything by hand.

The calendar distinguishes matches I will definitely watch from matches I would like to
watch, using an `Optioneel:` prefix on the latter. Content is in Dutch.

## Scope

**In scope:** fixture selection, Dutch-language ICS generation, weekly automated
publication to a URL two iPhones can subscribe to.

**Out of scope:** TV broadcaster information (considered and deliberately dropped —
fixture APIs do not carry broadcast rights, and every way of obtaining it added either a
fragile scraper or a config file of facts that go stale). Match results, standings, form,
lineups, notifications, and any web UI are also out of scope.

## Selection rules

Fixtures are classified as **Required**, **Optional**, or **Excluded**. Rules are
evaluated in order; the first match wins.

| # | Condition | Result |
|---|---|---|
| 1 | Ajax is playing, competition is Champions/Europa/Conference League | Required |
| 2 | Ajax is playing (Eredivisie or KNVB Cup) | Required if opponent is tier 1 or tier 2, otherwise Optional |
| 3 | European match, stage is at or beyond `bigEuropeanStageFrom`, **or** both clubs are on the elite list | Optional |
| 4 | Eredivisie match, both clubs are tier 1 | Optional |
| — | anything else | Excluded |

Rule 1 precedes rule 2 deliberately: every Ajax match in Europe is Required regardless of
opponent, including a Conference League tie against a minor side.

Rules 3 and 4 apply to matches Ajax is not involved in; any match Ajax plays has already
been resolved by rules 1 or 2.

## Configuration

Two files. One is authored by hand, one is generated.

`config/teams.ts` — human-authored, names only:

```ts
export const config = {
  myTeam: 'Ajax',
  eredivisie: {
    tier1: ['Ajax', 'PSV', 'Feyenoord'],
    tier2: ['AZ', 'FC Twente', 'FC Utrecht'],
  },
  europeElite: [
    'Real Madrid', 'Barcelona', 'Bayern München', 'Manchester City', 'Liverpool',
    'Paris Saint-Germain', 'Inter', 'Milan', 'Manchester United', 'Arsenal',
    'Chelsea', 'Atlético Madrid', 'Borussia Dortmund', 'Juventus', 'Napoli',
    'Tottenham',
  ],
  bigEuropeanStageFrom: 'qf',   // 'sf' if the calendar feels crowded
}
```

Any Eredivisie club not listed in tier 1 or tier 2 is treated as tier 3.

The `europeElite` list and `bigEuropeanStageFrom` are the two dials controlling how busy
the calendar gets. Both are expected to be tuned by hand over time.

`config/team-ids.json` — generated and committed, mapping configured names to the data
provider's numeric team IDs:

```json
{ "Ajax": 194, "Feyenoord": 675, "AZ": 201 }
```

**All team comparisons in the classifier use provider IDs, never names.** Name comparison
would break silently the first time the provider returned `Bayern Munich` instead of
`Bayern München`.

`npm run sync-teams` queries the provider, matches the names in `teams.ts`, and rewrites
`team-ids.json`. It is run by hand when a club is added — never as part of a calendar
build, so a normal run makes no team-lookup requests. Names it cannot match are reported
with their closest candidates so the correct spelling can be pasted in.

## Architecture

A stateless script, run on a schedule, producing one file.

```
fetch  →  normalise  →  classify  →  render  →  publish
```

Every run rebuilds the entire calendar from the API. There is no database, no server, and
no state carried between runs. This is the central simplifying decision: nothing needs
syncing, there is no incremental-update logic, and stale local state cannot drift from
reality. A run either produces a complete correct calendar or fails without publishing.

**Stack:** TypeScript on Node. Chosen for first-class GitHub Actions support, the
`ical-generator` library (which handles line folding, escaping, and timezones), and a type
system that can make the confirmed/provisional kickoff distinction unrepresentable to get
wrong.

### Modules

| Module | Responsibility | Depends on |
|---|---|---|
| `config/` | Club tiers, competitions, thresholds. Plain data, no logic. | — |
| `src/source/` | Call API-Football; map its JSON to `Fixture`. The only code aware the provider exists. | `config/` |
| `src/classify/` | `(Fixture, Config) → Required \| Optional \| Excluded`. Pure, no I/O. | `config/` |
| `src/ics/` | `(CalendarEntry[]) → string`. Pure, no I/O. | — |
| `src/main.ts` | Wiring, env vars, file writes. The only module with side effects. | all |

`classify` holds all the product logic and is a pure function over plain data, so the
rules can be changed and tested without touching anything that performs I/O. Replacing the
data provider means rewriting `src/source/` alone.

### Data model

```ts
type Team = {
  id: number                    // provider team id — the only thing compared
  name: string                  // provider display name, used in the summary
}

type Fixture = {
  id: string                    // provider fixture id; becomes the ICS UID
  competition: CompetitionId    // 'eredivisie' | 'knvb-cup' | 'ucl' | 'uel' | 'uecl'
  stage: Stage
  home: Team
  away: Team
  venue: { name: string; city: string } | null
  kickoff:
    | { kind: 'confirmed';   utc: Date }
    | { kind: 'provisional'; date: string }   // YYYY-MM-DD, kickoff time unknown
}

type Inclusion = 'required' | 'optional' | 'excluded'

type CalendarEntry = {
  fixture: Fixture
  inclusion: 'required' | 'optional'   // excluded fixtures never become entries
}
```

The `kickoff` discriminated union means the renderer cannot fail to handle a provisional
fixture — omitting the case is a compile error rather than a runtime bug.

`Stage` is an ordered scale, declared as an array so "at or beyond the quarter-finals" is a
comparison of indices rather than of strings:

```ts
const STAGES = ['league', 'r32', 'r16', 'qf', 'sf', 'final'] as const
```

Rule 3's threshold test is therefore
`STAGES.indexOf(stage) >= STAGES.indexOf(config.bigEuropeanStageFrom)`. Provider stage
labels are mapped onto this scale in `src/source/`; an unrecognised label maps to `league`,
the conservative choice, since it only ever makes a fixture less likely to be included.

## Calendar output

One `.ics` file containing all Required and Optional fixtures. Content is Dutch.

**Summary** — the fixture title, with the prefix on Optional entries only:

```
AFC Ajax vs. Feyenoord
Optioneel: AFC Ajax vs. SC Cambuur
```

The `vs.` separator is intentional, in preference to the Dutch `-` convention.

**Location** — provider venue name and city joined: `Johan Cruijff ArenA, Amsterdam`.
Omitted entirely when the provider has no venue, which happens for fixtures created
immediately after a draw. Never guessed.

**Timing**

- Confirmed kickoff → a timed event of 2 hours, written with an explicit
  `Europe/Amsterdam` timezone so it survives the October and March clock changes and does
  not drift when either phone travels.
- Provisional → an all-day event on that date. The next run promotes it to a timed event
  once the provider confirms a kickoff time.

All-day events are used rather than guessing a typical kickoff slot: an all-day entry
reads as "this is happening, time to be confirmed", whereas a guessed time is quietly
wrong and re-notifies both phones when corrected.

**UID** — `fixture-<providerId>@football-calendar`, stable for the life of the fixture. A
postponed match therefore moves on both phones instead of appearing twice. Because every
run publishes the complete calendar, a fixture that disappears from the feed (competition
exit, abandoned tie) is removed from the phones with no tombstone bookkeeping.

**Description** — competition and round: `Eredivisie · Speelronde 24`,
`KNVB Beker · Achtste finale`, `UEFA Champions League · Kwartfinale`. Stage names come
from a Dutch lookup table. Club names come from the provider, which uses conventional
Dutch forms for Dutch clubs.

**No alarms or reminders.** A subscribed feed that fires notifications on my wife's phone
for matches she is not watching would make the calendar unwelcome. Either phone can add
per-event reminders locally.

## Data source

API-Football (api-sports.io), free tier. Chosen because it is the only single source
covering all five required competitions — Eredivisie, KNVB Beker, and the Champions,
Europa, and Conference Leagues — and includes venue and kickoff time. A once-weekly job
uses roughly 5–10 of the free tier's ~100 daily requests.

football-data.org was rejected: its free tier excludes the Europa League, Conference
League, and KNVB Cup, and "all Ajax's international matches, no exceptions" is a hard
requirement. Scraping Ajax's official site was rejected because it covers only Ajax
fixtures, still requires a second source for non-Ajax matches, and fails silently.

The provider is confined to `src/source/` so it can be replaced, or a fallback added,
without touching the rest of the system.

### What gets fetched

For each of the five competitions, the **entire current season's** fixture list — one
request per competition, five per run.

Past fixtures are included, not filtered out. Filtering to future-only would mean every
weekly run deleted the previous week's matches from both phones, so a match watched on
Sunday would vanish by Monday. Keeping the full season makes the calendar read like a
normal calendar and means published events are only ever added or corrected, never
withdrawn for having happened.

The season is derived from the current date rather than configured: August–December belongs
to the season starting that year, January–July to the season starting the previous year.
This makes season rollover automatic, with no annual config edit to forget.

**This design rests on the assumption that the free tier really does return all five
competitions with usable venue and kickoff-status fields.** Verifying that is the first
implementation task (see below).

## Publication

A single GitHub Actions workflow:

- Weekly cron, plus `workflow_dispatch` for forcing a rebuild on hearing a match has moved.
- API key in a repository secret.
- Builds `football.ics` and deploys it to GitHub Pages.

Both iPhones subscribe once to the resulting URL via Settings → Calendar → Accounts → Add
Subscribed Calendar. How often iOS re-fetches a subscribed calendar is a phone-side
setting and outside this system's control; with weekly publication the feed is the
limiting factor, not the phone.

A daily cron would cost nothing against the free tier and would catch TV-driven kickoff
changes in the week before a match. Weekly is the deliberate starting point; the cadence
is a one-line change if a missed change proves it wrong.

## Failure handling

One principle: **never publish a calendar we are not confident in.** GitHub Pages
continues serving the last successful file, so aborting degrades to a slightly stale
calendar rather than an empty one — which makes bailing out the safe default.

| Condition | Behaviour |
|---|---|
| API error or rate limit | Retry with backoff, then fail the job without publishing |
| Club in `teams.ts` missing from `team-ids.json` | Fail immediately, naming the club and suggesting `sync-teams` |
| Ajax has no fixtures in the current season | Fail without publishing — this can only mean a broken competition ID, a season-derivation bug, or a provider outage |
| The rendered calendar contains zero events | Fail without publishing |
| A single competition returns zero fixtures | Log a warning and continue |

The last two rows are deliberately split. A per-competition emptiness check would fire
falsely and often: the KNVB Beker has no scheduled fixtures in early August, and European
draws leave competitions genuinely empty for stretches. Guarding on Ajax's own fixtures and
on the total event count catches the failures that matter — a wholesale data loss — without
turning normal calendar gaps into red builds.

GitHub emails on failed scheduled workflows, so no notification plumbing is needed.

## Testing

Effort concentrates on `classify`, which is pure and carries all the product logic.
Table-driven cases covering each rule and its boundaries:

| Fixture | Expected |
|---|---|
| Ajax vs. Cambuur (Eredivisie) | Optional |
| Ajax vs. Feyenoord (Eredivisie) | Required |
| Ajax vs. a minor side (Conference League) | Required — rule 1 overrides rule 2 |
| PSV vs. Feyenoord | Optional |
| PSV vs. Heracles | Excluded |
| Two non-elite clubs, Champions League quarter-final | Optional |
| The same two clubs, Champions League league phase | Excluded |

The renderer gets snapshot tests for the four things that can break: timezone correctness
across a DST boundary, provisional → all-day, the `Optioneel:` prefix, and UID stability.

The provider mapper is tested against one real API response recorded and committed to the
repo, so mapping is covered without CI touching the network.

No live end-to-end test runs in CI. Instead `npm run verify` performs a real fetch locally
and prints the calendar it would publish, for eyeballing.

## Implementation sequencing

1. **Spike (throwaway):** confirm API-Football's free tier returns Eredivisie, KNVB Beker,
   and all three UEFA competitions, with usable venue and kickoff-status fields. The whole
   design rests on this; prove it before building anything.
2. `Fixture` model and the provider mapper, against the recorded response.
3. `classify` and its test table.
4. ICS rendering, Dutch strings, timezone handling.
5. `sync-teams`.
6. GitHub Actions workflow and Pages deployment.
7. Subscribe both phones; confirm an update propagates.

## Open decisions deliberately deferred

- **Broadcaster information.** Dropped for now. If added later, a competition → channel
  map in config is the low-risk option; a TV-guide scraper is the accurate one.
- **Cron cadence.** Starting weekly, may become daily.
- **`bigEuropeanStageFrom`.** Starting at `qf`, may become `sf`.
