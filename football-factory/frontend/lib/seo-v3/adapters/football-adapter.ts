// Football Factory — SEO V3 FootballSeoAdapter (Wave C).
//
// Domain adapter that plugs the SEO V3 advisory service layer into
// Football Factory's existing identity registries. Pure; never
// mutates content; never creates pages; never emits JSON-LD directly.
// The current production SEO renderer (`lib/seo/seo.ts`) remains
// authoritative for canonical / schema / sitemap / JSON-LD /
// BreadcrumbList emission. This adapter is the advisory hook used
// by tests today and (later) by editorial / admin review surfaces.

import {
  listTeams,
  resolveTeam,
  resolveTeamByCanonicalId,
} from "@/lib/football/identity/team";
import {
  resolveCompetition,
  resolveCompetitionByCanonicalId,
} from "@/lib/football/identity/competition";
import { resolveCompetitionByAlias } from "@/lib/football/identity/competition";
import type {
  SeoDomainAdapter,
  EntityRef,
  EntityRelation,
  SchemaExtension,
} from "../contracts";
import type { IntentRule, IntentPattern } from "../intent";
import type { InternalLinkTarget } from "../internal-links";
import type { TeamRegistryEntry, CompetitionRegistryEntry } from "@/lib/football/registry/types";

// -----------------------------------------------------------------------------
// Football-specific intent rules.
//
// These belong here (not in the generic `lib/seo-v3/intent.ts`) so the
// generic engine stays domain-neutral. The generic classify() will
// pick these up at runtime via `getIntentRules()`.
//
// Note on Thai aliases: Thai uses combining marks. The intent engine
// normalises via `\p{L}\p{M}\p{N}` boundaries, so a phrase like
// "ข่าวแมนยู" must have a separator (space or terminal) after "แมนยู"
// to be detected — substring matches inside continuous Thai text are
// refused (this is by design; see Wave B tests).
// -----------------------------------------------------------------------------

const THAI_LOCALE = "th";
const EN_LOCALE = "en";

function weighted(phrase: string, weight: number): IntentPattern {
  return { phrase, weight };
}

export const FOOTBALL_INTENT_RULES: IntentRule[] = [
  // ---- NEWS (team-specific, Thai + English) ----
  {
    id: "fb-news-team-th",
    intent: "NEWS",
    entityType: "TEAM",
    landingPageType: "TEAM_HUB",
    priority: 90,
    locale: THAI_LOCALE,
    patterns: [
      weighted("ข่าวแมนยู", 3),
      weighted("ข่าวลิเวอร์พูล", 3),
      weighted("ข่าวอาร์เซนอล", 3),
      weighted("ข่าวเชลซี", 3),
      weighted("ข่าวแมนซิตี้", 3),
      weighted("ข่าวสเปอร์ส", 3),
      weighted("ข่าวบาร์เซโลนา", 3),
      weighted("ข่าวเรอัลมาดริด", 3),
      weighted("ข่าวบาเยิร์น", 3),
    ],
  },
  {
    id: "fb-news-team-en",
    intent: "NEWS",
    entityType: "TEAM",
    landingPageType: "TEAM_HUB",
    priority: 80,
    locale: EN_LOCALE,
    patterns: [
      weighted("manchester united news", 3),
      weighted("liverpool news", 3),
      weighted("arsenal news", 3),
      weighted("chelsea news", 3),
      weighted("manchester city news", 3),
      weighted("tottenham news", 3),
    ],
  },
  // ---- STANDINGS ----
  {
    id: "fb-standings-th",
    intent: "STANDINGS",
    entityType: "COMPETITION",
    landingPageType: "STANDINGS",
    priority: 90,
    locale: THAI_LOCALE,
    patterns: [
      weighted("ตารางคะแนน", 3),
      weighted("ตารางคะแนนพรีเมียร์ลีก", 4),
    ],
  },
  {
    id: "fb-standings-en",
    intent: "STANDINGS",
    entityType: "COMPETITION",
    landingPageType: "STANDINGS",
    priority: 80,
    locale: EN_LOCALE,
    patterns: [
      weighted("premier league standings", 4),
      weighted("la liga standings", 4),
      weighted("bundesliga standings", 4),
      weighted("serie a standings", 4),
      weighted("ligue 1 standings", 4),
    ],
  },
  // ---- FIXTURES (upcoming matches) ----
  {
    id: "fb-fixtures-th",
    intent: "FIXTURES",
    entityType: "COMPETITION",
    landingPageType: "FIXTURES",
    priority: 85,
    locale: THAI_LOCALE,
    patterns: [
      weighted("โปรแกรมบอลคืนนี้", 4),
      weighted("โปรแกรมพรีเมียร์ลีก", 4),
      weighted("โปรแกรมบอลวันนี้", 3),
    ],
  },
  {
    id: "fb-fixtures-en",
    intent: "FIXTURES",
    entityType: "COMPETITION",
    landingPageType: "FIXTURES",
    priority: 75,
    locale: EN_LOCALE,
    patterns: [
      weighted("fixtures tonight", 4),
      weighted("premier league fixtures", 4),
    ],
  },
  // ---- RESULTS (recent results) ----
  {
    id: "fb-results-th",
    intent: "RESULTS",
    entityType: "COMPETITION",
    landingPageType: "RESULTS",
    priority: 85,
    locale: THAI_LOCALE,
    patterns: [
      weighted("ผลบอลเมื่อคืน", 4),
      weighted("ผลบอลสด", 3),
      weighted("ผลพรีเมียร์ลีก", 4),
    ],
  },
  {
    id: "fb-results-en",
    intent: "RESULTS",
    entityType: "COMPETITION",
    landingPageType: "RESULTS",
    priority: 75,
    locale: EN_LOCALE,
    patterns: [
      weighted("results yesterday", 4),
      weighted("premier league results", 4),
    ],
  },
  // ---- PLAYER ----
  {
    id: "fb-player-th",
    intent: "INFORMATIONAL",
    entityType: "PLAYER",
    landingPageType: "PLAYER_HUB",
    priority: 70,
    locale: THAI_LOCALE,
    patterns: [
      weighted("นักเตะอาร์เซนอล", 4),
      weighted("นักเตะแมนยู", 4),
      weighted("นักเตะลิเวอร์พูล", 4),
      weighted("นักเตะบาร์เซโลนา", 4),
      weighted("นักเตะเรอัลมาดริด", 4),
    ],
  },
  // ---- UEFA Champions League ----
  {
    id: "fb-ucl-th",
    intent: "INFORMATIONAL",
    entityType: "COMPETITION",
    landingPageType: "COMPETITION_HUB",
    priority: 80,
    locale: THAI_LOCALE,
    patterns: [
      weighted("ยูฟ่าแชมเปียนส์ลีก", 4),
      weighted("ยูฟ่า แชมเปียนส์ลีก", 4),
    ],
  },
];

export const REAL_INTENT_RULES: IntentRule[] = FOOTBALL_INTENT_RULES;

// -----------------------------------------------------------------------------
// Football-specific landing page type helpers.
// -----------------------------------------------------------------------------

const KNOWN_LANDING_PAGE_TYPES = new Set([
  "TEAM_HUB",
  "COMPETITION_HUB",
  "PLAYER_HUB",
  "MATCH_PAGE",
  "NEWS_LIST",
  "STANDINGS",
  "FIXTURES",
  "RESULTS",
]);

export function isKnownFootballLandingPageType(t: string): boolean {
  return KNOWN_LANDING_PAGE_TYPES.has(t);
}

// -----------------------------------------------------------------------------
// Adapter surface.
// -----------------------------------------------------------------------------

export interface FootballSeoAdapterOptions {
  /** Optional override for the team list (used by tests). */
  teamList?: readonly TeamRegistryEntry[];
}

export class FootballSeoAdapter implements SeoDomainAdapter {
  private readonly teams: readonly TeamRegistryEntry[];

  constructor(opts: FootballSeoAdapterOptions = {}) {
    this.teams = opts.teamList ?? listTeams();
  }

  /**
   * Resolve a free-text query into known entity candidates. Only
   * `TEAM` and `COMPETITION` are resolvable today — Player and Match
   * identity is intentionally NOT guessed.
   */
  async resolveEntity(text: string): Promise<EntityRef[]> {
    if (!text) return [];
    const out: EntityRef[] = [];
    // Team by alias (canonical_id, alias, display_name)
    const teamRes = resolveTeam({ alias: text });
    if (teamRes.status === "resolved" && teamRes.entity) {
      out.push(toTeamEntityRef(teamRes.entity));
    } else if (teamRes.status === "ambiguous" && teamRes.candidates) {
      // We surface ALL candidates for an ambiguous query but the
      // generic intent engine and internal-link engine will refuse
      // to auto-suggest when ambiguity is detected (Wave B).
      for (const t of teamRes.candidates) out.push(toTeamEntityRef(t));
    }
    // Competition by alias
    const compRes = resolveCompetitionByAlias(text);
    if (compRes.status === "resolved" && compRes.entity) {
      out.push(toCompetitionEntityRef(compRes.entity));
    } else if (compRes.status === "ambiguous" && compRes.candidates) {
      for (const c of compRes.candidates) out.push(toCompetitionEntityRef(c));
    }
    return out;
  }

  /**
   * Return relations for an entity. The relation kinds are explicit.
   * Only authoritative source data (the identity registries) is used.
   * Never guessed from text.
   */
  async getEntityRelations(entity: EntityRef): Promise<EntityRelation[]> {
    const out: EntityRelation[] = [];
    if (entity.type === "TEAM") {
      const team = resolveTeamByCanonicalId(entity.id);
      if (!team) return out;
      for (const ccomp of team.competition_canonical_ids || []) {
        out.push({
          fromId: team.canonical_id,
          toId: ccomp,
          type: "TEAM_COMPETITION",
        });
      }
      return out;
    }
    if (entity.type === "COMPETITION") {
      const comp = resolveCompetitionByCanonicalId(entity.id);
      if (!comp) return out;
      // Inverse: every team that lists this competition.
      for (const t of this.teams) {
        if ((t.competition_canonical_ids || []).includes(comp.canonical_id)) {
          out.push({
            fromId: comp.canonical_id,
            toId: t.canonical_id,
            type: "COMPETITION_TEAM",
          });
        }
      }
      return out;
    }
    if (entity.type === "ARTICLE") {
      // Article relations require editorial metadata; we surface a
      // minimal, deterministic projection via the entity's metadata.
      const md = (entity as EntityRef & { metadata?: ArticleMetadata }).metadata;
      if (md) {
        if (md.teamCanonicalId) {
          out.push({
            fromId: entity.id,
            toId: md.teamCanonicalId,
            type: "ARTICLE_TEAM",
          });
        }
        if (md.competitionCanonicalId) {
          out.push({
            fromId: entity.id,
            toId: md.competitionCanonicalId,
            type: "ARTICLE_COMPETITION",
          });
        }
        if (md.playerCanonicalIds?.length) {
          for (const pid of md.playerCanonicalIds) {
            out.push({ fromId: entity.id, toId: pid, type: "ARTICLE_PLAYER" });
          }
        }
        if (md.matchCanonicalId) {
          out.push({
            fromId: entity.id,
            toId: md.matchCanonicalId,
            type: "ARTICLE_MATCH",
          });
        }
      }
      return out;
    }
    if (entity.type === "PLAYER") {
      // No authoritative player registry exists today.
      return out;
    }
    if (entity.type === "MATCH") {
      // No authoritative match registry exists today.
      return out;
    }
    return out;
  }

  /**
   * Map an entity + intent to a football landing page type. Returns
   * the canonical landingPageType string only when production routes
   * exist. Otherwise returns 'NEWS_LIST' as a conservative fallback
   * (the existing `/news` route is always live).
   */
  getLandingPageType(entity: EntityRef, intent: string): string {
    if (entity.type === "TEAM") {
      if (intent === "NEWS" || intent === "INFORMATIONAL") return "TEAM_HUB";
      if (intent === "STANDINGS" || intent === "FIXTURES" || intent === "RESULTS") {
        // Standings/fixtures/results live on the competition hub,
        // not the team hub. Conservative fallback for production.
        return "TEAM_HUB";
      }
      return "TEAM_HUB";
    }
    if (entity.type === "COMPETITION") {
      if (intent === "STANDINGS") return "STANDINGS";
      if (intent === "FIXTURES") return "FIXTURES";
      if (intent === "RESULTS") return "RESULTS";
      return "COMPETITION_HUB";
    }
    if (entity.type === "PLAYER") {
      // Player hub is not yet a public route; refuse.
      return "NEWS_LIST";
    }
    if (entity.type === "MATCH") {
      // Match page is not yet a public route; refuse.
      return "NEWS_LIST";
    }
    if (entity.type === "ARTICLE") return "NEWS_LIST";
    return "NEWS_LIST";
  }

  /**
   * Football-specific intent rules. The generic classify() consumes
   * these as-is. They live here, NOT in the generic intent module.
   */
  getIntentRules(): IntentRule[] {
    return REAL_INTENT_RULES.slice();
  }

  /**
   * Schema extension DATA only. The current JSON-LD emitter is
   * authoritative; this is advisory metadata.
   *
   * Team → SportsOrganization (well-known mapping).
   * Player → Person (well-known mapping).
   * Competition → generic Organizer/Organization (NOT overclaiming
   *   SportsOrganization — the competition registry does not yet
   *   authoritatively expose league-level sports metadata).
   * Match → extension data only if the entity has authoritative
   *   match canonical_id; otherwise refused.
   * Article → returns no extension; NewsArticle rendering is owned
   *   by the production renderer.
   */
  getSchemaExtensions(entity: EntityRef): SchemaExtension[] {
    if (entity.type === "TEAM") {
      const team = resolveTeamByCanonicalId(entity.id);
      if (!team) return [];
      return [
        {
          "@type": "SportsOrganization",
          "@id": team.canonical_id,
          name: team.display_name,
          ...(team.short_name ? { alternateName: team.short_name } : {}),
        },
      ];
    }
    if (entity.type === "PLAYER") {
      // Player hub is interface-only; refuse to emit.
      return [];
    }
    if (entity.type === "COMPETITION") {
      const comp = resolveCompetitionByCanonicalId(entity.id);
      if (!comp) return [];
      return [
        {
          "@type": "Organization",
          "@id": comp.canonical_id,
          name: comp.name,
          alternateName: comp.short_name,
        },
      ];
    }
    if (entity.type === "MATCH") {
      // Match entity has no authoritative production canonical_id.
      return [];
    }
    if (entity.type === "ARTICLE") {
      // NewsArticle rendering is owned by the production renderer.
      return [];
    }
    return [];
  }

  /**
   * Generate candidate internal-link targets for an entity. These
   * are passed to the generic Internal Link Engine (Wave B) which
   * decides whether to surface them as suggestions.
   *
   * Aliases (display names + Thai short forms) are emitted as
   * candidates with lower confidence so the engine prefers the
   * canonical label first.
   */
  getInternalLinkTargets(entity: EntityRef): Promise<InternalLinkTarget[]> {
    if (entity.type === "TEAM") {
      const team = resolveTeamByCanonicalId(entity.id);
      if (!team) return Promise.resolve([]);
      return Promise.resolve(teamToLinkTargets(team));
    }
    if (entity.type === "COMPETITION") {
      const comp = resolveCompetitionByCanonicalId(entity.id);
      if (!comp) return Promise.resolve([]);
      return Promise.resolve(competitionToLinkTargets(comp));
    }
    // Player/Match/Article do not produce internal link targets
    // without an authoritative production route — refused.
    return Promise.resolve([]);
  }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

interface ArticleMetadata {
  teamCanonicalId?: string;
  competitionCanonicalId?: string;
  playerCanonicalIds?: string[];
  matchCanonicalId?: string;
}

function toTeamEntityRef(t: TeamRegistryEntry): EntityRef {
  return {
    id: t.canonical_id,
    type: "TEAM",
    name: t.display_name,
    slug: t.canonical_id.replace(/^team:/, ""),
  };
}

function toCompetitionEntityRef(c: CompetitionRegistryEntry): EntityRef {
  return {
    id: c.canonical_id,
    type: "COMPETITION",
    name: c.name,
    slug: c.canonical_id.replace(/^(league|competition|cup):/, ""),
  };
}

function teamToLinkTargets(t: TeamRegistryEntry): InternalLinkTarget[] {
  const slug = t.canonical_id.replace(/^team:/, "");
  const out: InternalLinkTarget[] = [
    {
      url: `/teams/${slug}`,
      label: t.display_name,
      entityId: t.canonical_id,
      entityType: "TEAM",
      confidence: 0.95,
      priority: 90,
    },
  ];
  if (t.short_name) {
    out.push({
      url: `/teams/${slug}`,
      label: t.short_name,
      entityId: t.canonical_id,
      entityType: "TEAM",
      confidence: 0.85,
      priority: 80,
    });
  }
  for (const alias of t.aliases || []) {
    // Filter out ambiguous aliases that match more than one team
    // in the live registry. Conservative: skip if alias resolves
    // ambiguously to a different team.
    const res = resolveTeam({ alias });
    if (res.status === "ambiguous") continue;
    if (res.status === "resolved" && res.entity?.canonical_id !== t.canonical_id) continue;
    out.push({
      url: `/teams/${slug}`,
      label: alias,
      entityId: t.canonical_id,
      entityType: "TEAM",
      confidence: 0.7,
      priority: 60,
    });
  }
  return out;
}

function competitionToLinkTargets(c: CompetitionRegistryEntry): InternalLinkTarget[] {
  const slug = c.canonical_id.replace(/^(league|competition|cup):/, "");
  const out: InternalLinkTarget[] = [
    {
      url: `/competitions/${slug}`,
      label: c.name,
      entityId: c.canonical_id,
      entityType: "COMPETITION",
      confidence: 0.95,
      priority: 90,
    },
    {
      url: `/competitions/${slug}`,
      label: c.short_name,
      entityId: c.canonical_id,
      entityType: "COMPETITION",
      confidence: 0.85,
      priority: 80,
    },
  ];
  for (const alias of c.aliases || []) {
    const res = resolveCompetition({ alias });
    if (res.status === "ambiguous") continue;
    if (res.status === "resolved" && res.entity?.canonical_id !== c.canonical_id) continue;
    out.push({
      url: `/competitions/${slug}`,
      label: alias,
      entityId: c.canonical_id,
      entityType: "COMPETITION",
      confidence: 0.7,
      priority: 60,
    });
  }
  return out;
}

// Singleton for production use; tests construct their own instance.
export const footballSeoAdapter = new FootballSeoAdapter();

// Public constants for use in tests + future admin review panels.
export const PLAYER_IDENTITY_RESOLUTION_DEFERRED = true as const;
export const MATCH_CANONICAL_RESOLUTION_DEFERRED = true as const;
