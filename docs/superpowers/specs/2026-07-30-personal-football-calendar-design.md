# Personal Football Calendar — Design

**Date:** 2026-07-30
**Status:** Approved — data source revised 2026-07-30 after the Task 1 spike

> **Revision.** The original design named API-Football. The spike proved its free tier
> serves only seasons 2022–2024, making it useless for a calendar of upcoming matches. The
> source is now ESPN's public soccer API. See
> `docs/superpowers/plans/2026-07-30-spike-findings.md`. Three requirements changed as a
> result, each marked **[revised]** below: matchday numbers are unavailable, no API key is
> needed, and stage detection is now exact rather than parsed.

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
| 3a | European match, **both** clubs on the elite list (any stage) | Optional |
| 3b | European **final**, any of the three competitions | Optional |
| 3c | European match at or beyond `bigEuropeanStageFrom`, with **at least one** elite club | Optional |
| 4 | Eredivisie match, both clubs are tier 1 | Optional |
| — | anything else | Excluded |

Rule 1 precedes rule 2 deliberately: every Ajax match in Europe is Required regardless of
opponent, including a Conference League tie against a minor side.

Rules 3 and 4 apply to matches Ajax is not involved in; any match Ajax plays has already
been resolved by rules 1 or 2.

### Why rule 3 has three parts **[revised 2026-07-30]**

The original rule 3 was `late stage OR both elite`, with the stage threshold applying uniformly
to all three European competitions. Running the real pipeline showed what that produces: 28 of the
93 Optional entries were quarter-finals in which *neither* club was on the elite list —
`Braga vs. Real Betis`, `SC Freiburg vs. Celta Vigo`, `Rayo Vallecano vs. Strasbourg`,
`Shakhtar Donetsk vs. Crystal Palace`. Thirteen came from the Europa League and thirteen from the
Conference League.

The stage override was proposed and approved with a Champions League example in mind — "a
Champions League semi-final is a big night even between two non-elite sides". That reasoning does
not transfer to a Conference League quarter-final between clubs the owner never mentioned.

So the stage override now additionally requires at least one elite club (3c), while finals remain
unconditional in all three competitions (3b) because a European final is a European final. Two
elite clubs playing each other still qualify at any stage (3a), unchanged.

Note that 3b and 3c together mean the Champions League behaves almost exactly as originally
approved — its late rounds nearly always involve an elite club — while the Europa and Conference
Leagues contribute only their finals plus the occasional tie featuring a fallen giant.

## Configuration

Two files. One is authored by hand, one is generated.

`config/teams.ts` — human-authored, names only:

```ts
export const config = {
  myTeam: 'Ajax Amsterdam',
  eredivisie: {
    tier1: ['Ajax Amsterdam', 'PSV Eindhoven', 'Feyenoord Rotterdam'],
    tier2: ['AZ Alkmaar', 'FC Twente', 'FC Utrecht'],
  },
  europeElite: [
    'Real Madrid', 'Barcelona', 'Bayern Munich', 'Manchester City', 'Liverpool',
    'Paris Saint-Germain', 'Internazionale', 'AC Milan', 'Manchester United',
    'Arsenal', 'Chelsea', 'Atlético Madrid', 'Borussia Dortmund', 'Juventus',
    'Napoli', 'Tottenham Hotspur',
  ],
  bigEuropeanStageFrom: 'quarterfinals',   // 'semifinals' if the calendar feels crowded
  displayNames: {                          // provider name → calendar name
    'Ajax Amsterdam': 'AFC Ajax',
    'Feyenoord Rotterdam': 'Feyenoord',
    'AZ Alkmaar': 'AZ',
  },
}
```

Names must match what the provider calls each club — ESPN says `Ajax Amsterdam`, not `Ajax`.
`displayNames` exists because the provider's names are not always what should appear in the
calendar. **[revised]** — originally the design took provider names verbatim, which would
have produced `Ajax vs. Feyenoord Rotterdam` instead of the intended `AFC Ajax vs. Feyenoord`.

Any Eredivisie club not listed in tier 1 or tier 2 is treated as tier 3.

The `europeElite` list and `bigEuropeanStageFrom` are the two dials controlling how busy
the calendar gets. Both are expected to be tuned by hand over time.

`config/team-ids.json` — generated and committed, mapping configured names to the provider's
numeric team IDs:

```json
{ "Ajax Amsterdam": 139, "Feyenoord Rotterdam": 142, "AZ Alkmaar": 140 }
```

**All team comparisons in the classifier use provider IDs, never names.** Name comparison
would break silently the first time the provider returned `Bayern Munich` instead of
`Bayern München`.

`npm run sync-teams` **[revised]** harvests IDs from the fixture responses rather than
querying a team-search endpoint, because ESPN's scoreboard API has none: it fetches all five
competitions, collects every club that appears, and matches those against the names in
`teams.ts`. It is run by hand when a club is added — never as part of a calendar build.
Names it cannot match are reported alongside the club names actually seen, so the correct
spelling can be pasted in.

A club can only be resolved if it appears in a fetched fixture. An elite European club whose
competition has not yet been drawn will not resolve until the draw is made — `sync-teams`
reports this rather than failing silently.

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
| `src/source/` | Call ESPN; map its JSON to `Fixture`. The only code aware the provider exists. | `config/` |
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
  id: string                    // provider event id; becomes the ICS UID
  competition: CompetitionId    // 'eredivisie' | 'knvb-cup' | 'ucl' | 'uel' | 'uecl'
  stage: Stage
  leg: 1 | 2 | null             // two-legged knockout ties only
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
comparison of indices rather than of strings. The values mirror ESPN's `season.slug`, so for
every slug we recognise the mapping is identity rather than translation:

```ts
const STAGES = [
  'regular-season', 'league-phase',           // no knockout meaning
  'first-round', 'second-round',              // domestic cup early rounds
  'knockout-round-playoffs',                  // UEFA play-off round
  'round-of-16', 'quarterfinals', 'semifinals', 'final',
] as const
```

Rule 3's threshold test is therefore
`STAGES.indexOf(stage) >= STAGES.indexOf(config.bigEuropeanStageFrom)`.

**Unrecognised slugs do occur** — this list is not exhaustive and ESPN does not document it.
Today's real `ned.1` data contains `conference-league-playoffs---semifinals` and
`conference-league-playoffs---final`, the Eredivisie's European play-offs, filed under the
league's own competition code.

An unrecognised slug therefore maps to **`regular-season`** **[revised 2026-07-30]**, chosen for
two independent reasons. It is index 0, below every permitted `bigEuropeanStageFrom` value, so an
unknown slug can never satisfy the threshold and be promoted into the calendar. And its Dutch
label is deliberately `null`, so `describe()` emits the competition name alone rather than
inventing a round name.

The original fallback was `league-phase`, which satisfied the first requirement but not the
second: its Dutch label is `Competitiefase`, so a Conference League play-off final rendered as
`Eredivisie · Competitiefase` — a flatly wrong round. Being conservative about *classification*
is not the same as being honest about *description*, and the fallback has to be both.

This is still a strict improvement on the original design, which parsed round labels like
`"Quarter-finals"` with regular expressions and had to be careful that `"Semi-finals"` did not
match the pattern for the final. ESPN provides a machine-readable slug, so that whole class of
bug disappears — but the slug set is open, and the fallback carries real traffic.

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

**Description** **[revised]** — competition, round, and leg, joined by `·`:

```
Eredivisie
KNVB Beker · Achtste finale
UEFA Champions League · Kwartfinale · Heenwedstrijd
UEFA Europa League · Competitiefase
```

Stage and leg names come from Dutch lookup tables keyed on the provider's slugs.

**Matchday numbers are not available and have been dropped.** The original design specified
`Eredivisie · Speelronde 24`, but ESPN reports `week: null` on every league fixture. A league
fixture's description is therefore the competition name alone. Deriving matchday numbers by
clustering fixture dates was considered and rejected: midweek rounds and postponements make
it unreliable, and a wrong matchday number is worse than none. Knockout rounds are
unaffected, and gain leg information the original design did not have.

**No alarms or reminders.** A subscribed feed that fires notifications on my wife's phone
for matches she is not watching would make the calendar unwelcome. Either phone can add
per-event reminders locally.

## Data source **[revised]**

ESPN's public soccer API, unauthenticated:

```
https://site.api.espn.com/apis/site/v2/sports/soccer/<code>/scoreboard?dates=<from>-<to>&limit=1000
```

| Competition | ESPN code |
|---|---|
| Eredivisie | `ned.1` |
| KNVB Beker | `ned.cup` |
| Champions League | `uefa.champions` |
| Europa League | `uefa.europa` |
| Conference League | `uefa.europa.conf` |

Chosen because it is the only free source covering all five required competitions for the
**current and upcoming** seasons. It needs no API key, no account, and has no request quota,
so the design carries no secret at all.

Per event it provides: a stable numeric `id` (the ICS UID), an ISO `date`, `competitors[]`
with `homeAway` and numeric team IDs, `venue.fullName` and `venue.address.city`,
`season.slug` (the exact stage), `leg.value`, and `timeValid`.

`timeValid` is the confirmed/provisional signal, and it is more precise than the original
design's status-code approach: of 306 upcoming 2026/27 Eredivisie fixtures, 171 report
`timeValid: false`, meaning the date is fixed but the kickoff time is not.

**Rejected alternatives.** API-Football's free tier serves only seasons 2022–2024, so it
cannot power a calendar of upcoming matches — this was discovered by the Task 1 spike, after
the original design had named it. Its paid tier (~€15–19/month) would work but was not worth
a subscription. football-data.org's free tier excludes the Europa League, Conference League,
and KNVB Cup, which breaks "all Ajax's international matches, no exceptions". Scraping
ajax.nl covers only Ajax fixtures, still needs a second source, and fails silently.

**The accepted risk:** ESPN's API is undocumented and can change or be restricted without
notice. Two things make this tolerable. The guards refuse to publish a calendar that fails
its sanity checks, so a breakage degrades to a stale feed rather than a wrong one. And the
provider is confined to `src/source/`, so switching to the paid API-Football tier is one
directory's work — the spike already established that provider's data shape.

### What gets fetched

For each of the five competitions, **two** season windows **[revised 2026-07-30]** — the season
`seasonFor` reports and the one after it. Ten requests per run. There is no quota, so this costs
nothing.

The date window for season *Y* is 1 July *Y* to 1 July *Y+1*. A `limit=1000` query returns a full
season comfortably — 309 Eredivisie fixtures, 189 Champions League events — so no chunking is
needed within a window.

**Why two windows and not one.** `seasonFor` reports the season that is *ending* until 1 August.
On 30 July 2026 a single window therefore requested 1 July 2025 – 1 July 2026, whose newest fixture
was 24 May 2026 — two months in the past — while ESPN already held 306 fixtures for 2026/27,
including 34 Ajax matches from 9 August, entirely outside it. The guards passed, because the
team genuinely had fixtures and the calendar genuinely was not empty, so the build would have
published a calendar containing nothing but history.

The second, independent reason: **UEFA qualifying rounds are played in July and belong to the new
season's window.** Under one window, an Ajax July qualifier was invisible for the whole month —
breaking "all Ajax's international matches, no exceptions" outright.

A single two-year range is not an option: ESPN keys internally on one season and returns zero
events for `20250701-20270701`. Fixtures are therefore de-duplicated by event id after fetching,
defensively — the two windows are disjoint in practice, but they abut at 1 July and a duplicated
UID would be a visible calendar bug.

Past fixtures are included, not filtered out. Filtering to future-only would mean every weekly run
deleted the previous week's matches from both phones, so a match watched on Sunday would vanish by
Monday.

One consequence is accepted knowingly: at the 1 August flip the older window rolls off, so the
completed season's fixtures disappear from both phones in a single run. Everything current and
future is unaffected — it is covered by the second window before the flip and the first window
after it — and a July qualifier stays continuously visible across the boundary. Only history is
withdrawn, and only once a year.

The season is derived from the current date rather than configured: August–December belongs
to the season starting that year, January–July to the season starting the previous year.
This makes season rollover automatic, with no annual config edit to forget.

## Publication

A single GitHub Actions workflow:

- Weekly cron, plus `workflow_dispatch` for forcing a rebuild on hearing a match has moved.
- **No secrets** **[revised]** — the source needs no authentication, so there is nothing to
  configure and nothing to leak.
- Builds `football.ics` and deploys it to GitHub Pages.

Both iPhones subscribe once to the resulting URL via Settings → Calendar → Accounts → Add
Subscribed Calendar. How often iOS re-fetches a subscribed calendar is a phone-side
setting and outside this system's control; with weekly publication the feed is the
limiting factor, not the phone.

A daily cron would cost nothing — there is no quota — and would catch TV-driven kickoff
changes in the week before a match. Weekly is the deliberate starting point; the cadence
is a one-line change if a missed change proves it wrong.

## Failure handling

One principle: **never publish a calendar we are not confident in.** GitHub Pages
continues serving the last successful file, so aborting degrades to a slightly stale
calendar rather than an empty one — which makes bailing out the safe default.

| Condition | Behaviour |
|---|---|
| HTTP error, or a response that is not the expected shape | Retry with backoff, then fail the job without publishing |
| Club in `teams.ts` missing from `team-ids.json` | Fail immediately, naming the club and suggesting `sync-teams` |
| Ajax has no fixtures in the current season | Fail without publishing — this can only mean a changed competition code, a season-derivation bug, or a provider outage |
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

The provider mapper is tested against real API responses recorded and committed to the repo,
so mapping is covered without CI touching the network. Because the provider is undocumented,
these recordings do double duty: they are the only written record of the response shape the
code expects.

No live end-to-end test runs in CI. Instead `npm run verify` performs a real fetch locally
and prints the calendar it would publish, for eyeballing.

## Implementation sequencing

1. ~~**Spike:** confirm the free tier's coverage.~~ **Done 2026-07-30.** Invalidated
   API-Football and established ESPN as the source. See
   `docs/superpowers/plans/2026-07-30-spike-findings.md`.
2. `Fixture` model and the provider mapper, against the recorded responses.
3. `classify` and its test table.
4. ICS rendering, Dutch strings, timezone handling.
5. `sync-teams`.
6. GitHub Actions workflow and Pages deployment.
7. Subscribe both phones; confirm an update propagates.

## Open decisions deliberately deferred

- **Broadcaster information.** Dropped for now. If added later, a competition → channel
  map in config is the low-risk option; a TV-guide scraper is the accurate one.
- **Cron cadence.** Starting weekly, may become daily.
- **`bigEuropeanStageFrom`.** Starting at `quarterfinals`, may become `semifinals`.
- **Matchday numbers.** Unavailable from ESPN. If they ever matter enough, a second source
  or date-clustering could supply them, but neither is worth it today.
- **Provider fallback.** If ESPN's API breaks, the paid API-Football tier is the known-good
  replacement and needs only `src/source/` rewritten.
