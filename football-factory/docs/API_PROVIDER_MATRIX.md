# Football Factory — API Provider Matrix

Status: Phase 1.D — both providers implemented behind the `FootballProvider`
interface. Free-first rule preserved. No paid plans.

## Decision rules
1. PRIMARY and SECONDARY providers must both have a free tier that covers
   the planned competitions.
2. Both providers must be usable without scraping any website.
3. Quota, latency and reliability are observed in Phase 1 and may
   promote/demote a provider.
4. New providers can be added behind the `FootballProvider` interface
   without frontend changes.

## Provider matrix

| Concern                                                                       | PRIMARY                                | SECONDARY                              | Notes |
|--------------------------------------------------------------------------------|-----------------------------------------|----------------------------------------|-------|
| Service                                                                       | football-data.org                       | API-Football (free)                    | — |
| Plan                                                                          | Free tier                               | Free tier                              | Paid plans NOT approved |
| Auth header                                                                   | `X-Auth-Token: ***`                     | `x-apisports-key: ***`                 | server-only |
| Base URL                                                                      | `https://api.football-data.org/v4/`     | `https://v3.football.api-sports.io/`   | — |
| Client implementation                                                         | `lib/football/providers/football-data.client.ts` | `lib/football/providers/api-football.client.ts` | — |
| Normalizer                                                                    | `lib/football/providers/football-data.normalize.ts` | `lib/football/providers/api-football.normalize.ts` | pure functions |
| Endpoint `/competitions`                                                       | yes                                     | yes                                    | — |
| Endpoint `/matches`                                                            | yes                                     | yes (`/fixtures`)                      | naming differs |
| Endpoint `/standings`                                                          | yes                                     | yes                                    | — |
| Endpoint `/teams`                                                              | yes                                     | yes                                    | — |
| Coverage of PL/LaLiga/Bundesliga/Serie A/Ligue 1                              | yes                                     | yes                                    | — |
| Coverage of UCL/UEL/UECL                                                       | yes                                     | yes                                    | — |
| Coverage of FA Cup, Carabao, Copa del Rey, DFB-Pokal, Coppa Italia, Coupe de France | partial                                 | yes                                    | some cups not on football-data.org free tier |
| Rate limit (free)                                                              | 10 req/min                              | varies by endpoint                     | enforced via Phase 1.C quota manager |
| Response keys normalized via per-provider functions                            | yes (status, scores, teams, competitions) | yes                                  | — |
| Fixtures used in tests                                                         | sanitized, `__fixtures__/football-data.fixtures.ts` | sanitized, `__fixtures__/api-football.fixtures.ts` | never real keys |

## Coverage gaps (free tiers only)

- football-data.org free tier excludes some domestic cups. Phase 1.B
  normalizer returns `data_quality_status = 'partial'` for unrecognized
  provider ids. Phase 1.C orchestrator surfaces them as `partial` records,
  never as `fresh`.
- API-Football free tier limits certain endpoints. Phase 1.B client
  exposes `configured = false` when the key is absent, so the orchestrator
  routes traffic to football-data.org instead.

## Canonical mapping responsibilities

- Adapter returns Football Factory canonical schema, NEVER the raw
  provider payload.
- Every record carries `provider`, `external_id`, `canonical_id`,
  `fetched_at`, `data_quality_status`.
- Identity resolution (team/league/player) is owned by the adapter layer,
  not the frontend.
- Frontend never calls a provider directly (only `/api/football/*` routes).

## Quota + fallback rules

- Default mode: PRIMARY (football-data.org).
- If PRIMARY quota is blocked, the orchestrator returns a
  `RATE_LIMIT` envelope rather than silently falling back. Phase 1.D
  keeps the surface deterministic; SECONDARY auto-fallback is planned
  for Phase 2.
- `FOOTBALL_PROVIDER` env var can force a provider: `football-data.org`
  or `api-football`. Default is football-data.org.

## Future providers

The interface is intentionally open. Possible future additions
(free-tier only, no paid plans):
- OpenLigaDB
- TheSportsDB (free tier)
- SportMonks (free tier, if available)
- Wikipedia / Wikidata for entity metadata only (NEVER for live scores)

Adding a new provider means:
1. Implement a new client in `lib/football/providers/<name>.client.ts`.
2. Add pure normalization functions in `<name>.normalize.ts`.
3. Register the provider name in `provider-resolver.ts` `ALLOWED`.
4. Add a sanitized fixture under `__fixtures__/`.
5. Add tests under `__tests__/`.

## Excluded sources (early phases)

- thscore99.com — reference only, NOT a production source until rights
  review.
- bet365, flashscore, livescore.com — Terms review needed before any use.
- Social platforms (X, Facebook, Instagram) — TIER 5, never auto-publish.
