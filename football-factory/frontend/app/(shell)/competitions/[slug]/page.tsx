// Football Factory — /competitions/[slug] page (R2 Wave 2B).

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCompetitionHub, buildHubSeo } from "@/lib/seo-entity/service";
import { CompetitionHubBody } from "@/components/commercial/seo-entity";
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
  const hub = await getCompetitionHub(slug);
  const itemCount = hub.latestNews.length + hub.relatedArticles.length;
  const seo = buildHubSeo({
    entity: hub.competition,
    kind: "competition",
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

export default async function CompetitionPage({ params }: Props) {
  const { slug } = await params;
  const hub = await getCompetitionHub(slug);
  if (hub.source.identity === "unresolved") {
    notFound();
  }
  return (
    <main className="page commercial-shell" aria-label={`Competition hub ${hub.competition.name}`}>
      <MainHeader />
      <LeagueNav />
      <div className="cs-container">
        <CompetitionHubBody hub={hub} />
      </div>
      <Footer />
    </main>
  );
}
