// Football Factory — /teams/[slug] page (R2 Wave 2B).
//
// Server-rendered team hub. Composes lib/seo-entity/service.ts
// (getTeamHub) + SeoBridge + Wave 1 image components. Uses the
// commercial shell (route group app/(shell)/) so the global Thai-first
// Header/Footer do not render above this page.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTeamHub, buildHubSeo } from "@/lib/seo-entity/service";
import { TeamHubBody } from "@/components/commercial/seo-entity";
import {
  MainHeader,
  LeagueNav,
  Footer,
} from "@/components/commercial/shell";

export const revalidate = 300;

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  // We probe the hub to read the entity name and item count for
  // canonical/title/description/noindex. No itemCount is treated as 0
  // (thin) — but unknown slugs still produce sensible metadata.
  const hub = await getTeamHub(slug);
  const itemCount =
    hub.latestNews.length + hub.relatedArticles.length;
  const seo = buildHubSeo({
    entity: hub.team,
    kind: "team",
    itemCount,
  });
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: seo.canonical },
    robots: seo.noindex ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      type: "website",
      url: seo.canonical,
      title: seo.title,
      description: seo.description,
    },
    other: {
      "json-ld": JSON.stringify(seo.jsonLd),
    },
  };
}

export default async function TeamPage({ params }: Props) {
  const { slug } = await params;
  // searchParams is intentionally accepted but ignored. We do NOT
  // support query-string canonicals; buildHubSeo strips them.
  const hub = await getTeamHub(slug);

  // Unknown slug: use the project's preferred not-found behavior.
  if (hub.source.identity === "unresolved") {
    notFound();
  }

  return (
    <main className="page commercial-shell" aria-label={`Team hub ${hub.team.name}`}>
      <MainHeader />
      <LeagueNav />
      <div className="cs-container">
        <TeamHubBody hub={hub} />
      </div>
      <Footer />
    </main>
  );
}
