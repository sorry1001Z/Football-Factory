export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <main className="page"><div className="container"><section className="entityHero"><div className="eyebrow">TEAM HUB</div><h1>{slug.replaceAll('-', ' ')}</h1><p className="muted">พื้นที่สำหรับโปรแกรมล่าสุด ฟอร์ม ตารางคะแนน นักเตะ ข่าวที่เกี่ยวข้อง และ internal linking อัตโนมัติ</p></section></div></main>;
}
