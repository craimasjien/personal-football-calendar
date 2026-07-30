# Personal Football Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Revised 2026-07-30 after the Task 1 spike.** The original plan targeted API-Football;
> its free tier serves only seasons 2022–2024, which cannot power a calendar of upcoming
> matches. The source is now ESPN's public soccer API. Task 1 is complete; Tasks 3, 4, 5, 11
> and 12 were rewritten, and Tasks 2, 6, 8, 10 adjusted. Tasks 7, 9 and 13 are unchanged.
> Spike findings: `docs/superpowers/plans/2026-07-30-spike-findings.md`.

**Goal:** Publish a Dutch-language `.ics` feed of Ajax fixtures plus selected big matches to GitHub Pages, rebuilt weekly by a GitHub Action, subscribable from two iPhones.

**Architecture:** A stateless five-stage pipeline — fetch → normalise → classify → render → publish. Every run rebuilds the whole calendar from the provider API; there is no database and no state between runs. All product logic lives in pure functions (`classify`, `render`) that take plain data, so the interesting behaviour is unit-testable without network or filesystem. The data provider is confined to `src/source/`.

**Tech Stack:** TypeScript on Node 22 (ESM), `ical-generator` for ICS output, `vitest` for tests, `tsx` to run scripts, GitHub Actions + GitHub Pages for publication. No framework, no bundler, no database, **no authentication of any kind**.

## Global Constraints

- **Node >= 22**, ESM only (`"type": "module"`). Use `import`, never `require`.
- **All user-facing calendar text is Dutch.** Summaries, descriptions, calendar name. Never emit English round names.
- **Match title separator is `vs.`** — `AFC Ajax vs. Feyenoord`. Not `-`, not `v`.
- **Optional entries are prefixed exactly `Optioneel: `** (capital O, colon, one space).
- **Timezone is `Europe/Amsterdam`**, always written explicitly into the ICS. Never emit floating or UTC-only times for confirmed kickoffs.
- **Teams are compared by numeric provider ID, never by name.** Name comparison is a bug.
- **Event duration for confirmed kickoffs is exactly 2 hours.**
- **UID format is exactly `fixture-<providerId>@football-calendar`.** Stability of this string is what makes updates work on the phones; never change it.
- **No VALARM / reminders in the output.** Ever.
- **Never publish a calendar we are not confident in.** Any guard failure or fetch failure must exit non-zero *without* writing `dist/`.
- **Five competitions**, with these exact ESPN codes:
  `eredivisie`=`ned.1`, `knvb-cup`=`ned.cup`, `ucl`=`uefa.champions`, `uel`=`uefa.europa`, `uecl`=`uefa.europa.conf`.
- **No API key, no secrets, no `.env`.** ESPN's endpoint is unauthenticated. If you find yourself adding key handling, you have misread the plan.
- **`Stage` values mirror ESPN's `season.slug` verbatim** — never invent an abbreviation. The nine values are `regular-season`, `league-phase`, `first-round`, `second-round`, `knockout-round-playoffs`, `round-of-16`, `quarterfinals`, `semifinals`, `final`.
- **Matchday numbers do not exist.** ESPN reports `week: null`. Never fabricate a `Speelronde` number.
- **Commits:** end each task with one commit of that task's files, on the current feature branch. Use the repo's existing git identity — do **not** pass `--author`, and do **not** add `Co-Authored-By`, `Generated with`, or any other attribution trailer. Message format `<type>: <imperative summary>`.
- **Never `git push`, never merge, never touch `main`.** Steps marked `(USER)` are the user's to run.

**Spec:** `docs/superpowers/specs/2026-07-30-personal-football-calendar-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore` | Toolchain |
| `config/teams.ts` | Hand-authored: tiers, elite list, display-name overrides, threshold. Plain data. |
| `config/team-ids.json` | Generated + committed: club name → ESPN team ID |
| `src/domain.ts` | `Fixture`, `Team`, `Stage`, `STAGES`, `CompetitionId`, `Inclusion`, `CalendarEntry`. Types only. |
| `src/source/competitions.ts` | Competition registry: our ID ↔ ESPN code, Dutch names, which are European |
| `src/source/season.ts` | Derive season year and its fetch date-window from a date |
| `src/source/stage.ts` | Validate/normalise ESPN `season.slug` → `Stage` |
| `src/source/map.ts` | ESPN event JSON → `Fixture`. The only code that knows ESPN's field names. |
| `src/source/espn.ts` | HTTP: fetch one competition's season, with retry/backoff |
| `src/config.ts` | Resolve `config/teams.ts` names against `team-ids.json` → `ResolvedConfig`. Fails loudly on unknown names. |
| `src/classify.ts` | `(Fixture, ResolvedConfig) → Inclusion`. Pure. All product logic. |
| `src/ics/dutch.ts` | Dutch strings: summary, description, stage and leg labels |
| `src/ics/render.ts` | `CalendarEntry[] → string` (ICS). Pure. |
| `src/guards.ts` | Sanity checks that must pass before publishing |
| `src/build.ts` | Orchestrate the pipeline, return the ICS plus per-competition counts. No file I/O. |
| `src/main.ts` | Entry point: write `dist/`. The only module with file side effects. |
| `scripts/sync-teams.ts` | Regenerate `config/team-ids.json` by harvesting IDs from fixtures |
| `scripts/verify.ts` | Real fetch, print what would be published. Writes nothing. |
| `.github/workflows/publish.yml` | Weekly cron + manual dispatch → build → deploy to Pages |
| `tests/fixtures/espn-*.json` | Recorded ESPN responses (already committed by Task 1) |

---

### Task 1: Spike — verify provider coverage — ✅ COMPLETE

Done 2026-07-30. **Do not re-run.** Outcome:

- API-Football's free tier is limited to seasons 2022–2024 → unusable, design revised.
- ESPN's public API covers all five competitions for current and future seasons, with no key.
- `season.slug` gives the exact stage; `competitions[0].timeValid` gives confirmed vs. provisional.
- Ajax Amsterdam is ESPN team **139**.
- Recorded responses committed to `tests/fixtures/`: `espn-eredivisie.json` (6 events, both
  `timeValid` states), `espn-ucl.json` (19 events, every knockout slug and both legs),
  `espn-knvb-cup.json` (11 events, all cup rounds). Sampled from full-season pulls to
  preserve every variant while staying small enough to commit.
- Findings: `docs/superpowers/plans/2026-07-30-spike-findings.md`.

---

### Task 2: Scaffolding, domain types, and config data

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`
- Create: `src/domain.ts`
- Create: `config/teams.ts`
- Test: `tests/domain.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: types `Team`, `Venue`, `Kickoff`, `Fixture`, `Inclusion`, `CalendarEntry`, `Stage`, `CompetitionId`; constants `STAGES`, `COMPETITION_IDS`; `rawConfig` and `RawConfig` from `config/teams.ts`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "my-personal-football-calendar",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "build:calendar": "tsx src/main.ts",
    "verify": "tsx scripts/verify.ts",
    "sync-teams": "tsx scripts/sync-teams.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "ical-generator": "^8.0.1"
  },
  "devDependencies": {
    "@types/node": "^22.9.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["node"],
    "strict": true,
    "verbatimModuleSyntax": true,
    "allowImportingTsExtensions": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src", "config", "scripts", "tests"]
}
```

`allowImportingTsExtensions` is required, not optional: this project writes relative imports
with explicit `.ts` extensions, and under `moduleResolution: bundler` a *value* import ending
in `.ts` fails with `TS5097` without it. Type-only imports happen to be exempt, so the gap
only surfaces on the first value import. Its prerequisite (`noEmit`) is already set.

- [ ] **Step 3: Create `vitest.config.ts` and `.gitignore`**

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { include: ['tests/**/*.test.ts'] },
})
```

`.gitignore`:

```
node_modules/
dist/
```

`config/team-ids.json` is **not** ignored — generated but committed, per the spec. There is
no `.env` in this project; the data source needs no credentials.

- [ ] **Step 4: Install dependencies**

Run: `npm install`
Expected: completes, creates `package-lock.json`.

- [ ] **Step 5: Create `src/domain.ts`**

```ts
/**
 * Ordered stage scale. Values mirror ESPN's `season.slug` verbatim so no lossy
 * translation is needed. Index order is meaningful — see classify.ts.
 *
 * 'regular-season' and 'league-phase' both mean "not a knockout round"; they sit
 * at the bottom so any threshold comparison excludes them.
 */
export const STAGES = [
  'regular-season',
  'league-phase',
  'first-round',
  'second-round',
  'knockout-round-playoffs',
  'round-of-16',
  'quarterfinals',
  'semifinals',
  'final',
] as const
export type Stage = (typeof STAGES)[number]

export const COMPETITION_IDS = ['eredivisie', 'knvb-cup', 'ucl', 'uel', 'uecl'] as const
export type CompetitionId = (typeof COMPETITION_IDS)[number]

export type Team = {
  /** ESPN team ID. The only field ever compared. */
  id: number
  /** ESPN display name, e.g. "Ajax Amsterdam". Mapped through displayNames for output. */
  name: string
}

export type Venue = { name: string; city: string }

export type Kickoff =
  | { kind: 'confirmed'; utc: Date }
  /** `date` is YYYY-MM-DD in Europe/Amsterdam. Kickoff time not yet fixed. */
  | { kind: 'provisional'; date: string }

export type Fixture = {
  /** ESPN event ID as a string. Becomes the ICS UID. */
  id: string
  competition: CompetitionId
  stage: Stage
  /** Leg of a two-legged knockout tie, else null. */
  leg: 1 | 2 | null
  home: Team
  away: Team
  venue: Venue | null
  kickoff: Kickoff
}

export type Inclusion = 'required' | 'optional' | 'excluded'

export type CalendarEntry = {
  fixture: Fixture
  /** Excluded fixtures never become entries. */
  inclusion: 'required' | 'optional'
}
```

- [ ] **Step 6: Create `config/teams.ts`**

Club names must match ESPN's `displayName` exactly. The values below are real ESPN names
confirmed by the Task 1 spike.

```ts
import type { Stage } from '../src/domain.ts'

export type RawConfig = {
  myTeam: string
  eredivisie: { tier1: string[]; tier2: string[] }
  europeElite: string[]
  bigEuropeanStageFrom: Stage
  /** Provider name → the name to show in the calendar. */
  displayNames: Record<string, string>
}

export const rawConfig: RawConfig = {
  myTeam: 'Ajax Amsterdam',

  eredivisie: {
    tier1: ['Ajax Amsterdam', 'PSV Eindhoven', 'Feyenoord Rotterdam'],
    tier2: ['AZ Alkmaar', 'FC Twente', 'FC Utrecht'],
  },

  /**
   * Best-guess ESPN spellings. `npm run sync-teams` (Task 11) reports any it
   * cannot match, so expect to correct a few of these.
   */
  europeElite: [
    'Real Madrid',
    'Barcelona',
    'Bayern Munich',
    'Manchester City',
    'Liverpool',
    'Paris Saint-Germain',
    'Internazionale',
    'AC Milan',
    'Manchester United',
    'Arsenal',
    'Chelsea',
    'Atlético Madrid',
    'Borussia Dortmund',
    'Juventus',
    'Napoli',
    'Tottenham Hotspur',
  ],

  /** Quarter-finals onward count as big. 'semifinals' if the calendar feels crowded. */
  bigEuropeanStageFrom: 'quarterfinals',

  /** ESPN's names are not always what should appear in the calendar. */
  displayNames: {
    'Ajax Amsterdam': 'AFC Ajax',
    'Feyenoord Rotterdam': 'Feyenoord',
    'AZ Alkmaar': 'AZ',
    'PSV Eindhoven': 'PSV',
  },
}
```

- [ ] **Step 7: Write a test that the config is internally coherent**

Create `tests/domain.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { STAGES } from '../src/domain.ts'
import { rawConfig } from '../config/teams.ts'

describe('config/teams.ts', () => {
  it('lists myTeam in tier1', () => {
    expect(rawConfig.eredivisie.tier1).toContain(rawConfig.myTeam)
  })

  it('has no club in both tier1 and tier2', () => {
    const overlap = rawConfig.eredivisie.tier1.filter((t) =>
      rawConfig.eredivisie.tier2.includes(t),
    )
    expect(overlap).toEqual([])
  })

  it('has no duplicate names in any list', () => {
    for (const list of [
      rawConfig.eredivisie.tier1,
      rawConfig.eredivisie.tier2,
      rawConfig.europeElite,
    ]) {
      expect(new Set(list).size).toBe(list.length)
    }
  })

  it('uses a real stage for bigEuropeanStageFrom', () => {
    expect(STAGES).toContain(rawConfig.bigEuropeanStageFrom)
  })

  it('picks a knockout stage for bigEuropeanStageFrom, not a league phase', () => {
    expect(['regular-season', 'league-phase']).not.toContain(rawConfig.bigEuropeanStageFrom)
  })
})

describe('STAGES', () => {
  it('orders league phases below every knockout round', () => {
    expect(STAGES.indexOf('league-phase')).toBeLessThan(STAGES.indexOf('round-of-16'))
    expect(STAGES.indexOf('regular-season')).toBeLessThan(STAGES.indexOf('quarterfinals'))
  })

  it('orders knockout rounds from earliest to latest', () => {
    const order = ['round-of-16', 'quarterfinals', 'semifinals', 'final'] as const
    const indices = order.map((s) => STAGES.indexOf(s))
    expect(indices).toEqual([...indices].sort((a, b) => a - b))
  })
})
```

- [ ] **Step 8: Run the tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: 7 tests pass, no type errors.

- [ ] **Step 9: Commit**

One commit for this task. No attribution trailers.

---

### Task 3: Provider vocabulary — competitions, season window, stage

Three small pure modules translating between our vocabulary and ESPN's.

**Files:**
- Create: `src/source/competitions.ts`, `src/source/season.ts`, `src/source/stage.ts`
- Test: `tests/source/competitions.test.ts`, `tests/source/season.test.ts`, `tests/source/stage.test.ts`

**Interfaces:**
- Consumes: `CompetitionId`, `Stage`, `STAGES`, `COMPETITION_IDS` from `src/domain.ts`
- Produces: `COMPETITIONS: Record<CompetitionId, { code: string; dutchName: string }>`, `AJAX_TEAM_ID: number`, `isEuropean(id): boolean`, `seasonFor(now: Date): number`, `seasonWindow(season: number): { from: string; to: string }`, `toStage(slug: string | null | undefined): Stage`

- [ ] **Step 1: Write the failing tests for the competition registry**

Create `tests/source/competitions.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { COMPETITION_IDS } from '../../src/domain.ts'
import { AJAX_TEAM_ID, COMPETITIONS, isEuropean } from '../../src/source/competitions.ts'

describe('COMPETITIONS', () => {
  it('covers every competition id', () => {
    expect(Object.keys(COMPETITIONS).sort()).toEqual([...COMPETITION_IDS].sort())
  })

  it('uses the ESPN codes confirmed by the spike', () => {
    expect(COMPETITIONS.eredivisie.code).toBe('ned.1')
    expect(COMPETITIONS['knvb-cup'].code).toBe('ned.cup')
    expect(COMPETITIONS.ucl.code).toBe('uefa.champions')
    expect(COMPETITIONS.uel.code).toBe('uefa.europa')
    expect(COMPETITIONS.uecl.code).toBe('uefa.europa.conf')
  })

  it('gives every competition a distinct code', () => {
    const codes = Object.values(COMPETITIONS).map((c) => c.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('names competitions in Dutch', () => {
    expect(COMPETITIONS.eredivisie.dutchName).toBe('Eredivisie')
    expect(COMPETITIONS['knvb-cup'].dutchName).toBe('KNVB Beker')
  })
})

describe('AJAX_TEAM_ID', () => {
  it('is the ESPN id confirmed by the spike', () => {
    expect(AJAX_TEAM_ID).toBe(139)
  })
})

describe('isEuropean', () => {
  it('is true for the three UEFA competitions', () => {
    expect(isEuropean('ucl')).toBe(true)
    expect(isEuropean('uel')).toBe(true)
    expect(isEuropean('uecl')).toBe(true)
  })

  it('is false for domestic competitions', () => {
    expect(isEuropean('eredivisie')).toBe(false)
    expect(isEuropean('knvb-cup')).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run tests/source/competitions.test.ts`
Expected: FAIL — cannot resolve `../../src/source/competitions.ts`.

- [ ] **Step 3: Implement the competition registry**

Create `src/source/competitions.ts`:

```ts
import type { CompetitionId } from '../domain.ts'

/** ESPN league codes, confirmed by the Task 1 spike. */
export const COMPETITIONS: Record<CompetitionId, { code: string; dutchName: string }> = {
  eredivisie: { code: 'ned.1', dutchName: 'Eredivisie' },
  'knvb-cup': { code: 'ned.cup', dutchName: 'KNVB Beker' },
  ucl: { code: 'uefa.champions', dutchName: 'UEFA Champions League' },
  uel: { code: 'uefa.europa', dutchName: 'UEFA Europa League' },
  uecl: { code: 'uefa.europa.conf', dutchName: 'UEFA Conference League' },
}

/** ESPN's id for Ajax Amsterdam. Confirmed by the spike. */
export const AJAX_TEAM_ID = 139

const EUROPEAN = new Set<CompetitionId>(['ucl', 'uel', 'uecl'])

export function isEuropean(id: CompetitionId): boolean {
  return EUROPEAN.has(id)
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npx vitest run tests/source/competitions.test.ts`
Expected: 8 tests PASS.

- [ ] **Step 5: Write the failing tests for season derivation and its date window**

Create `tests/source/season.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { seasonFor, seasonWindow } from '../../src/source/season.ts'

describe('seasonFor', () => {
  it('treats August as the start of a new season', () => {
    expect(seasonFor(new Date('2026-08-01T00:00:00Z'))).toBe(2026)
  })

  it('treats July as still belonging to the previous season', () => {
    expect(seasonFor(new Date('2026-07-31T23:59:59Z'))).toBe(2025)
  })

  it('keeps December in the season that started that year', () => {
    expect(seasonFor(new Date('2026-12-31T00:00:00Z'))).toBe(2026)
  })

  it('keeps January in the season that started the previous year', () => {
    expect(seasonFor(new Date('2027-01-01T00:00:00Z'))).toBe(2026)
  })

  it('keeps May in the season that started the previous year', () => {
    expect(seasonFor(new Date('2027-05-20T00:00:00Z'))).toBe(2026)
  })
})

describe('seasonWindow', () => {
  it('spans 1 July to 1 July of the following year, in ESPN date format', () => {
    expect(seasonWindow(2026)).toEqual({ from: '20260701', to: '20270701' })
  })

  it('handles a different season', () => {
    expect(seasonWindow(2025)).toEqual({ from: '20250701', to: '20260701' })
  })
})
```

- [ ] **Step 6: Run it to make sure it fails**

Run: `npx vitest run tests/source/season.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement season derivation**

Create `src/source/season.ts`:

```ts
/**
 * A season is labelled by the calendar year it started in: 2026/27 is season 2026.
 * August–December belong to the season starting that year; January–July to the one
 * that started the year before.
 *
 * Derived from the date rather than configured, so season rollover needs no annual edit.
 */
export function seasonFor(now: Date): number {
  const month = now.getUTCMonth() // 0 = January
  const year = now.getUTCFullYear()
  const AUGUST = 7
  return month >= AUGUST ? year : year - 1
}

/**
 * The date range to ask ESPN for, in its YYYYMMDD format. 1 July to 1 July comfortably
 * brackets a European football season including early qualifiers and late finals.
 */
export function seasonWindow(season: number): { from: string; to: string } {
  return { from: `${season}0701`, to: `${season + 1}0701` }
}
```

- [ ] **Step 8: Run the tests and make sure they pass**

Run: `npx vitest run tests/source/season.test.ts`
Expected: 8 tests PASS.

- [ ] **Step 9: Write the failing tests for stage normalisation**

Create `tests/source/stage.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { STAGES } from '../../src/domain.ts'
import { toStage } from '../../src/source/stage.ts'

describe('toStage', () => {
  it('passes through every slug ESPN actually uses', () => {
    for (const slug of STAGES) {
      expect(toStage(slug)).toBe(slug)
    }
  })

  it('recognises the slugs observed in the spike', () => {
    expect(toStage('regular-season')).toBe('regular-season')
    expect(toStage('league-phase')).toBe('league-phase')
    expect(toStage('first-round')).toBe('first-round')
    expect(toStage('second-round')).toBe('second-round')
    expect(toStage('knockout-round-playoffs')).toBe('knockout-round-playoffs')
    expect(toStage('round-of-16')).toBe('round-of-16')
    expect(toStage('quarterfinals')).toBe('quarterfinals')
    expect(toStage('semifinals')).toBe('semifinals')
    expect(toStage('final')).toBe('final')
  })

  it('falls back to league-phase for an unknown slug', () => {
    expect(toStage('some-new-uefa-format')).toBe('league-phase')
  })

  it('falls back to league-phase for a missing slug', () => {
    expect(toStage(null)).toBe('league-phase')
    expect(toStage(undefined)).toBe('league-phase')
  })

  it('never returns a stage at or above the quarter-finals for unknown input', () => {
    // The fallback must be conservative: it may only make a fixture LESS likely
    // to be included, never more.
    const fallback = toStage('unrecognised')
    expect(STAGES.indexOf(fallback)).toBeLessThan(STAGES.indexOf('quarterfinals'))
  })
})
```

- [ ] **Step 10: Run it to make sure it fails**

Run: `npx vitest run tests/source/stage.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 11: Implement stage normalisation**

Create `src/source/stage.ts`:

```ts
import { STAGES, type Stage } from '../domain.ts'

const KNOWN = new Set<string>(STAGES)

/**
 * ESPN reports the stage as a machine-readable `season.slug`, and our Stage values
 * mirror those slugs exactly — so this is validation, not translation.
 *
 * An unrecognised or missing slug becomes 'league-phase': the conservative choice,
 * since a lower stage only ever makes a fixture less likely to be included. A new
 * UEFA format inventing a slug we do not know must never silently promote fixtures
 * into the calendar.
 */
export function toStage(slug: string | null | undefined): Stage {
  return slug !== null && slug !== undefined && KNOWN.has(slug) ? (slug as Stage) : 'league-phase'
}
```

- [ ] **Step 12: Run the tests and make sure they pass**

Run: `npx vitest run tests/source/stage.test.ts`
Expected: all PASS.

- [ ] **Step 13: Commit**

One commit for this task.

---

### Task 4: Provider mapper

Turn ESPN event JSON into `Fixture`. The only module that knows ESPN's field names.

**Files:**
- Create: `src/source/map.ts`
- Test: `tests/source/map.test.ts`

**Interfaces:**
- Consumes: `Fixture`, `Team`, `Venue`, `Kickoff`, `CompetitionId` from `src/domain.ts`; `toStage` from `src/source/stage.ts`
- Produces: `mapEvent(raw: unknown, competition: CompetitionId): Fixture | null` — returns `null` for events that must not appear (cancelled, or missing a home/away pair). Also `amsterdamDate(iso: string): string`.

**ESPN event shape** (only the fields we use):

```
{
  id: "401875655",
  date: "2026-08-07T18:00Z",
  season: { slug: "regular-season" },
  status: { type: { name: "STATUS_SCHEDULED" } },
  competitions: [{
    timeValid: true,
    leg: { value: 1 } | null,
    venue: { fullName: "Johan Cruijff ArenA", address: { city: "Amsterdam" } },
    competitors: [
      { homeAway: "home", team: { id: "139", displayName: "Ajax Amsterdam" } },
      { homeAway: "away", team: { id: "142", displayName: "Feyenoord Rotterdam" } }
    ]
  }]
}
```

- [ ] **Step 1: Write the failing tests**

Create `tests/source/map.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { amsterdamDate, mapEvent } from '../../src/source/map.ts'

/** Minimal ESPN-shaped event, overridable per test. */
function event(overrides: Record<string, unknown> = {}, compOverrides: Record<string, unknown> = {}) {
  return {
    id: '401875655',
    date: '2026-03-15T13:30Z',
    season: { slug: 'regular-season' },
    status: { type: { name: 'STATUS_SCHEDULED' } },
    competitions: [
      {
        timeValid: true,
        leg: null,
        venue: { fullName: 'Johan Cruijff ArenA', address: { city: 'Amsterdam' } },
        competitors: [
          { homeAway: 'home', team: { id: '139', displayName: 'Ajax Amsterdam' } },
          { homeAway: 'away', team: { id: '142', displayName: 'Feyenoord Rotterdam' } },
        ],
        ...compOverrides,
      },
    ],
    ...overrides,
  }
}

describe('mapEvent', () => {
  it('maps a confirmed league fixture', () => {
    const f = mapEvent(event(), 'eredivisie')!
    expect(f.id).toBe('401875655')
    expect(f.competition).toBe('eredivisie')
    expect(f.stage).toBe('regular-season')
    expect(f.leg).toBeNull()
    expect(f.home).toEqual({ id: 139, name: 'Ajax Amsterdam' })
    expect(f.away).toEqual({ id: 142, name: 'Feyenoord Rotterdam' })
    expect(f.venue).toEqual({ name: 'Johan Cruijff ArenA', city: 'Amsterdam' })
    expect(f.kickoff).toEqual({ kind: 'confirmed', utc: new Date('2026-03-15T13:30Z') })
  })

  it('converts ESPN string team ids to numbers, so comparisons are numeric', () => {
    const f = mapEvent(event(), 'eredivisie')!
    expect(typeof f.home.id).toBe('number')
    expect(typeof f.away.id).toBe('number')
  })

  it('reads home and away from homeAway, not from array order', () => {
    const reversed = event({}, {
      competitors: [
        { homeAway: 'away', team: { id: '142', displayName: 'Feyenoord Rotterdam' } },
        { homeAway: 'home', team: { id: '139', displayName: 'Ajax Amsterdam' } },
      ],
    })
    const f = mapEvent(reversed, 'eredivisie')!
    expect(f.home.id).toBe(139)
    expect(f.away.id).toBe(142)
  })

  it('treats timeValid false as a provisional kickoff on the Amsterdam date', () => {
    const f = mapEvent(event({}, { timeValid: false }), 'eredivisie')!
    expect(f.kickoff).toEqual({ kind: 'provisional', date: '2026-03-15' })
  })

  it('treats a missing timeValid as provisional, not confirmed', () => {
    const f = mapEvent(event({}, { timeValid: undefined }), 'eredivisie')!
    expect(f.kickoff.kind).toBe('provisional')
  })

  it('maps a missing venue to null rather than guessing', () => {
    const f = mapEvent(event({}, { venue: null }), 'eredivisie')!
    expect(f.venue).toBeNull()
  })

  it('maps a venue with no city to null rather than a half address', () => {
    const f = mapEvent(event({}, { venue: { fullName: 'Somewhere', address: {} } }), 'eredivisie')!
    expect(f.venue).toBeNull()
  })

  it('maps the stage slug and leg of a knockout fixture', () => {
    const f = mapEvent(
      event({ season: { slug: 'quarterfinals' } }, { leg: { value: 2 } }),
      'ucl',
    )!
    expect(f.stage).toBe('quarterfinals')
    expect(f.leg).toBe(2)
  })

  it('ignores a leg value outside 1 and 2', () => {
    const f = mapEvent(event({}, { leg: { value: 7 } }), 'ucl')!
    expect(f.leg).toBeNull()
  })

  it('drops cancelled events entirely', () => {
    const cancelled = event({ status: { type: { name: 'STATUS_CANCELED' } } })
    expect(mapEvent(cancelled, 'eredivisie')).toBeNull()
  })

  it('treats a postponed event as provisional, since its listed time is stale', () => {
    const postponed = event({ status: { type: { name: 'STATUS_POSTPONED' } } })
    expect(mapEvent(postponed, 'eredivisie')!.kickoff).toEqual({
      kind: 'provisional',
      date: '2026-03-15',
    })
  })

  it('drops an event missing a home or away competitor', () => {
    const oneSided = event({}, {
      competitors: [{ homeAway: 'home', team: { id: '139', displayName: 'Ajax Amsterdam' } }],
    })
    expect(mapEvent(oneSided, 'eredivisie')).toBeNull()
  })

  it('drops an event with no competitions array', () => {
    expect(mapEvent({ id: '1', competitions: [] }, 'eredivisie')).toBeNull()
  })
})

describe('amsterdamDate', () => {
  it('uses the Amsterdam calendar day, not the UTC one', () => {
    // 23:30 UTC is already the next day in Amsterdam (CET, +1).
    expect(amsterdamDate('2026-01-10T23:30:00Z')).toBe('2026-01-11')
  })

  it('handles summer time', () => {
    // 22:30 UTC is the next day in Amsterdam during CEST (+2).
    expect(amsterdamDate('2026-06-10T22:30:00Z')).toBe('2026-06-11')
  })

  it('leaves a midday timestamp on its own day', () => {
    expect(amsterdamDate('2026-03-15T13:30:00Z')).toBe('2026-03-15')
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run tests/source/map.test.ts`
Expected: FAIL — cannot resolve `src/source/map.ts`.

- [ ] **Step 3: Implement the mapper**

Create `src/source/map.ts`:

```ts
import type { CompetitionId, Fixture, Kickoff, Team, Venue } from '../domain.ts'
import { toStage } from './stage.ts'

/** The shape we rely on from ESPN. Everything else in the response is ignored. */
type RawCompetitor = {
  homeAway?: string
  team?: { id?: string; displayName?: string }
}

type RawCompetition = {
  timeValid?: boolean
  leg?: { value?: number } | null
  venue?: { fullName?: string; address?: { city?: string } } | null
  competitors?: RawCompetitor[]
}

type RawEvent = {
  id?: string
  date?: string
  season?: { slug?: string } | null
  status?: { type?: { name?: string } } | null
  competitions?: RawCompetition[]
}

/** Events in these states must not appear in the calendar at all. */
const DROPPED_STATUSES = new Set(['STATUS_CANCELED', 'STATUS_CANCELLED'])

/** States where the listed kickoff time is not trustworthy. */
const PROVISIONAL_STATUSES = new Set(['STATUS_POSTPONED'])

/** Format an instant as a YYYY-MM-DD calendar day in Amsterdam. */
export function amsterdamDate(iso: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

function toTeam(raw: RawCompetitor | undefined): Team | null {
  const id = raw?.team?.id
  const name = raw?.team?.displayName
  if (id === undefined || name === undefined) return null
  const numericId = Number(id)
  if (!Number.isFinite(numericId)) return null
  return { id: numericId, name }
}

function toVenue(raw: RawCompetition['venue']): Venue | null {
  const name = raw?.fullName
  const city = raw?.address?.city
  // A venue without a city would render as a half address; omit it instead.
  if (!name || !city) return null
  return { name, city }
}

function toLeg(raw: RawCompetition['leg']): 1 | 2 | null {
  const value = raw?.value
  return value === 1 || value === 2 ? value : null
}

function toKickoff(date: string, competition: RawCompetition, status: string): Kickoff {
  // `timeValid: false` is ESPN's signal that the date is fixed but the kickoff
  // time is not. A missing value is treated the same way — better an all-day
  // event than a confidently wrong time on two phones.
  const timeIsKnown = competition.timeValid === true && !PROVISIONAL_STATUSES.has(status)
  if (!timeIsKnown) return { kind: 'provisional', date: amsterdamDate(date) }
  return { kind: 'confirmed', utc: new Date(date) }
}

/** Returns null when the event must not appear in the calendar. */
export function mapEvent(input: unknown, competition: CompetitionId): Fixture | null {
  const raw = input as RawEvent

  const status = raw.status?.type?.name ?? ''
  if (DROPPED_STATUSES.has(status)) return null

  const comp = raw.competitions?.[0]
  if (!comp || !raw.id || !raw.date) return null

  const home = toTeam(comp.competitors?.find((c) => c.homeAway === 'home'))
  const away = toTeam(comp.competitors?.find((c) => c.homeAway === 'away'))
  if (!home || !away) return null

  return {
    id: raw.id,
    competition,
    stage: toStage(raw.season?.slug),
    leg: toLeg(comp.leg),
    home,
    away,
    venue: toVenue(comp.venue),
    kickoff: toKickoff(raw.date, comp, status),
  }
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npx vitest run tests/source/map.test.ts`
Expected: all PASS.

- [ ] **Step 5: Write tests against the recorded real responses**

The hand-authored events above keep unit tests readable; these prove the mapper survives
ESPN's actual data. Because the provider is undocumented, these recordings are also the only
written record of the shape the code expects. Append to `tests/source/map.test.ts`:

```ts
type Recorded = { events: unknown[] }

function recorded(name: string): unknown[] {
  const raw = readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8')
  return (JSON.parse(raw) as Recorded).events
}

describe('mapEvent against recorded ESPN responses', () => {
  const cases = [
    { file: 'espn-eredivisie.json', competition: 'eredivisie' as const, min: 5 },
    { file: 'espn-ucl.json', competition: 'ucl' as const, min: 15 },
    { file: 'espn-knvb-cup.json', competition: 'knvb-cup' as const, min: 10 },
  ]

  for (const { file, competition, min } of cases) {
    describe(file, () => {
      const events = recorded(file)

      it('has a non-trivial recorded response', () => {
        expect(events.length).toBeGreaterThanOrEqual(min)
      })

      it('maps every event without throwing', () => {
        for (const e of events) {
          expect(() => mapEvent(e, competition)).not.toThrow()
        }
      })

      it('produces well-formed fixtures for everything it does not drop', () => {
        const mapped = events.map((e) => mapEvent(e, competition)).filter((f) => f !== null)
        expect(mapped.length).toBeGreaterThan(0)

        for (const f of mapped) {
          expect(f.id).toMatch(/^\d+$/)
          expect(f.competition).toBe(competition)
          expect(Number.isInteger(f.home.id)).toBe(true)
          expect(Number.isInteger(f.away.id)).toBe(true)
          expect(f.home.id).not.toBe(f.away.id)
          expect(f.home.name.length).toBeGreaterThan(0)
          expect(f.away.name.length).toBeGreaterThan(0)
          if (f.kickoff.kind === 'confirmed') {
            expect(Number.isNaN(f.kickoff.utc.getTime())).toBe(false)
          } else {
            expect(f.kickoff.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
          }
        }
      })
    })
  }

  it('finds Ajax in the recorded Eredivisie season', () => {
    const mapped = recorded('espn-eredivisie.json')
      .map((e) => mapEvent(e, 'eredivisie'))
      .filter((f) => f !== null)
    expect(mapped.some((f) => f.home.id === 139 || f.away.id === 139)).toBe(true)
  })

  it('recovers both provisional and confirmed kickoffs from the Eredivisie recording', () => {
    const kinds = new Set(
      recorded('espn-eredivisie.json')
        .map((e) => mapEvent(e, 'eredivisie'))
        .filter((f) => f !== null)
        .map((f) => f.kickoff.kind),
    )
    expect(kinds).toEqual(new Set(['confirmed', 'provisional']))
  })

  it('recovers every knockout stage from the Champions League recording', () => {
    const stages = new Set(
      recorded('espn-ucl.json')
        .map((e) => mapEvent(e, 'ucl'))
        .filter((f) => f !== null)
        .map((f) => f.stage),
    )
    for (const expected of [
      'league-phase',
      'knockout-round-playoffs',
      'round-of-16',
      'quarterfinals',
      'semifinals',
      'final',
    ]) {
      expect(stages).toContain(expected)
    }
  })

  it('recovers both legs from the Champions League recording', () => {
    const legs = new Set(
      recorded('espn-ucl.json')
        .map((e) => mapEvent(e, 'ucl'))
        .filter((f) => f !== null)
        .map((f) => f.leg),
    )
    expect(legs).toContain(1)
    expect(legs).toContain(2)
  })

  it('recovers the domestic cup rounds from the KNVB Beker recording', () => {
    const stages = new Set(
      recorded('espn-knvb-cup.json')
        .map((e) => mapEvent(e, 'knvb-cup'))
        .filter((f) => f !== null)
        .map((f) => f.stage),
    )
    expect(stages).toContain('first-round')
    expect(stages).toContain('second-round')
    expect(stages).toContain('final')
  })
})
```

- [ ] **Step 6: Run the full suite**

Run: `npm test && npm run typecheck`
Expected: all PASS. If the recorded-response tests fail, ESPN's shape differs from `RawEvent`
— fix `RawEvent` and the mapper, not the test.

- [ ] **Step 7: Commit**

One commit for this task.

---

### Task 5: ESPN client

**Files:**
- Create: `src/source/espn.ts`
- Test: `tests/source/espn.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces: `fetchEvents(opts: { code: string; from: string; to: string; backoffMs?: number }): Promise<unknown[]>` — resolves to the raw `events` array, throws `SourceError` on unrecoverable failure. Also `SourceError`.

- [ ] **Step 1: Write the failing tests**

Create `tests/source/espn.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SourceError, fetchEvents } from '../../src/source/espn.ts'

const OPTS = { code: 'ned.1', from: '20260701', to: '20270701', backoffMs: 0 }

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchEvents', () => {
  it('returns the events array on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ events: [{ id: '1' }] })))
    await expect(fetchEvents(OPTS)).resolves.toEqual([{ id: '1' }])
  })

  it('builds the documented ESPN url with the date window and a high limit', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ events: [] }))
    vi.stubGlobal('fetch', fetchMock)

    await fetchEvents(OPTS)

    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain('/soccer/ned.1/scoreboard')
    expect(url).toContain('dates=20260701-20270701')
    expect(url).toContain('limit=1000')
  })

  it('sends no credentials, because the endpoint needs none', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ events: [] }))
    vi.stubGlobal('fetch', fetchMock)

    await fetchEvents(OPTS)

    const init = fetchMock.mock.calls[0][1] as RequestInit | undefined
    const headers = JSON.stringify(init?.headers ?? {}).toLowerCase()
    expect(headers).not.toContain('authorization')
    expect(headers).not.toContain('key')
  })

  it('treats a missing events array as an empty competition, not an error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({})))
    await expect(fetchEvents(OPTS)).resolves.toEqual([])
  })

  it('throws when events is present but not an array', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ events: 'nope' })))
    await expect(fetchEvents(OPTS)).rejects.toThrow(SourceError)
  })

  it('throws when the body is not json at all', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>maintenance</html>', { status: 200 })),
    )
    await expect(fetchEvents(OPTS)).rejects.toThrow(SourceError)
  })

  it('retries on 429 and succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 429))
      .mockResolvedValueOnce(jsonResponse({ events: [{ id: '2' }] }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchEvents(OPTS)).resolves.toEqual([{ id: '2' }])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('retries on 500 and gives up after three attempts', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, 500))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchEvents(OPTS)).rejects.toThrow(SourceError)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('retries a network failure', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(jsonResponse({ events: [] }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchEvents(OPTS)).resolves.toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not retry a 404, since a wrong competition code will not fix itself', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, 404))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchEvents(OPTS)).rejects.toThrow(SourceError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('names the competition code in its error, so a broken code is obvious', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 404)))
    await expect(fetchEvents(OPTS)).rejects.toThrow(/ned\.1/)
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run tests/source/espn.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the client**

Create `src/source/espn.ts`:

```ts
const BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer'
const MAX_ATTEMPTS = 3
const DEFAULT_BACKOFF_MS = 1000

/**
 * A full season fits in one response at this limit — 309 Eredivisie fixtures and
 * 189 Champions League events were observed, so no date-window chunking is needed.
 */
const LIMIT = 1000

export class SourceError extends Error {}

export type FetchEventsOptions = {
  /** ESPN league code, e.g. 'ned.1'. */
  code: string
  /** YYYYMMDD. */
  from: string
  /** YYYYMMDD. */
  to: string
  /** Base backoff, doubled per attempt. Tests pass 0. */
  backoffMs?: number
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** 429 and 5xx are transient; other 4xx means we are asking wrongly. */
function isRetryable(status: number): boolean {
  return status === 429 || status >= 500
}

/**
 * Fetch one competition's season. Unauthenticated — ESPN's public endpoint needs
 * no key, which is why this project has no secrets at all.
 */
export async function fetchEvents(opts: FetchEventsOptions): Promise<unknown[]> {
  const { code, from, to, backoffMs = DEFAULT_BACKOFF_MS } = opts
  const url = `${BASE}/${code}/scoreboard?dates=${from}-${to}&limit=${LIMIT}`

  let lastError = ''

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res: Response
    try {
      res = await fetch(url)
    } catch (cause) {
      // Network-level failure: transient by nature, so retry.
      lastError = `network error for ${code}: ${cause instanceof Error ? cause.message : cause}`
      if (attempt < MAX_ATTEMPTS) await sleep(backoffMs * 2 ** (attempt - 1))
      continue
    }

    if (!res.ok) {
      lastError = `HTTP ${res.status} for ${code}`
      if (!isRetryable(res.status)) throw new SourceError(lastError)
      if (attempt < MAX_ATTEMPTS) await sleep(backoffMs * 2 ** (attempt - 1))
      continue
    }

    let body: unknown
    try {
      body = await res.json()
    } catch {
      // ESPN is undocumented; a maintenance page instead of JSON is a real
      // possibility and must fail loudly rather than publish an empty calendar.
      throw new SourceError(`Response for ${code} was not JSON`)
    }

    const events = (body as { events?: unknown }).events

    // A competition with nothing scheduled yet legitimately omits `events`.
    if (events === undefined || events === null) return []

    if (!Array.isArray(events)) {
      throw new SourceError(`Response for ${code} had a non-array 'events' field`)
    }

    return events
  }

  throw new SourceError(`Gave up after ${MAX_ATTEMPTS} attempts: ${lastError}`)
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npx vitest run tests/source/espn.test.ts`
Expected: 11 tests PASS.

- [ ] **Step 5: Commit**

One commit for this task.

---

### Task 6: Config resolution

Turn hand-authored names into sets of ESPN team IDs, failing loudly on anything unknown.

**Files:**
- Create: `src/config.ts`
- Create: `config/team-ids.json`
- Test: `tests/config.test.ts`

**Interfaces:**
- Consumes: `RawConfig` from `config/teams.ts`; `Stage` from `src/domain.ts`
- Produces: `ResolvedConfig = { myTeamId: number; tier1: Set<number>; tier2: Set<number>; europeElite: Set<number>; bigEuropeanStageFrom: Stage; displayNames: Record<string, string> }`, `resolveConfig(raw, ids): ResolvedConfig`, `loadTeamIds(): Record<string, number>`, `UnknownTeamError`

- [ ] **Step 1: Write the failing tests**

Create `tests/config.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { RawConfig } from '../config/teams.ts'
import { UnknownTeamError, loadTeamIds, resolveConfig } from '../src/config.ts'

const RAW: RawConfig = {
  myTeam: 'Ajax Amsterdam',
  eredivisie: { tier1: ['Ajax Amsterdam', 'Feyenoord Rotterdam'], tier2: ['AZ Alkmaar'] },
  europeElite: ['Barcelona'],
  bigEuropeanStageFrom: 'quarterfinals',
  displayNames: { 'Ajax Amsterdam': 'AFC Ajax' },
}

const IDS = {
  'Ajax Amsterdam': 139,
  'Feyenoord Rotterdam': 142,
  'AZ Alkmaar': 140,
  Barcelona: 83,
}

describe('resolveConfig', () => {
  it('resolves every configured name to its provider id', () => {
    const c = resolveConfig(RAW, IDS)
    expect(c.myTeamId).toBe(139)
    expect([...c.tier1].sort((a, b) => a - b)).toEqual([139, 142])
    expect([...c.tier2]).toEqual([140])
    expect([...c.europeElite]).toEqual([83])
  })

  it('carries the threshold and display names through unchanged', () => {
    const c = resolveConfig(RAW, IDS)
    expect(c.bigEuropeanStageFrom).toBe('quarterfinals')
    expect(c.displayNames).toEqual({ 'Ajax Amsterdam': 'AFC Ajax' })
  })

  it('throws UnknownTeamError naming the club and the fix', () => {
    const withUnknown: RawConfig = { ...RAW, europeElite: ['Barcelona', 'Girona'] }
    expect(() => resolveConfig(withUnknown, IDS)).toThrow(UnknownTeamError)
    expect(() => resolveConfig(withUnknown, IDS)).toThrow(/Girona/)
    expect(() => resolveConfig(withUnknown, IDS)).toThrow(/sync-teams/)
  })

  it('reports every unknown club at once, not just the first', () => {
    const withUnknown: RawConfig = { ...RAW, europeElite: ['Girona', 'Bologna'] }
    expect(() => resolveConfig(withUnknown, IDS)).toThrow(/Girona/)
    expect(() => resolveConfig(withUnknown, IDS)).toThrow(/Bologna/)
  })

  it('throws when myTeam itself cannot be resolved', () => {
    expect(() => resolveConfig({ ...RAW, myTeam: 'Nobody' }, IDS)).toThrow(UnknownTeamError)
  })
})

describe('loadTeamIds', () => {
  it('reads the committed mapping and includes Ajax', () => {
    const ids = loadTeamIds()
    expect(ids['Ajax Amsterdam']).toBe(139)
  })

  it('maps every name to a number', () => {
    for (const [name, id] of Object.entries(loadTeamIds())) {
      expect(typeof id, `${name} should map to a number`).toBe('number')
    }
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run tests/config.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `config/team-ids.json`**

These are the real ESPN IDs for all 18 Eredivisie clubs, harvested during the Task 1 spike.
Task 11 regenerates this file and adds the European clubs.

```json
{
  "ADO Den Haag": 2726,
  "AZ Alkmaar": 140,
  "Ajax Amsterdam": 139,
  "Excelsior": 2566,
  "FC Groningen": 145,
  "FC Twente": 152,
  "FC Utrecht": 153,
  "Feyenoord Rotterdam": 142,
  "Fortuna Sittard": 143,
  "Go Ahead Eagles": 3706,
  "Heerenveen": 146,
  "NEC Nijmegen": 147,
  "PEC Zwolle": 2565,
  "PSV Eindhoven": 148,
  "SC Cambuur": 3736,
  "Sparta Rotterdam": 151,
  "Telstar": 3735,
  "Willem II": 156
}
```

**Note:** the `europeElite` clubs have no entries yet, so a real build fails with
`UnknownTeamError` until Task 11 runs. That is the design working as intended, not a bug.

- [ ] **Step 4: Implement config resolution**

Create `src/config.ts`:

```ts
import { readFileSync } from 'node:fs'
import type { RawConfig } from '../config/teams.ts'
import type { Stage } from './domain.ts'

export class UnknownTeamError extends Error {}

export type ResolvedConfig = {
  myTeamId: number
  tier1: Set<number>
  tier2: Set<number>
  europeElite: Set<number>
  bigEuropeanStageFrom: Stage
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
```

- [ ] **Step 5: Run the tests and typecheck**

Run: `npx vitest run tests/config.test.ts && npm run typecheck`
Expected: 7 tests PASS, no type errors.

- [ ] **Step 6: Commit**

One commit for this task.

---

### Task 7: Classifier

The heart of the product. Pure, no I/O, and where the review attention belongs.

**Files:**
- Create: `src/classify.ts`
- Test: `tests/classify.test.ts`

**Interfaces:**
- Consumes: `Fixture`, `Inclusion`, `Stage`, `STAGES`, `CompetitionId` from `src/domain.ts`; `ResolvedConfig` from `src/config.ts`; `isEuropean` from `src/source/competitions.ts`
- Produces: `classify(fixture: Fixture, config: ResolvedConfig): Inclusion`

- [ ] **Step 1: Write the failing tests**

This table is the spec's selection rules made executable. Create `tests/classify.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { classify } from '../src/classify.ts'
import type { ResolvedConfig } from '../src/config.ts'
import type { CompetitionId, Fixture, Stage } from '../src/domain.ts'

const AJAX = 139
const FEYENOORD = 142
const PSV = 148
const TWENTE = 152 // tier 2
const CAMBUUR = 3736 // tier 3
const HERACLES = 9001 // tier 3
const BARCELONA = 83 // elite
const UNITED = 360 // elite
const SLAVIA = 9002 // not elite
const BODO = 9003 // not elite

const CONFIG: ResolvedConfig = {
  myTeamId: AJAX,
  tier1: new Set([AJAX, PSV, FEYENOORD]),
  tier2: new Set([TWENTE]),
  europeElite: new Set([BARCELONA, UNITED]),
  bigEuropeanStageFrom: 'quarterfinals',
  displayNames: {},
}

function fixture(
  competition: CompetitionId,
  homeId: number,
  awayId: number,
  stage: Stage = 'regular-season',
): Fixture {
  return {
    id: '1',
    competition,
    stage,
    leg: null,
    home: { id: homeId, name: `team-${homeId}` },
    away: { id: awayId, name: `team-${awayId}` },
    venue: null,
    kickoff: { kind: 'confirmed', utc: new Date('2026-03-15T13:30:00Z') },
  }
}

describe('classify — rule 1: Ajax in Europe is always required', () => {
  it('includes an Ajax Champions League league-phase match', () => {
    expect(classify(fixture('ucl', AJAX, BARCELONA, 'league-phase'), CONFIG)).toBe('required')
  })

  it('includes an Ajax Conference League tie against a minor side', () => {
    expect(classify(fixture('uecl', AJAX, BODO, 'league-phase'), CONFIG)).toBe('required')
  })

  it('includes an Ajax Europa League away tie against a minor side', () => {
    expect(classify(fixture('uel', SLAVIA, AJAX, 'league-phase'), CONFIG)).toBe('required')
  })

  it('includes an Ajax play-off round tie, below the big-match threshold', () => {
    expect(
      classify(fixture('uecl', AJAX, BODO, 'knockout-round-playoffs'), CONFIG),
    ).toBe('required')
  })
})

describe('classify — rule 2: Ajax domestically depends on the opponent tier', () => {
  it('requires Ajax vs a tier 1 club', () => {
    expect(classify(fixture('eredivisie', AJAX, FEYENOORD), CONFIG)).toBe('required')
  })

  it('requires Ajax vs a tier 2 club', () => {
    expect(classify(fixture('eredivisie', AJAX, TWENTE), CONFIG)).toBe('required')
  })

  it('marks Ajax vs a tier 3 club optional', () => {
    expect(classify(fixture('eredivisie', AJAX, CAMBUUR), CONFIG)).toBe('optional')
  })

  it('applies the same rule when Ajax are away', () => {
    expect(classify(fixture('eredivisie', CAMBUUR, AJAX), CONFIG)).toBe('optional')
    expect(classify(fixture('eredivisie', FEYENOORD, AJAX), CONFIG)).toBe('required')
  })

  it('applies the same rule in the KNVB Cup', () => {
    expect(classify(fixture('knvb-cup', AJAX, CAMBUUR, 'first-round'), CONFIG)).toBe('optional')
    expect(classify(fixture('knvb-cup', AJAX, PSV, 'quarterfinals'), CONFIG)).toBe('required')
  })

  it('does not let a late cup round promote a small opponent to required', () => {
    expect(classify(fixture('knvb-cup', AJAX, CAMBUUR, 'final'), CONFIG)).toBe('optional')
  })
})

describe('classify — rule 3: big European matches without Ajax', () => {
  it('marks a quarter-final between two non-elite clubs optional', () => {
    expect(classify(fixture('ucl', SLAVIA, BODO, 'quarterfinals'), CONFIG)).toBe('optional')
  })

  it('excludes those same clubs in the league phase', () => {
    expect(classify(fixture('ucl', SLAVIA, BODO, 'league-phase'), CONFIG)).toBe('excluded')
  })

  it('marks a league-phase match between two elite clubs optional', () => {
    expect(classify(fixture('ucl', BARCELONA, UNITED, 'league-phase'), CONFIG)).toBe('optional')
  })

  it('excludes an elite club against a non-elite club before the quarter-finals', () => {
    expect(classify(fixture('ucl', BARCELONA, BODO, 'league-phase'), CONFIG)).toBe('excluded')
  })

  it('includes every stage at or beyond the threshold', () => {
    expect(classify(fixture('ucl', SLAVIA, BODO, 'semifinals'), CONFIG)).toBe('optional')
    expect(classify(fixture('ucl', SLAVIA, BODO, 'final'), CONFIG)).toBe('optional')
  })

  it('excludes stages below the threshold', () => {
    expect(classify(fixture('ucl', SLAVIA, BODO, 'round-of-16'), CONFIG)).toBe('excluded')
    expect(
      classify(fixture('ucl', SLAVIA, BODO, 'knockout-round-playoffs'), CONFIG),
    ).toBe('excluded')
  })

  it('respects a raised threshold', () => {
    const semisOnly: ResolvedConfig = { ...CONFIG, bigEuropeanStageFrom: 'semifinals' }
    expect(classify(fixture('ucl', SLAVIA, BODO, 'quarterfinals'), semisOnly)).toBe('excluded')
    expect(classify(fixture('ucl', SLAVIA, BODO, 'semifinals'), semisOnly)).toBe('optional')
  })
})

describe('classify — rule 4: big Eredivisie matches without Ajax', () => {
  it('marks a tier 1 vs tier 1 match optional', () => {
    expect(classify(fixture('eredivisie', PSV, FEYENOORD), CONFIG)).toBe('optional')
  })

  it('excludes tier 1 vs tier 3', () => {
    expect(classify(fixture('eredivisie', PSV, HERACLES), CONFIG)).toBe('excluded')
  })

  it('excludes tier 1 vs tier 2', () => {
    expect(classify(fixture('eredivisie', PSV, TWENTE), CONFIG)).toBe('excluded')
  })

  it('excludes tier 3 vs tier 3', () => {
    expect(classify(fixture('eredivisie', CAMBUUR, HERACLES), CONFIG)).toBe('excluded')
  })
})

describe('classify — the KNVB Cup without Ajax is never included', () => {
  it('excludes a cup tie between two tier 1 clubs', () => {
    expect(classify(fixture('knvb-cup', PSV, FEYENOORD, 'semifinals'), CONFIG)).toBe('excluded')
  })

  it('excludes the cup final without Ajax', () => {
    expect(classify(fixture('knvb-cup', PSV, FEYENOORD, 'final'), CONFIG)).toBe('excluded')
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run tests/classify.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the classifier**

Create `src/classify.ts`:

```ts
import type { ResolvedConfig } from './config.ts'
import { STAGES, type Fixture, type Inclusion, type Stage } from './domain.ts'
import { isEuropean } from './source/competitions.ts'

/** True when `stage` is at or beyond `threshold` on the ordered stage scale. */
function atOrBeyond(stage: Stage, threshold: Stage): boolean {
  return STAGES.indexOf(stage) >= STAGES.indexOf(threshold)
}

/**
 * Decide whether a fixture belongs in the calendar, and how prominently.
 *
 * Rules are evaluated in order; the first match wins. Rule 1 deliberately
 * precedes rule 2 so that every Ajax match in Europe is required regardless
 * of opponent or stage.
 */
export function classify(fixture: Fixture, config: ResolvedConfig): Inclusion {
  const { home, away, competition, stage } = fixture
  const involvesMyTeam = home.id === config.myTeamId || away.id === config.myTeamId
  const european = isEuropean(competition)

  // Rule 1 — my team in Europe: always, no exceptions.
  if (involvesMyTeam && european) return 'required'

  // Rule 2 — my team domestically: depends on the opponent's tier.
  if (involvesMyTeam) {
    const opponentId = home.id === config.myTeamId ? away.id : home.id
    const notable = config.tier1.has(opponentId) || config.tier2.has(opponentId)
    return notable ? 'required' : 'optional'
  }

  // Rule 3 — big European matches. Three parts; see the spec for why.
  if (european) {
    const eliteCount =
      (config.europeElite.has(home.id) ? 1 : 0) + (config.europeElite.has(away.id) ? 1 : 0)

    // 3a — two elite clubs are a big night at any stage, league phase included.
    if (eliteCount === 2) return 'optional'

    // 3b — a European final is a European final, in all three competitions.
    if (stage === 'final') return 'optional'

    // 3c — a late round needs at least one elite club. Without this the threshold
    // admits Europa/Conference quarter-finals between clubs nobody asked about.
    if (atOrBeyond(stage, config.bigEuropeanStageFrom) && eliteCount >= 1) return 'optional'

    return 'excluded'
  }

  // Rule 4 — big Eredivisie matches: both clubs tier 1.
  if (competition === 'eredivisie') {
    const bothTier1 = config.tier1.has(home.id) && config.tier1.has(away.id)
    if (bothTier1) return 'optional'
  }

  return 'excluded'
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npx vitest run tests/classify.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

One commit for this task.

---

### Task 8: Dutch text and ICS rendering

**Files:**
- Create: `src/ics/dutch.ts`, `src/ics/render.ts`
- Test: `tests/ics/dutch.test.ts`, `tests/ics/render.test.ts`

**Interfaces:**
- Consumes: `CalendarEntry`, `Fixture`, `Stage` from `src/domain.ts`; `COMPETITIONS` from `src/source/competitions.ts`
- Produces: `summary(entry: CalendarEntry, displayNames: Record<string, string>): string`, `describe(fixture: Fixture): string`, `render(entries: CalendarEntry[], displayNames: Record<string, string>): string`

- [ ] **Step 1: Write the failing tests for Dutch text**

Create `tests/ics/dutch.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { CalendarEntry, CompetitionId, Fixture, Stage } from '../../src/domain.ts'
import { describe as describeFixture, summary } from '../../src/ics/dutch.ts'

function fixture(
  competition: CompetitionId,
  stage: Stage,
  leg: 1 | 2 | null = null,
  homeName = 'Ajax Amsterdam',
  awayName = 'Feyenoord Rotterdam',
): Fixture {
  return {
    id: '1',
    competition,
    stage,
    leg,
    home: { id: 139, name: homeName },
    away: { id: 142, name: awayName },
    venue: null,
    kickoff: { kind: 'confirmed', utc: new Date('2026-03-15T13:30:00Z') },
  }
}

const entry = (f: Fixture, inclusion: 'required' | 'optional'): CalendarEntry => ({
  fixture: f,
  inclusion,
})

describe('summary', () => {
  it('joins the teams with "vs."', () => {
    expect(summary(entry(fixture('eredivisie', 'regular-season'), 'required'), {})).toBe(
      'Ajax Amsterdam vs. Feyenoord Rotterdam',
    )
  })

  it('prefixes optional entries with "Optioneel: "', () => {
    expect(summary(entry(fixture('eredivisie', 'regular-season'), 'optional'), {})).toBe(
      'Optioneel: Ajax Amsterdam vs. Feyenoord Rotterdam',
    )
  })

  it('applies display-name overrides to both sides', () => {
    const names = { 'Ajax Amsterdam': 'AFC Ajax', 'Feyenoord Rotterdam': 'Feyenoord' }
    expect(summary(entry(fixture('eredivisie', 'regular-season'), 'required'), names)).toBe(
      'AFC Ajax vs. Feyenoord',
    )
  })

  it('leaves names without an override untouched', () => {
    expect(
      summary(entry(fixture('eredivisie', 'regular-season', null, 'Telstar', 'Excelsior'), 'required'), {
        'Ajax Amsterdam': 'AFC Ajax',
      }),
    ).toBe('Telstar vs. Excelsior')
  })
})

describe('describe', () => {
  it('names a domestic league fixture by competition alone, since no matchday exists', () => {
    expect(describeFixture(fixture('eredivisie', 'regular-season'))).toBe('Eredivisie')
  })

  it('names a European league phase in Dutch', () => {
    expect(describeFixture(fixture('ucl', 'league-phase'))).toBe(
      'UEFA Champions League · Competitiefase',
    )
  })

  it('uses Dutch knockout round names', () => {
    expect(describeFixture(fixture('ucl', 'quarterfinals'))).toBe(
      'UEFA Champions League · Kwartfinale',
    )
    expect(describeFixture(fixture('ucl', 'semifinals'))).toBe(
      'UEFA Champions League · Halve finale',
    )
    expect(describeFixture(fixture('ucl', 'final'))).toBe('UEFA Champions League · Finale')
    expect(describeFixture(fixture('knvb-cup', 'round-of-16'))).toBe(
      'KNVB Beker · Achtste finale',
    )
    expect(describeFixture(fixture('uel', 'knockout-round-playoffs'))).toBe(
      'UEFA Europa League · Tussenronde',
    )
    expect(describeFixture(fixture('knvb-cup', 'first-round'))).toBe('KNVB Beker · Eerste ronde')
    expect(describeFixture(fixture('knvb-cup', 'second-round'))).toBe('KNVB Beker · Tweede ronde')
  })

  it('appends the leg for a two-legged tie', () => {
    expect(describeFixture(fixture('ucl', 'quarterfinals', 1))).toBe(
      'UEFA Champions League · Kwartfinale · Heenwedstrijd',
    )
    expect(describeFixture(fixture('ucl', 'quarterfinals', 2))).toBe(
      'UEFA Champions League · Kwartfinale · Returnwedstrijd',
    )
  })

  it('omits the leg for a single-match round', () => {
    expect(describeFixture(fixture('ucl', 'final', null))).not.toContain('wedstrijd')
  })

  it('never emits an English round name', () => {
    const english = /quarter|semi|round of|playoff|regular season|league phase/i
    const stages: Stage[] = [
      'regular-season',
      'league-phase',
      'first-round',
      'second-round',
      'knockout-round-playoffs',
      'round-of-16',
      'quarterfinals',
      'semifinals',
      'final',
    ]
    for (const stage of stages) {
      expect(describeFixture(fixture('ucl', stage))).not.toMatch(english)
    }
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run tests/ics/dutch.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement Dutch text**

Create `src/ics/dutch.ts`:

```ts
import type { CalendarEntry, Fixture, Stage } from '../domain.ts'
import { COMPETITIONS } from '../source/competitions.ts'

const OPTIONAL_PREFIX = 'Optioneel: '

/**
 * Dutch label per stage. `null` means "add nothing" — a domestic league fixture
 * is just "Eredivisie", because ESPN provides no matchday number to append.
 */
const DUTCH_STAGE: Record<Stage, string | null> = {
  'regular-season': null,
  'league-phase': 'Competitiefase',
  'first-round': 'Eerste ronde',
  'second-round': 'Tweede ronde',
  'knockout-round-playoffs': 'Tussenronde',
  'round-of-16': 'Achtste finale',
  quarterfinals: 'Kwartfinale',
  semifinals: 'Halve finale',
  final: 'Finale',
}

const DUTCH_LEG: Record<1 | 2, string> = {
  1: 'Heenwedstrijd',
  2: 'Returnwedstrijd',
}

function display(name: string, displayNames: Record<string, string>): string {
  return displayNames[name] ?? name
}

export function summary(entry: CalendarEntry, displayNames: Record<string, string>): string {
  const { home, away } = entry.fixture
  const title = `${display(home.name, displayNames)} vs. ${display(away.name, displayNames)}`
  return entry.inclusion === 'optional' ? `${OPTIONAL_PREFIX}${title}` : title
}

export function describe(fixture: Fixture): string {
  const parts: string[] = [COMPETITIONS[fixture.competition].dutchName]

  const stage = DUTCH_STAGE[fixture.stage]
  if (stage !== null) parts.push(stage)

  if (fixture.leg !== null) parts.push(DUTCH_LEG[fixture.leg])

  return parts.join(' · ')
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npx vitest run tests/ics/dutch.test.ts`
Expected: all PASS.

- [ ] **Step 5: Write the failing tests for the renderer**

Create `tests/ics/render.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { CalendarEntry, Fixture } from '../../src/domain.ts'
import { render } from '../../src/ics/render.ts'

function confirmed(iso: string, overrides: Partial<Fixture> = {}): Fixture {
  return {
    id: '401875655',
    competition: 'eredivisie',
    stage: 'regular-season',
    leg: null,
    home: { id: 139, name: 'Ajax Amsterdam' },
    away: { id: 142, name: 'Feyenoord Rotterdam' },
    venue: { name: 'Johan Cruijff ArenA', city: 'Amsterdam' },
    kickoff: { kind: 'confirmed', utc: new Date(iso) },
    ...overrides,
  }
}

const entry = (f: Fixture, inclusion: 'required' | 'optional' = 'required'): CalendarEntry => ({
  fixture: f,
  inclusion,
})

/** ICS folds long lines; unfold before asserting on content. */
function unfold(ics: string): string {
  return ics.replace(/\r\n[ \t]/g, '')
}

describe('render', () => {
  it('produces a valid calendar envelope', () => {
    const ics = render([entry(confirmed('2026-03-15T13:30:00Z'))], {})
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('END:VCALENDAR')
    expect(ics).toContain('VERSION:2.0')
  })

  it('writes winter kickoffs in Amsterdam local time (CET, +1)', () => {
    // 13:30 UTC on 15 March 2026 is 14:30 in Amsterdam — DST starts 29 March.
    const ics = unfold(render([entry(confirmed('2026-03-15T13:30:00Z'))], {}))
    expect(ics).toContain('DTSTART;TZID=Europe/Amsterdam:20260315T143000')
    expect(ics).toContain('DTEND;TZID=Europe/Amsterdam:20260315T163000')
  })

  it('writes summer kickoffs in Amsterdam local time (CEST, +2)', () => {
    // 17:00 UTC on 10 May 2026 is 19:00 in Amsterdam.
    const ics = unfold(render([entry(confirmed('2026-05-10T17:00:00Z'))], {}))
    expect(ics).toContain('DTSTART;TZID=Europe/Amsterdam:20260510T190000')
    expect(ics).toContain('DTEND;TZID=Europe/Amsterdam:20260510T210000')
  })

  it('renders a provisional kickoff as an all-day event on that date', () => {
    const f = confirmed('2026-04-18T12:00:00Z', {
      kickoff: { kind: 'provisional', date: '2026-04-18' },
    })
    const ics = unfold(render([entry(f)], {}))
    expect(ics).toContain('DTSTART;VALUE=DATE:20260418')
    expect(ics).not.toContain('DTSTART;TZID=Europe/Amsterdam:20260418')
  })

  it('uses a stable UID derived from the provider event id', () => {
    const ics = unfold(render([entry(confirmed('2026-03-15T13:30:00Z'))], {}))
    expect(ics).toContain('UID:fixture-401875655@football-calendar')
  })

  it('produces the same UID across separate renders, so events move rather than duplicate', () => {
    const a = unfold(render([entry(confirmed('2026-03-15T13:30:00Z'))], {}))
    const b = unfold(render([entry(confirmed('2026-03-22T18:45:00Z'))], {}))
    const uid = (ics: string) => /UID:(.+)/.exec(ics)![1].trim()
    expect(uid(a)).toBe(uid(b))
  })

  it('keeps the UID stable when a fixture becomes provisional', () => {
    const timed = unfold(render([entry(confirmed('2026-03-15T13:30:00Z'))], {}))
    const allDay = unfold(
      render(
        [entry(confirmed('2026-03-15T13:30:00Z', {
          kickoff: { kind: 'provisional', date: '2026-03-15' },
        }))],
        {},
      ),
    )
    const uid = (ics: string) => /UID:(.+)/.exec(ics)![1].trim()
    expect(uid(timed)).toBe(uid(allDay))
  })

  it('prefixes optional entries and applies display names', () => {
    const ics = unfold(
      render([entry(confirmed('2026-03-15T13:30:00Z'), 'optional')], {
        'Ajax Amsterdam': 'AFC Ajax',
        'Feyenoord Rotterdam': 'Feyenoord',
      }),
    )
    expect(ics).toContain('SUMMARY:Optioneel: AFC Ajax vs. Feyenoord')
  })

  it('writes the venue as name, city', () => {
    const ics = unfold(render([entry(confirmed('2026-03-15T13:30:00Z'))], {}))
    expect(ics).toContain('LOCATION:Johan Cruijff ArenA')
    expect(ics).toContain('Amsterdam')
  })

  it('omits the location entirely when the venue is unknown', () => {
    const f = confirmed('2026-03-15T13:30:00Z', { venue: null })
    const ics = unfold(render([entry(f)], {}))
    expect(ics).not.toContain('LOCATION:')
  })

  it('writes the Dutch description', () => {
    const ics = unfold(render([entry(confirmed('2026-03-15T13:30:00Z'))], {}))
    expect(ics).toContain('DESCRIPTION:Eredivisie')
  })

  it('never emits alarms', () => {
    const ics = render([entry(confirmed('2026-03-15T13:30:00Z'))], {})
    expect(ics).not.toContain('BEGIN:VALARM')
  })

  it('renders an empty calendar without throwing', () => {
    const ics = render([], {})
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).not.toContain('BEGIN:VEVENT')
  })

  it('renders one VEVENT per entry', () => {
    const entries = [
      entry(confirmed('2026-03-15T13:30:00Z')),
      entry(confirmed('2026-03-22T18:45:00Z', { id: '401875656' })),
    ]
    const ics = render(entries, {})
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2)
  })
})
```

- [ ] **Step 6: Run it to make sure it fails**

Run: `npx vitest run tests/ics/render.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement the renderer**

Create `src/ics/render.ts`:

```ts
import ical, { ICalCalendarMethod } from 'ical-generator'
import type { CalendarEntry } from '../domain.ts'
import { describe, summary } from './dutch.ts'

const TIMEZONE = 'Europe/Amsterdam'
const MATCH_DURATION_MS = 2 * 60 * 60 * 1000

/**
 * Build the ICS document.
 *
 * Deliberately emits no VALARM: a subscribed feed that fires notifications on
 * someone else's phone for a match they are not watching makes the whole
 * calendar unwelcome.
 */
export function render(
  entries: CalendarEntry[],
  displayNames: Record<string, string>,
): string {
  const calendar = ical({
    name: 'Voetbal',
    description: 'Wedstrijden die ik wil kijken',
    timezone: TIMEZONE,
    prodId: { company: 'personal', product: 'football-calendar', language: 'NL' },
  })
  calendar.method(ICalCalendarMethod.PUBLISH)

  for (const entry of entries) {
    const { fixture } = entry

    const timing =
      fixture.kickoff.kind === 'confirmed'
        ? {
            start: fixture.kickoff.utc,
            end: new Date(fixture.kickoff.utc.getTime() + MATCH_DURATION_MS),
            allDay: false,
          }
        : { start: fixture.kickoff.date, allDay: true }

    const event = calendar.createEvent({
      // Stability of this UID is what makes a postponed match move on the
      // phones instead of appearing twice. It depends only on the provider's
      // event id — never on the kickoff time or the inclusion.
      id: `fixture-${fixture.id}@football-calendar`,
      summary: summary(entry, displayNames),
      description: describe(fixture),
      ...timing,
    })

    if (fixture.venue) {
      event.location(`${fixture.venue.name}, ${fixture.venue.city}`)
    }
  }

  return calendar.toString()
}
```

- [ ] **Step 8: Run the tests and make sure they pass**

Run: `npx vitest run tests/ics/render.test.ts`
Expected: all PASS.

**If the all-day test fails** because `ical-generator` emitted a DATE-TIME rather than a DATE,
pass a `Date` built from the date string instead — `start: new Date(\`${fixture.kickoff.date}T00:00:00Z\`)`
with `allDay: true` — and re-run. Keep the assertion as written; `DTSTART;VALUE=DATE:` is what
iOS needs to show a true all-day event.

- [ ] **Step 9: Run the whole suite**

Run: `npm test && npm run typecheck`
Expected: all PASS.

- [ ] **Step 10: Commit**

One commit for this task.

---

### Task 9: Publication guards

**Files:**
- Create: `src/guards.ts`
- Test: `tests/guards.test.ts`

**Interfaces:**
- Consumes: `CalendarEntry`, `Fixture` from `src/domain.ts`
- Produces: `assertPublishable(input: { fixtures: Fixture[]; entries: CalendarEntry[]; myTeamId: number }): void` — throws `GuardError` when publication must be refused. Also `GuardError`.

- [ ] **Step 1: Write the failing tests**

Create `tests/guards.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { CalendarEntry, Fixture } from '../src/domain.ts'
import { GuardError, assertPublishable } from '../src/guards.ts'

const AJAX = 139

function fixture(homeId: number, awayId: number): Fixture {
  return {
    id: '1',
    competition: 'eredivisie',
    stage: 'regular-season',
    leg: null,
    home: { id: homeId, name: 'h' },
    away: { id: awayId, name: 'a' },
    venue: null,
    kickoff: { kind: 'confirmed', utc: new Date('2026-03-15T13:30:00Z') },
  }
}

const entry = (f: Fixture): CalendarEntry => ({ fixture: f, inclusion: 'required' })

describe('assertPublishable', () => {
  it('passes when my team has fixtures and the calendar has events', () => {
    const f = fixture(AJAX, 142)
    expect(() =>
      assertPublishable({ fixtures: [f], entries: [entry(f)], myTeamId: AJAX }),
    ).not.toThrow()
  })

  it('refuses when my team has no fixtures at all', () => {
    const f = fixture(148, 142)
    expect(() =>
      assertPublishable({ fixtures: [f], entries: [entry(f)], myTeamId: AJAX }),
    ).toThrow(GuardError)
  })

  it('explains why it refused when my team is missing', () => {
    const f = fixture(148, 142)
    expect(() =>
      assertPublishable({ fixtures: [f], entries: [entry(f)], myTeamId: AJAX }),
    ).toThrow(/no fixtures/i)
  })

  it('refuses when the calendar would be empty', () => {
    const f = fixture(AJAX, 142)
    expect(() => assertPublishable({ fixtures: [f], entries: [], myTeamId: AJAX })).toThrow(
      GuardError,
    )
  })

  it('refuses when there is no data at all', () => {
    expect(() => assertPublishable({ fixtures: [], entries: [], myTeamId: AJAX })).toThrow(
      GuardError,
    )
  })

  it('counts my team whether at home or away', () => {
    const away = fixture(142, AJAX)
    expect(() =>
      assertPublishable({ fixtures: [away], entries: [entry(away)], myTeamId: AJAX }),
    ).not.toThrow()
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run tests/guards.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the guards**

Create `src/guards.ts`:

```ts
import type { CalendarEntry, Fixture } from './domain.ts'

export class GuardError extends Error {}

/**
 * Refuse to publish a calendar we are not confident in.
 *
 * GitHub Pages keeps serving the last successful file, so aborting degrades to
 * a slightly stale calendar rather than an empty one — which makes bailing out
 * the safe default. This matters more than usual here: the data source is an
 * undocumented API that could change shape without notice.
 *
 * Note what is deliberately *not* guarded: per-competition emptiness. The KNVB
 * Beker has no scheduled fixtures in early August and European competitions sit
 * empty between draws, so that check would fire falsely and often. Guarding on
 * my team's fixtures and on the total event count catches wholesale data loss
 * without turning normal calendar gaps into red builds.
 */
export function assertPublishable(input: {
  fixtures: Fixture[]
  entries: CalendarEntry[]
  myTeamId: number
}): void {
  const { fixtures, entries, myTeamId } = input

  const mine = fixtures.filter((f) => f.home.id === myTeamId || f.away.id === myTeamId)
  if (mine.length === 0) {
    throw new GuardError(
      `Found no fixtures for team ${myTeamId} in the whole season — refusing to publish. ` +
        'This means a changed competition code, a season-derivation bug, or a provider outage.',
    )
  }

  if (entries.length === 0) {
    throw new GuardError('The rendered calendar would contain zero events — refusing to publish.')
  }
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npx vitest run tests/guards.test.ts`
Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

One commit for this task.

---

### Task 10: Pipeline, entry point, and verify script

**Files:**
- Create: `src/build.ts`, `src/main.ts`, `scripts/verify.ts`
- Test: `tests/build.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 2–9
- Produces: `buildCalendar(deps: BuildDeps): Promise<BuildResult>` where
  `BuildDeps = { season: number; rawConfig: RawConfig; teamIds: Record<string, number>; fetchEvents?: FetchEventsFn }` and
  `BuildResult = { ics: string; entries: CalendarEntry[]; fixtures: Fixture[]; counts: CompetitionCount[] }`,
  `CompetitionCount = { competition: CompetitionId; fetched: number; required: number; optional: number }`.
  `FetchEventsFn = (opts: { code: string; from: string; to: string }) => Promise<unknown[]>` — injectable so tests never touch the network.

- [ ] **Step 1: Write the failing tests**

Create `tests/build.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import type { RawConfig } from '../config/teams.ts'
import { buildCalendar } from '../src/build.ts'
import { COMPETITIONS } from '../src/source/competitions.ts'

const AJAX = 139
const FEYENOORD = 142
const CAMBUUR = 3736

const RAW: RawConfig = {
  myTeam: 'Ajax Amsterdam',
  eredivisie: { tier1: ['Ajax Amsterdam', 'Feyenoord Rotterdam'], tier2: [] },
  europeElite: [],
  bigEuropeanStageFrom: 'quarterfinals',
  displayNames: { 'Ajax Amsterdam': 'AFC Ajax' },
}

const TEAM_IDS = { 'Ajax Amsterdam': AJAX, 'Feyenoord Rotterdam': FEYENOORD }

function espnEvent(id: string, homeId: number, awayId: number, slug = 'regular-season') {
  return {
    id,
    date: '2026-03-15T13:30Z',
    season: { slug },
    status: { type: { name: 'STATUS_SCHEDULED' } },
    competitions: [
      {
        timeValid: true,
        leg: null,
        venue: { fullName: 'Johan Cruijff ArenA', address: { city: 'Amsterdam' } },
        competitors: [
          { homeAway: 'home', team: { id: String(homeId), displayName: `t${homeId}` } },
          { homeAway: 'away', team: { id: String(awayId), displayName: `t${awayId}` } },
        ],
      },
    ],
  }
}

const ERE = COMPETITIONS.eredivisie.code

function fetcherFor(byCode: Record<string, unknown[]>) {
  return vi.fn(async ({ code }: { code: string }) => byCode[code] ?? [])
}

describe('buildCalendar', () => {
  it('fetches every configured competition exactly once', async () => {
    const fetchEvents = fetcherFor({ [ERE]: [espnEvent('1', AJAX, FEYENOORD)] })

    await buildCalendar({ season: 2025, rawConfig: RAW, teamIds: TEAM_IDS, fetchEvents })

    expect(fetchEvents).toHaveBeenCalledTimes(Object.keys(COMPETITIONS).length)
  })

  it('asks for the right season window', async () => {
    const fetchEvents = fetcherFor({ [ERE]: [espnEvent('1', AJAX, FEYENOORD)] })

    await buildCalendar({ season: 2026, rawConfig: RAW, teamIds: TEAM_IDS, fetchEvents })

    expect(fetchEvents).toHaveBeenCalledWith(
      expect.objectContaining({ from: '20260701', to: '20270701' }),
    )
  })

  it('includes required and optional fixtures and drops excluded ones', async () => {
    const fetchEvents = fetcherFor({
      [ERE]: [
        espnEvent('1', AJAX, FEYENOORD), // required
        espnEvent('2', AJAX, CAMBUUR), // optional
        espnEvent('3', CAMBUUR, 9999), // excluded
      ],
    })

    const result = await buildCalendar({
      season: 2025,
      rawConfig: RAW,
      teamIds: TEAM_IDS,
      fetchEvents,
    })

    expect(result.entries).toHaveLength(2)
    expect(result.ics.match(/BEGIN:VEVENT/g)).toHaveLength(2)
    expect(result.ics).toContain('AFC Ajax')
    expect(result.ics).toContain('Optioneel:')
  })

  it('reports per-competition counts', async () => {
    const fetchEvents = fetcherFor({
      [ERE]: [espnEvent('1', AJAX, FEYENOORD), espnEvent('2', AJAX, CAMBUUR)],
    })

    const result = await buildCalendar({
      season: 2025,
      rawConfig: RAW,
      teamIds: TEAM_IDS,
      fetchEvents,
    })

    const ere = result.counts.find((c) => c.competition === 'eredivisie')!
    expect(ere).toEqual({ competition: 'eredivisie', fetched: 2, required: 1, optional: 1 })
  })

  it('keeps past fixtures, so weekly rebuilds never delete watched matches', async () => {
    const past = espnEvent('9', AJAX, FEYENOORD)
    past.date = '2025-09-01T13:30Z'
    past.status.type.name = 'STATUS_FULL_TIME'

    const result = await buildCalendar({
      season: 2025,
      rawConfig: RAW,
      teamIds: TEAM_IDS,
      fetchEvents: fetcherFor({ [ERE]: [past] }),
    })

    expect(result.entries).toHaveLength(1)
  })

  it('fails the guard rather than publishing when my team is absent', async () => {
    const fetchEvents = fetcherFor({ [ERE]: [espnEvent('1', FEYENOORD, CAMBUUR)] })

    await expect(
      buildCalendar({ season: 2025, rawConfig: RAW, teamIds: TEAM_IDS, fetchEvents }),
    ).rejects.toThrow(/no fixtures/i)
  })

  it('propagates an unknown team in the config instead of publishing a wrong calendar', async () => {
    await expect(
      buildCalendar({
        season: 2025,
        rawConfig: { ...RAW, europeElite: ['Girona'] },
        teamIds: TEAM_IDS,
        fetchEvents: fetcherFor({}),
      }),
    ).rejects.toThrow(/Girona/)
  })

  it('resolves the config before fetching, so a typo costs no requests', async () => {
    const fetchEvents = fetcherFor({})

    await expect(
      buildCalendar({
        season: 2025,
        rawConfig: { ...RAW, europeElite: ['Girona'] },
        teamIds: TEAM_IDS,
        fetchEvents,
      }),
    ).rejects.toThrow()

    expect(fetchEvents).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run tests/build.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the pipeline**

Create `src/build.ts`:

```ts
import type { RawConfig } from '../config/teams.ts'
import { classify } from './classify.ts'
import { resolveConfig } from './config.ts'
import type { CalendarEntry, CompetitionId, Fixture } from './domain.ts'
import { assertPublishable } from './guards.ts'
import { render } from './ics/render.ts'
import { COMPETITIONS } from './source/competitions.ts'
import { fetchEvents as defaultFetchEvents } from './source/espn.ts'
import { mapEvent } from './source/map.ts'
import { seasonWindow } from './source/season.ts'

export type FetchEventsFn = (opts: {
  code: string
  from: string
  to: string
}) => Promise<unknown[]>

export type BuildDeps = {
  season: number
  rawConfig: RawConfig
  teamIds: Record<string, number>
  /** Injectable so tests never touch the network. */
  fetchEvents?: FetchEventsFn
}

export type CompetitionCount = {
  competition: CompetitionId
  fetched: number
  required: number
  optional: number
}

export type BuildResult = {
  ics: string
  entries: CalendarEntry[]
  fixtures: Fixture[]
  counts: CompetitionCount[]
}

export async function buildCalendar(deps: BuildDeps): Promise<BuildResult> {
  const { season, rawConfig, teamIds } = deps
  const fetchEvents = deps.fetchEvents ?? defaultFetchEvents

  // Resolve config first: a typo in the club list should fail before we make
  // any network requests.
  const config = resolveConfig(rawConfig, teamIds)
  const { from, to } = seasonWindow(season)

  const fixtures: Fixture[] = []
  const entries: CalendarEntry[] = []
  const counts: CompetitionCount[] = []

  for (const [id, meta] of Object.entries(COMPETITIONS) as Array<
    [CompetitionId, (typeof COMPETITIONS)[CompetitionId]]
  >) {
    const rawEvents = await fetchEvents({ code: meta.code, from, to })
    const mapped = rawEvents
      .map((e) => mapEvent(e, id))
      .filter((f): f is Fixture => f !== null)

    const count: CompetitionCount = {
      competition: id,
      fetched: mapped.length,
      required: 0,
      optional: 0,
    }

    for (const fixture of mapped) {
      fixtures.push(fixture)
      const inclusion = classify(fixture, config)
      if (inclusion === 'excluded') continue
      entries.push({ fixture, inclusion })
      if (inclusion === 'required') count.required++
      else count.optional++
    }

    counts.push(count)
  }

  assertPublishable({ fixtures, entries, myTeamId: config.myTeamId })

  return { ics: render(entries, config.displayNames), entries, fixtures, counts }
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npx vitest run tests/build.test.ts`
Expected: 8 tests PASS.

- [ ] **Step 5: Implement the entry point**

Create `src/main.ts`:

```ts
import { mkdirSync, writeFileSync } from 'node:fs'
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
    // Per-competition emptiness is normal out of season and between draws,
    // so warn rather than fail.
    const note = c.fetched === 0 ? '  <-- WARNING: no fixtures returned' : ''
    console.log(
      `  ${c.competition.padEnd(12)} fetched=${String(c.fetched).padStart(4)}` +
        ` required=${String(c.required).padStart(3)} optional=${String(c.optional).padStart(3)}${note}`,
    )
  }
  console.log(`Total events: ${result.entries.length}`)

  // Written only after every guard has passed.
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(`${OUT_DIR}/${ICS_NAME}`, result.ics)

  const host = process.env.CALENDAR_HOST
  if (host) writeFileSync(`${OUT_DIR}/index.html`, indexHtml(`${host}/${ICS_NAME}`))

  console.log(`Wrote ${OUT_DIR}/${ICS_NAME}`)
}

run().catch((error: unknown) => {
  console.error(`\nFAILED — nothing published.\n${error instanceof Error ? error.message : error}`)
  process.exit(1)
})
```

- [ ] **Step 6: Implement the verify script**

Create `scripts/verify.ts`:

```ts
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

  const dayOf = (e: (typeof result.entries)[number]): string =>
    e.fixture.kickoff.kind === 'confirmed'
      ? e.fixture.kickoff.utc.toISOString().slice(0, 10)
      : e.fixture.kickoff.date

  const sorted = [...result.entries].sort((a, b) => dayOf(a).localeCompare(dayOf(b)))

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
    console.log(`${when.padEnd(24)} ${summary(entry, rawConfig.displayNames)}`)
  }

  console.log(`\n${result.entries.length} events across ${result.fixtures.length} fixtures`)
  for (const c of result.counts) {
    console.log(
      `  ${c.competition.padEnd(12)} fetched=${c.fetched} required=${c.required} optional=${c.optional}`,
    )
  }
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
```

- [ ] **Step 7: Run the full suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: all PASS, no type errors.

- [ ] **Step 8: Commit**

One commit for this task.

---

### Task 11: sync-teams script

ESPN's scoreboard API has no team-search endpoint, so IDs are harvested from the fixture
responses instead: fetch all five competitions, collect every club seen, and match those
against the names in `config/teams.ts`.

**Files:**
- Create: `scripts/sync-teams.ts`
- Modify: `config/team-ids.json` (regenerated with the European clubs added)
- Modify: `config/teams.ts` (correct any club names ESPN does not use)

**Interfaces:**
- Consumes: `rawConfig` from `config/teams.ts`; `COMPETITIONS` from `src/source/competitions.ts`; `fetchEvents` from `src/source/espn.ts`; `seasonFor`/`seasonWindow` from `src/source/season.ts`
- Produces: a regenerated `config/team-ids.json`. No exported API — this is a CLI script.

- [ ] **Step 1: Write the script**

Create `scripts/sync-teams.ts`:

```ts
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
```

- [ ] **Step 2: Run it**

Run: `npm run sync-teams`
Expected: harvest progress per competition and season, then a line per configured club. Some
`MISSING`, most likely among the European elite.

- [ ] **Step 3: Fix the unmatched names**

For each `MISSING` club, pick the correct spelling from the printed candidates and edit
`config/teams.ts`. Also update the corresponding key in `displayNames` if you rename a club
that has an override.

Note: a club can only be resolved if it appears in a fetched fixture. If an elite club is
missing because its competition has not been drawn yet, remove it from `europeElite` for now
and add it back after the draw — do not invent an ID.

- [ ] **Step 4: Re-run until clean**

Run: `npm run sync-teams`
Expected: every line `ok`, exit code 0.

- [ ] **Step 5: Confirm the config resolves and the real pipeline runs**

```bash
npm test
npm run verify
```

Expected: tests pass; `verify` prints a list of matches.

**Read that list.** Confirm every Ajax fixture is present, that Ajax European ties are
unprefixed, that small Eredivisie matches carry `Optioneel:`, and that nothing obviously
silly appears. Report the printed list back — it is the checkpoint where the selection rules
get judged against real fixtures, and only the user can say whether the calendar looks right.

- [ ] **Step 6: Commit**

One commit for this task.

---

### Task 12: GitHub Actions workflow

**Files:**
- Create: `.github/workflows/publish.yml`
- Create: `README.md`

> **This task cannot be verified without pushing.** Steps marked **USER** are git or
> GitHub-account operations for the user to run. The agent writes the files and stops.

- [ ] **Step 1 (USER): Create the repository on GitHub and push**

```bash
gh repo create my-personal-football-calendar --private --source=. --remote=origin --push
```

- [ ] **Step 2 (USER): Enable GitHub Pages with Actions as the source**

In the repository: **Settings → Pages → Build and deployment → Source → GitHub Actions**. Do
this before the first run or the deploy step fails.

Note: a private repository needs GitHub Pro or above to serve Pages. If Pages is unavailable,
make the repository public — the calendar contains no secrets and no credentials of any kind,
only public fixture data.

There is **no secret to configure**: the data source is unauthenticated.

- [ ] **Step 3: Create the workflow**

Create `.github/workflows/publish.yml`:

```yaml
name: Publish calendar

on:
  schedule:
    # Mondays at 06:00 UTC. A daily run costs nothing — the source has no quota —
    # and would catch TV-driven kickoff changes sooner. Change to '0 6 * * *'.
    - cron: '0 6 * * 1'
  workflow_dispatch:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

# Never let two deploys race; queue instead of cancelling, so a scheduled
# run cannot be dropped.
concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  publish:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deploy.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - run: npm ci

      - name: Typecheck
        run: npm run typecheck

      - name: Test
        run: npm test

      - name: Build calendar
        env:
          CALENDAR_HOST: ${{ github.repository_owner }}.github.io/${{ github.event.repository.name }}
        run: npm run build:calendar

      - uses: actions/configure-pages@v5

      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

      - id: deploy
        uses: actions/deploy-pages@v4
```

Note the ordering: typecheck and tests run **before** the build, and the build writes `dist/`
only after every guard passes. A failure at any step means nothing is uploaded and Pages
keeps serving the previous calendar.

- [ ] **Step 4: Write the README**

Create `README.md`:

```markdown
# my-personal-football-calendar

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
(`Ajax Amsterdam`, not `Ajax`).

- `eredivisie.tier1` / `tier2` — Ajax matches against these clubs are required;
  against anyone else they are `Optioneel:`. Two tier-1 clubs playing each other
  appear as `Optioneel:` even without Ajax.
- `europeElite` — two of these clubs playing each other appear as `Optioneel:`.
- `bigEuropeanStageFrom` — European matches from this stage onward appear
  regardless of who is playing. `'quarterfinals'` or `'semifinals'`.
- `displayNames` — maps ESPN's club name to the name shown in the calendar.

After adding a club, run `npm run sync-teams` to refresh `config/team-ids.json`,
then commit both files. The build fails loudly if a configured club has no ID.

## Data source

ESPN's public soccer API, unauthenticated — there is no API key and no secret
anywhere in this project.

It is undocumented and could change without notice. Two things make that
tolerable: the guards refuse to publish a calendar that fails its sanity checks,
so a breakage degrades to a stale feed rather than a wrong one; and the provider
is confined to `src/source/`, so switching to a paid API is one directory's work.

Matchday numbers are unavailable from this source, so league fixtures are
described by competition alone. Knockout rounds and legs are described in full.

## Commands

| Command | What it does |
|---|---|
| `npm test` | Run the test suite |
| `npm run typecheck` | Typecheck without emitting |
| `npm run verify` | Real fetch; print what would be published. Writes nothing. |
| `npm run sync-teams` | Regenerate `config/team-ids.json` |
| `npm run build:calendar` | Build `dist/football.ics` |

No environment variables are required.

## Design

See `docs/superpowers/specs/2026-07-30-personal-football-calendar-design.md` and
`docs/superpowers/plans/2026-07-30-spike-findings.md`.
```

- [ ] **Step 5: Commit**

One commit for this task.

- [ ] **Step 6 (USER): Push and watch the run**

```bash
git push
gh run watch
```

Expected: the workflow succeeds and prints a Pages URL.

- [ ] **Step 7: Fetch the published calendar and check it**

```bash
curl -sI https://<owner>.github.io/my-personal-football-calendar/football.ics | head -5
curl -s https://<owner>.github.io/my-personal-football-calendar/football.ics | head -30
```

Expected: HTTP 200, and a body starting `BEGIN:VCALENDAR`. If the `content-type` is not
`text/calendar` that is usually still fine — iOS keys off the URL and body — but note it if a
phone later refuses the feed.

- [ ] **Step 8 (USER): Trigger a manual run to confirm dispatch works**

Run: `gh workflow run "Publish calendar" && gh run watch`
Expected: success. This is the button to press when a match moves mid-week.

---

### Task 13: Subscribe both phones and confirm updates propagate

Manual verification, entirely the user's to perform — it needs two physical phones and a
push. Nothing is really finished until the calendar is on the phones.

- [ ] **Step 1: Subscribe on your own iPhone**

Open the Pages URL in Safari and tap **Abonneren op iPhone**. Confirm the calendar appears
and events are visible.

- [ ] **Step 2: Check the details on the phone, not just in the file**

Open the next Ajax fixture and confirm: the title reads correctly with `AFC Ajax`, the time
matches the real kickoff in local time, the location shows the stadium and city, and the
description shows the Dutch competition and round. Then find a small Eredivisie fixture and
confirm it reads `Optioneel: …`.

Also find a fixture whose kickoff time is not yet fixed and confirm it shows as an all-day
event rather than at a made-up time.

- [ ] **Step 3: Confirm there are no alarms**

Check that no event has a reminder set. This is the thing most likely to make the calendar
unwelcome on someone else's phone.

- [ ] **Step 4: Subscribe on your wife's iPhone**

Same URL, same steps. Confirm events appear.

- [ ] **Step 5: Prove that an update propagates rather than duplicating**

Change something observably — in `config/teams.ts`, move one club from `tier2` to `tier1`, so
a fixture flips between `Optioneel:` and required. Push it and let the workflow run.

Then force a calendar refresh on the phone (pull to refresh in the Calendar app, or toggle the
subscription off and on). Confirm the affected event **changed in place** and did not appear
twice. Duplicate events mean the UID is not stable — go back to Task 8.

- [ ] **Step 6: Undo the test change**

Move the club back to `tier2` and push again.

- [ ] **Step 7: Record what the weekly cadence should be**

Note in the README whether weekly turned out to be enough. If a kickoff time changed inside
the week before a match and the calendar was stale, change the cron to `'0 6 * * *'`.

---

## Self-Review

**1. Spec coverage**

| Spec requirement | Task |
|---|---|
| All Ajax Eredivisie + KNVB Cup, small ones `Optioneel:` | 7 (rule 2) |
| All Ajax international matches, no exceptions | 7 (rule 1, ordered first) |
| Big Eredivisie matches `Optioneel:` | 7 (rule 4) |
| Big European matches `Optioneel:` | 7 (rule 3) |
| Knockout stage overrides club tiers from QF | 7 (`atOrBeyond`, configurable) |
| Tier config in one hand-edited file | 2 |
| Name → ID mapping, generated and committed | 6, 11 |
| Compare by ID, never by name | 4 (numeric coercion), 6, 7 |
| Fail loudly on unknown club | 6 |
| Dutch content | 8 |
| Title `A vs. B` with display-name overrides | 8 |
| Location `Stadium, City`, omitted when unknown | 4, 8 |
| `Europe/Amsterdam` with DST correctness | 8 |
| 2-hour events | 8 |
| Provisional (`timeValid: false`) → all-day | 4, 8 |
| Stable UID across time and inclusion changes | 8 |
| Description with competition, round, leg | 8 |
| No matchday numbers fabricated | 8 (`DUTCH_STAGE['regular-season'] = null`) |
| No alarms | 8, 13 |
| ESPN source, five competitions, no auth | 3, 5 |
| One request per competition, `limit=1000` | 5 |
| Whole season including past fixtures | 10 |
| Season derived from date; window 1 Jul–1 Jul | 3 |
| Weekly cron + manual dispatch | 12 |
| Publish to Pages, subscribable | 12, 13 |
| Never publish an unconfident calendar | 9, 10, 12 |
| Retry with backoff then fail; non-JSON fails loudly | 5 |
| Ajax-empty and calendar-empty guards; per-competition warn only | 9, 10 |
| Table-driven classify tests | 7 |
| Renderer tests (DST, all-day, prefix, UID) | 8 |
| Mapper tested against recorded responses | 4 |
| `npm run verify`, no live E2E in CI | 10 |
| Spike first | 1 (complete) |

No gaps.

**2. Placeholder scan**

No `TBD`/`TODO`. Every code step contains the actual code. Task 11 expects the user to correct
club spellings, which is a real interactive step with a defined procedure, not a placeholder.
`config/team-ids.json` in Task 6 ships with real spike-harvested IDs for all 18 Eredivisie
clubs and is explicitly regenerated by Task 11.

**3. Type consistency**

Verified across tasks:

- `mapEvent(raw, competition)` returns `Fixture | null` — same signature in Tasks 4 and 10.
- `fetchEvents({ code, from, to })` — same shape in Tasks 5, 10, 11.
- `Team.id` is `number` everywhere; ESPN's string IDs are coerced once, in Task 4's `toTeam`.
- `Fixture.leg` is `1 | 2 | null` in Tasks 2, 4, 7, 8, 9, 10.
- `Fixture` has **no** `matchday` field in any task — removed consistently after the spike.
- `Stage` values are the nine ESPN slugs in Tasks 2, 3, 4, 7, 8, 9, 10; no task uses the old
  `'league' | 'r32' | 'qf'` abbreviations.
- `bigEuropeanStageFrom` is `'quarterfinals'` in Tasks 2, 6, 7, 10.
- `ResolvedConfig` fields (`myTeamId`, `tier1`, `tier2`, `europeElite`, `bigEuropeanStageFrom`,
  `displayNames`) match in Tasks 6, 7, 8, 10.
- `summary(entry, displayNames)` and `render(entries, displayNames)` both take display names
  second, in Tasks 8 and 10.
- `assertPublishable({ fixtures, entries, myTeamId })` — same object shape in Tasks 9 and 10.
- `COMPETITIONS[id].code` / `.dutchName` used consistently in Tasks 3, 8, 10, 11.
- `buildCalendar` takes no `apiKey` in Tasks 10 and 11 — no auth anywhere.
- Ajax's ID is `139` in every task that names it (3, 4, 6, 7, 9).

One deliberate divergence: `src/ics/dutch.ts` exports a function named `describe`, which
collides with vitest's global inside its own test file. Task 8's test imports it as
`describeFixture` to avoid the clash.
