# personal-football-calendar

Publishes a Dutch `.ics` feed of the football matches I want to watch, rebuilt
weekly by GitHub Actions and served from GitHub Pages.

Matches I will definitely watch appear as-is. Matches I would like to watch are
prefixed `Optioneel:`.

## Subscribing

Open the Pages URL on the phone and tap **Abonneren op iPhone**, or add the
`.ics` URL manually via Settings → Calendar → Accounts → Add Subscribed Calendar.

How often iOS re-fetches a subscribed calendar is a phone-side setting and
outside this project's control.

## Changing what appears

Edit `config/teams.ts`. Club names must match ESPN's spelling exactly
(`Ajax Amsterdam`, not `Ajax`) — `displayNames` is what maps that ESPN name to
what actually shows up in the calendar (`AFC Ajax`).

- `eredivisie.tier1` / `tier2` — Ajax matches against these clubs are required;
  against anyone else they are `Optioneel:`. Two tier-1 clubs playing each other
  appear as `Optioneel:` even without Ajax.
- `europeElite` — two of these clubs playing each other appear as `Optioneel:`,
  at any stage, league phase included.
- `bigEuropeanStageFrom` — European matches from this stage onward appear as
  `Optioneel:` too, but only when at least one elite club is involved. Its type
  (`BigStageThreshold`) permits any of `'first-round'`, `'second-round'`,
  `'third-round'`, `'playoff-round'`, `'knockout-round-playoffs'`,
  `'round-of-16'`, `'quarterfinals'`, `'semifinals'`, or `'final'` — it only
  excludes the two league-phase stages, since allowing either of those would
  admit every European fixture the
  calendar sees, elite or not. In practice `'quarterfinals'` or `'semifinals'`
  are the sensible choices; anything earlier (e.g. `'round-of-16'` or below)
  would flood the calendar with early-round matches involving one elite club
  against a nobody.
- `displayNames` — maps ESPN's club name to the name shown in the calendar.

Concretely, a big-European-competition match appears when any of these three
hold: both clubs are elite (any stage); it's a final, in any of the three
competitions; or the match is at or beyond `bigEuropeanStageFrom` **and** at
least one club is elite. That last condition matters — without it, the
threshold alone would admit Europa League and Conference League
quarter-finals between clubs nobody asked about.

After adding a club, run `npm run sync-teams` to refresh `config/team-ids.json`,
then commit both files. The build fails loudly if a configured club has no ID.

## Competitions

Ten ESPN competitions are fetched, each for the current and next season window:

| Competition | ESPN code | European? |
|---|---|---|
| Eredivisie | `ned.1` | no |
| KNVB Beker | `ned.cup` | no |
| Johan Cruijff Schaal | `ned.supercup` | no |
| UEFA Champions League | `uefa.champions` | yes |
| UEFA Europa League | `uefa.europa` | yes |
| UEFA Conference League | `uefa.europa.conf` | yes |
| UEFA Champions League kwalificatie | `uefa.champions_qual` | yes |
| UEFA Europa League kwalificatie | `uefa.europa_qual` | yes |
| UEFA Conference League kwalificatie | `uefa.europa.conf_qual` | yes |
| Oefenwedstrijd (friendlies) | `club.friendly` | no |

The Johan Cruijff Schaal and friendlies are not European, so a match in either is
only included via the domestic rule (opponent tier) when my team plays in it —
never via rule 4, which is Eredivisie-only.

## Data source

ESPN's public soccer API, unauthenticated — there is no API key and no secret
anywhere in this project.

It is undocumented and could change without notice. Two things make that
tolerable: the guards refuse to publish a calendar that fails its sanity checks,
so a breakage degrades to a stale feed rather than a wrong one; and the provider
is confined to `src/source/`, so switching to a paid API is one directory's work.

The non-obvious fact worth recording here: ESPN files UEFA qualifying rounds
under entirely separate league codes from the main competition (e.g.
`uefa.champions_qual`, not `uefa.champions`) — a qualifying-round fixture never
appears under the main competition's own code at all. Missing this previously
meant Ajax's own European qualifiers were silently absent from the calendar.

Matchday numbers are unavailable from this source, so league fixtures are
described by competition alone. Knockout rounds and legs are described in full.

## Commands

| Command | What it does |
|---|---|
| `npm test` | Run the test suite |
| `npm run test:zones` | Run the ICS render tests under five timezones |
| `npm run typecheck` | Typecheck without emitting |
| `npm run verify` | Real fetch; print what would be published. Writes nothing. |
| `npm run sync-teams` | Regenerate `config/team-ids.json` |
| `npm run build:calendar` | Build `dist/football.ics` |

No environment variables are required to run any of these locally.
`npm run build:calendar` accepts an optional `CALENDAR_HOST` to also emit a
subscribe page (`dist/index.html`); it is host + path only, e.g.
`craimasjien.github.io/personal-football-calendar` — no scheme, no trailing
slash. CI computes this automatically from `GITHUB_REPOSITORY` at build time,
so it only needs setting by hand for a local `npm run build:calendar` — it is
not required configuration otherwise.

## First deploy

The repository already exists at
`https://github.com/craimasjien/personal-football-calendar` with a remote
already configured, so there is no repository to create.

1. Enable Pages: **Settings → Pages → Build and deployment → Source → GitHub
   Actions**. This must be done before the first workflow run or the deploy
   step fails.
   - A private repository needs GitHub Pro to serve Pages. If that's
     unavailable, make the repository public — the calendar contains only
     public fixture data and no credentials of any kind.
2. The workflow triggers on push to `main` and on manual dispatch. Since work
   currently lives on `feature/football-calendar`, the first deploy needs
   either a merge to `main` or a manual run from the **Actions** tab.
3. After a successful run, the feed is at
   `https://craimasjien.github.io/personal-football-calendar/football.ics`,
   with a tap-to-subscribe page at the root.
4. To force a rebuild when a kickoff time moves: **Actions → Publish
   calendar → Run workflow**.

## Design

See `docs/superpowers/specs/2026-07-30-personal-football-calendar-design.md` and
`docs/superpowers/plans/2026-07-30-spike-findings.md`.
