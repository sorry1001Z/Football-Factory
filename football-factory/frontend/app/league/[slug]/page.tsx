export default async function LeaguePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <main className="page"><div className="container"><section className="entityHero"><div className="eyebrow">LEAGUE HUB</div><h1>{slug.replaceAll('-', ' ')}</h1><p className="muted">รองรับ standings, fixtures, form, team links, latest stories และ programmatic SEO โดยต้องผ่าน minimum data threshold ก่อน index</p></section></div></main>;
}
