import { mockMatches } from '@/lib/mock-data';

export default async function MatchPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const match = mockMatches.find((m) => m.slug === slug);
  if (!match) return <main className="page"><div className="container">ไม่พบข้อมูลแมตช์</div></main>;
  const schema = { '@context': 'https://schema.org', '@type': 'SportsEvent', name: `${match.home} พบ ${match.away}`, startDate: new Date().toISOString(), eventStatus: 'https://schema.org/EventScheduled' };
  return <main className="page"><div className="container"><section className="entityHero"><div className="eyebrow">MATCH CENTER • {match.league}</div><h1>{match.home} พบ {match.away}</h1><p className="muted">{match.kickoff}</p><div style={{fontSize:64,fontWeight:900,marginTop:18}}>{match.homeScore ?? '-'} : {match.awayScore ?? '-'}</div><p>หน้านี้เตรียมไว้สำหรับ Lineups, H2H, form, live status, stats, preview/report lifecycle และ SportsEvent schema</p></section><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/></div></main>;
}
