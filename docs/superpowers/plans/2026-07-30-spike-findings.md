# Task 1 Spike Findings — 2026-07-30

**Outcome: the spec's data source does not work. STOPPED for a decision.**

## API-Football free tier is unusable for this product

The key is valid and the account is active, but:

```
/status → { plan: "Free", limit_day: 100, active: true }
/fixtures?league=88&season=2025
  → errors: { plan: "Free plans do not have access to this season,
              try from 2022 to 2024." }
```

All five competitions returned **0 fixtures** for season 2025, with the same
plan error. The free tier is restricted to **seasons 2022–2024**. Season 2026/27
starts in days and is likewise inaccessible.

This is fatal, not a workaround: the product is a calendar of *upcoming*
matches, and the free tier serves only completed historical seasons.

## What the free tier did confirm (via season 2024)

Season 2024 returns data normally, which validated the shape assumptions:

| Assumption | Result |
|---|---|
| League 88 = Eredivisie | Confirmed |
| Ajax team ID = 194 | Confirmed |
| Venue name + city present | 321/321 fixtures |
| Round strings as predicted | `Regular Season - 1`, `Conference League Play-offs - Semi-finals` |
| Provider club name for Ajax | `Ajax` — confirms `displayNames` was needed |

So the *design* is sound; only the source is wrong.

## Alternative evaluated: ESPN's public soccer API

Undocumented but unauthenticated and widely used:

```
https://site.api.espn.com/apis/site/v2/sports/soccer/<league>/scoreboard?dates=YYYYMMDD-YYYYMMDD
```

Coverage probe — all five competitions are recognised and return real data:

| Competition | ESPN code | 2025/26 events | Notes |
|---|---|---|---|
| Eredivisie | `ned.1` | 100+ | 2026/27 **already populated** |
| KNVB Beker | `ned.cup` | 57 | Ajax ties present |
| Champions League | `uefa.champions` | 100+ | 6 Ajax events in 2025/26 |
| Europa League | `uefa.europa` | 100+ | |
| Conference League | `uefa.europa.conf` | 100+ | |

Fields available per event:

- `id` — stable numeric event ID → the ICS UID
- `date` — ISO kickoff, UTC
- `competitions[0].competitors[]` — `homeAway`, `team.id`, `team.displayName`
- `venue.fullName` and `venue.address.city` → the LOCATION field
- `status.type.name` / `.state` / `.completed` — e.g. `STATUS_SCHEDULED`
- `competitions[0].timeValid` — maps directly onto confirmed vs. provisional kickoff
- `season.type.name` and `competitions[0].notes[].text` (`"1st Leg"`), `competitions[0].leg`

### Advantages over API-Football

- No API key, no account, no daily quota — the `.env` and the Actions secret both disappear
- Current **and future** seasons available
- Venue and city present

### Costs and risks

1. **Undocumented.** ESPN can change or restrict it without notice. This is the
   central trade-off against a paid, contractual API.
2. **100 events per response.** Fetching a season needs date-window chunking
   (e.g. month by month) rather than one request per competition. Harmless given
   there is no quota, but it changes `src/source/`.
3. **Round/stage detection is messier.** API-Football had one clean `round`
   string. ESPN spreads it across `season.type.name`, `notes[].text`, and `leg`.
   Needs more parsing and more test cases.
4. **Different club names.** `Ajax Amsterdam`, `PSV Eindhoven`, `AZ Alkmaar`,
   `Internazionale`. The `displayNames` map is still required, keyed on ESPN's
   names.
5. `sync-teams` changes shape — ESPN has no team-search endpoint in this API, so
   IDs get harvested from fixture responses instead.

## Options

| Option | Coverage | Cost | Risk |
|---|---|---|---|
| **ESPN public API** | All five | Free | Undocumented, may break |
| **API-Football paid** | All five | ~€15–19/month | Low; contractual |
| **football-data.org free** | Eredivisie + CL only | Free | Fails "all Ajax international matches" when Ajax are in UEL/UECL |
| **Scrape ajax.nl + a second source** | Ajax complete; big matches need another source | Free | Fragile, silent failures |

## Impact on the plan if ESPN is chosen

Rewrite: Task 3 (competition registry — league codes not numeric IDs), Task 4
(mapper — different JSON shape and stage parsing), Task 5 (client — date-window
chunking, no key), Task 6 and 11 (team IDs harvested from fixtures, not searched),
Task 12 (no Actions secret needed).

Unchanged: the domain model, the classifier and its whole test table, the Dutch
text and ICS renderer, the guards, and the pipeline shape. The pure core survives
intact — which is what confining the provider to `src/source/` bought.
