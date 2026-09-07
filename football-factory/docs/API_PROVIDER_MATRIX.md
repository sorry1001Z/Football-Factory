# Football Factory — API Provider Matrix

Status: Phase 0.A. Provider selection is preliminary and will be re-evaluated before Phase 1 implementation.

## Decision rules
1. PRIMARY and SECONDARY providers must both have a free tier that covers the planned competitions.
2. Both providers must be usable without scraping any website.
3. Quota, latency and reliability are observed in Phase 1 and may promote/demote a provider.
4. New providers can be added behind the `FootballProvider` interface without frontend changes.

## Provider matrix

| Concern | PRIMARY | SECONDARY | Notes |
|---------|---------|-----------|-------|
| Service | football-data.org | API-Football (free) | — |
| Plan | Free tier | Free tier | Paid plans NOT approved |
| Auth header | `X-Auth-Token: <key>` | `x-apisports-key: <key>` | — |
| Base URL | `https://api.football-data.org/v4/` | `https://v3.football.api-sports.io/` | — |
| Endpoint `/competitions` | yes | yes | — |
| Endpoint `/matches` | yes | yes (`/fixtures`) | naming differs |
| Endpoint `/standings` | yes | yes | — |
| Endpoint `/teams` | yes | yes | — |
| Coverage of PL/LaLiga/Bundesliga/Serie A/Ligue 1 | yes | yes | — |
| Coverage of UCL/UEL/UECL | yes | yes | — |
| Coverage of FA Cup, Carabao, Copa del Rey, DFB-Pokal, Coppa Italia, Coupe de France | partial | yes | some cups not on football-data.org free tier |
| Rate limit (free) | 10 req/min | varies by endpoint | observed in Phase 1 |

## Coverage gaps (free tiers only)
- football-data.org free tier excludes some domestic cups. Phase 1 must check coverage per competition and fall back to API-Football or mock where needed.
- API-Football free tier limits certain endpoints. Phase 1 records which endpoints are usable.

## Canonical mapping responsibilities
- Adapter returns Football Factory canonical schema, never the raw provider payload.
- Every record carries `provider`, `external_id`, `canonical_id`, `fetched_at`, `data_quality_status`.
- Identity resolution (team/league/player) is owned by the adapter layer, not the frontend.
- Frontend never calls a provider directly.

## Quota + fallback rules
- Default mode: PRIMARY only.
- If PRIMARY quota ≥80%, switch to SECONDARY.
- If SECONDARY quota ≥80%, switch to MOCK and emit critical alert.
- `FOOTBALL_PROVIDER_MODE` env var can force a mode: `primary`, `secondary`, `mock`, `auto`.

## Future providers
The interface is intentionally open. Possible future additions (free-tier only, no paid plans):
- OpenLigaDB
- TheSportsDB (free tier)
- SportMonks (free tier, if available)
- Wikipedia / Wikidata for entity metadata only (NEVER for live scores)
New providers are added in Phase 1+ after Terms/robots/rights review.

## Excluded sources (early phases)
- thscore99.com — reference only, NOT a production source until rights review
- bet365, flashscore, livescore.com — Terms review needed before any use
- Social platforms (X, Facebook, Instagram) — TIER 5, never auto-publish
