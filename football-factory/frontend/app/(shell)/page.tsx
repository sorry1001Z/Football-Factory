// Football Factory — Home page (R2 Wave 2A: Commercial Frontend shell).
//
// This page now uses the commercial shell components + adapter.
// The data layer is unchanged: `getCommercialHomeData()` composes
// the live ContentService + FootballService. NO direct DB or WP
// access. NO fake production content.

import type { Metadata } from "next";
import {
  getCommercialHomeData,
  explainDegraded,
} from "@/lib/commercial/adapter";
import {
  BreakingNewsTicker,
  MainHeader,
  LeagueNav,
  MatchStrip,
  HeroLead,
  HeroNewsLayout,
  LatestNewsGrid,
  LeagueNewsSection,
  FixturesWidget,
  StandingsWidget,
  TrendingNews,
  EditorsPick,
  TeamHubStrip,
  Footer,
  ErrorState,
} from "@/components/commercial/shell";
import {
  LeaderboardAd,
  InFeedAd,
  FooterSponsor,
} from "@/components/ads/ad-slot";
import { AD_PRESETS } from "@/components/ads/presets";
import { HomeAnalytics } from "@/components/analytics/client-trackers";

export const revalidate = 300;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  title: "Football Factory — Latest news, analysis, fixtures and standings",
  description:
    "Football news, analysis, fixtures and standings from every major league. Coverage of Premier League, Champions League, LaLiga, Bundesliga, Serie A and Ligue 1.",
};

export default async function HomePage() {
  const data = await getCommercialHomeData();

  // Surface the degraded explanation only when something actually failed.
  // Hero and latest news are required; the other sections tolerate empty.
  const heroOk = data.hero.length > 0;
  const latestOk = data.latest.length > 0;
  const degraded = data.source.data === "degraded";
  const degradedMessage = explainDegraded(data.source);

  return (
    <main className="page commercial-shell" aria-label="Football Factory home">
      <BreakingNewsTicker items={data.breaking} />
      <MainHeader />
      <LeagueNav />

      <div className="cs-container">
        {degraded && degradedMessage && !heroOk ? (
          <ErrorState
            message={degradedMessage}
            retryHref="/"
          />
        ) : null}

        <MatchStrip items={data.matches} />

        {heroOk ? (
          data.hero.length === 1 ? (
            <HeroLead n={data.hero[0]} />
          ) : (
            <HeroNewsLayout items={data.hero} />
          )
        ) : (
          <ErrorState
            message="No lead stories available right now."
            retryHref="/"
          />
        )}

        <LeaderboardAd config={AD_PRESETS.leaderboard} />

        {latestOk ? (
          <LatestNewsGrid items={data.latest} />
        ) : (
          <ErrorState
            message="Latest news is unavailable. Please try again."
            retryHref="/"
          />
        )}

        <InFeedAd config={AD_PRESETS["in-feed"]} />

        {data.leagueSections.map((s) => (
          <LeagueNewsSection
            key={s.slug}
            slug={s.slug}
            label={s.label}
            items={s.items}
          />
        ))}

        <div className="cs-two-col">
          <FixturesWidget items={data.matches} />
          <StandingsWidget rows={data.standings} />
        </div>

        <TrendingNews items={data.trending} />
        <EditorsPick items={data.editorsPick} />
        <TeamHubStrip items={data.teamHubStrip} />

        <FooterSponsor config={AD_PRESETS["footer-sponsor"]} />
      </div>

      <Footer />
      <HomeAnalytics />
    </main>
  );
}
