// Football Factory — SEO V3 FootballSeoAdapter test fixtures.
//
// These fixtures exercise the adapter against a deterministic
// in-memory team + competition registry without depending on
// the live seed registry (which can grow over time). They MUST
// stay under `__tests__/` so the production source has no
// fixture-leak risk.

import type { TeamRegistryEntry } from "@/lib/football/registry/types";
import type { CompetitionRegistryEntry } from "@/lib/football/registry/types";

export const FIXTURE_TEAMS: TeamRegistryEntry[] = [
  {
    canonical_id: "team:manchester-united",
    display_name: "Manchester United",
    short_name: "Man Utd",
    country: "England",
    competition_canonical_ids: ["league:premier-league", "cup:fa-cup"],
    aliases: ["Man Utd", "แมนยู", "แมนเชสเตอร์ ยูไนเต็ด"],
    provider_ids: {},
  },
  {
    canonical_id: "team:arsenal",
    display_name: "Arsenal",
    short_name: "Arsenal",
    country: "England",
    competition_canonical_ids: ["league:premier-league", "cup:fa-cup"],
    aliases: ["Arsenal", "อาร์เซนอล"],
    provider_ids: {},
  },
  {
    canonical_id: "team:liverpool",
    display_name: "Liverpool",
    short_name: "Liverpool",
    country: "England",
    competition_canonical_ids: ["league:premier-league", "cup:fa-cup"],
    aliases: ["Liverpool", "ลิเวอร์พูล"],
    provider_ids: {},
  },
  {
    canonical_id: "team:barcelona",
    display_name: "Barcelona",
    short_name: "Barca",
    country: "Spain",
    competition_canonical_ids: ["league:la-liga", "cup:copa-del-rey"],
    aliases: ["Barcelona", "บาร์เซโลนา"],
    provider_ids: {},
  },
];

export const FIXTURE_COMPETITIONS: CompetitionRegistryEntry[] = [
  {
    canonical_id: "league:premier-league",
    name: "Premier League",
    short_name: "PL",
    country: "England",
    competition_type: "league",
    priority: 100,
    enabled: true,
    aliases: ["Premier League", "พรีเมียร์ลีก", "PL"],
    provider_ids: {},
  },
  {
    canonical_id: "league:la-liga",
    name: "La Liga",
    short_name: "Liga",
    country: "Spain",
    competition_type: "league",
    priority: 80,
    enabled: true,
    aliases: ["La Liga", "ลาลีกา"],
    provider_ids: {},
  },
  {
    canonical_id: "competition:uefa-champions-league",
    name: "UEFA Champions League",
    short_name: "UCL",
    country: "UEFA",
    competition_type: "continental",
    priority: 90,
    enabled: true,
    aliases: ["UCL", "Champions League", "ยูฟ่าแชมเปียนส์ลีก"],
    provider_ids: {},
  },
];
