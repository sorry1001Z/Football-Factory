import Link from 'next/link';
import { LiveScores } from '@/components/LiveScores';
import { getHomepageNews } from '@/lib/content';

export const revalidate = 300;

const analysisLeagues = ['ทั้งหมด','พรีเมียร์ลีก','บุนเดสลีกา','เซเรีย อา','ลาลีกา','ลีกเอิง','UCL','UEL','UECL'];

const featuredCompetitions = [
  { name:'พรีเมียร์ลีก', sub:'FA Cup · Carabao', slug:'premier-league', icon:'PL' },
  { name:'บุนเดสลีกา', sub:'DFB-Pokal', slug:'bundesliga', icon:'DE' },
  { name:'เซเรีย อา', sub:'Coppa Italia', slug:'serie-a', icon:'IT' },
  { name:'ลาลีกา', sub:'Copa del Rey', slug:'la-liga', icon:'ES' },
  { name:'ลีกเอิง', sub:'Coupe de France', slug:'ligue-1', icon:'FR' },
  { name:'UCL', sub:'Champions League', slug:'champions-league', icon:'★' },
  { name:'UEL', sub:'Europa League', slug:'europa-league', icon:'◆' },
  { name:'UECL', sub:'Conference League', slug:'conference-league', icon:'◇' },
  { name:'บอลถ้วย', sub:'Domestic Cups', slug:'domestic-cups', icon:'🏆' },
  { name:'ทั้งหมด', sub:'All Football', slug:'all', icon:'•••' },
];

function NewsListItem({ item, index }: { item: { slug: string; title: string; category: string; publishedAt: string }; index: number }) {
  return (
    <article className="compactNewsItem">
      <Link href={`/news/${item.slug}`} className={`compactThumb thumbTone${(index % 6) + 1}`} aria-label={item.title}>
        <span className="newsIndex">{index + 1}</span>
        <span className="thumbMonogram">FF</span>
      </Link>
      <div className="compactBody">
        <span className="categoryPill">{item.category}</span>
        <h3><Link href={`/news/${item.slug}`}>{item.title}</Link></h3>
        <div className="metaRow"><span>◷ {item.publishedAt}</span><span>◉ {(3.8 + index * .7).toFixed(1)}K</span></div>
      </div>
    </article>
  );
}

export default async function HomePage() {
  const { lead, side, latest, source: _source } = await getHomepageNews();
  // Pad latest to 10 items from side if needed (content-service pads too)
  const latestPadded = [...latest];
  let padIdx = 0;
  while (latestPadded.length < 10 && side.length > 0) {
    const candidate = side[padIdx % side.length];
    if (candidate && !latestPadded.find((it) => it.slug === candidate.slug)) {
      latestPadded.push(candidate);
    }
    padIdx++;
    if (padIdx > 20) break;
  }
  const news = [lead, ...side].slice(0, 5);
  const analysis = latestPadded.slice(0, 10);
  const featured = lead;

  return (
    <main className="page homePage">
      <div className="container">
        <nav className="leagueRail" aria-label="ลีกและฟุตบอลถ้วยหลัก">
          {featuredCompetitions.map((competition, i) => (
            <Link className={i === 0 ? 'leagueTile active' : 'leagueTile'} href={`/league/${competition.slug}`} key={competition.slug}>
              <span className="leagueIcon leagueMark">{competition.icon}</span>
              <strong>{competition.name}</strong>
              <small>{competition.sub}</small>
            </Link>
          ))}
        </nav>

        <section className="featureGrid" aria-label="ข่าวเด่น">
          <article className="featureHero">
            <div className="heroShade" />
            <div className="featureContent">
              <span className="featureTag">{featured.category}</span>
              <h1>{featured.title}</h1>
              <p>{featured.excerpt}</p>
              <div className="featureMeta">◷ {featured.publishedAt} &nbsp;&nbsp; ◉ 12.4K &nbsp;&nbsp; ◌ 48</div>
            </div>
          </article>
          <div className="featureSideGrid">
            {side.map((item, index) => (
              <Link className={`miniFeature miniTone${index + 1}`} href={`/news/${item.slug}`} key={item.slug}>
                <div className="miniShade" />
                <div className="miniFeatureContent"><span>{item.category}</span><strong>{item.title}</strong></div>
              </Link>
            ))}
          </div>
        </section>

        <section className="homeColumns">
          <div className="mainColumn">
            <div className="sectionHeading">
              <div><h2>ข่าวล่าสุด</h2><p>อัปเดตเรื่องสำคัญจากทุกลีก</p></div>
              <Link href="/news/man-utd-comeback">ดูข่าวทั้งหมด →</Link>
            </div>
            <div className="twoByFiveGrid">
              {latestPadded.map((item, index) => <NewsListItem item={item} index={index} key={item.slug} />)}
            </div>

            <section className="matchDayBanner">
              <div>
                <span className="bannerEyebrow">MATCH DAY</span>
                <h2>ทุกการแข่งขัน ทุกลีก สำคัญเสมอ</h2>
                <p>โปรแกรม • สถิติ • ฟอร์มล่าสุด • รายงานหลังเกม</p>
                <Link className="softButton" href="/match/arsenal-v-tottenham">ดูโปรแกรมการแข่งขัน →</Link>
              </div>
              <div className="bannerBall" aria-hidden="true">⚽</div>
            </section>

            <section className="analysisSection">
              <div className="sectionHeading analysisHeading">
                <div><h2>บทวิเคราะห์</h2><p>จัดรูปแบบเหมือนข่าวล่าสุด และแบ่งตามลีก</p></div>
                <Link href="/news/arsenal-pressing-analysis">ดูทั้งหมด →</Link>
              </div>
              <div className="analysisTabs" aria-label="เลือกลีกสำหรับบทวิเคราะห์">
                {analysisLeagues.map((league, i) => <button className={i === 0 ? 'analysisTab active' : 'analysisTab'} key={league}>{league}</button>)}
              </div>
              <div className="twoByFiveGrid analysisGrid">
                {analysis.map((item, index) => <NewsListItem item={item} index={index} key={item.slug} />)}
              </div>
            </section>
          </div>

          <aside className="rightRail">
            <LiveScores />
            <section className="tableCard">
              <div className="railTitle"><h3>ตารางคะแนน</h3><Link href="/league/premier-league">ดูทั้งหมด →</Link></div>
              {['แมนฯ ซิตี้','ลิเวอร์พูล','อาร์เซนอล','เชลซี','แมนฯ ยูไนเต็ด'].map((team, i) => (
                <div className="standingRow" key={team}><b>{i+1}</b><span>{team}</span><span>{12-i}</span></div>
              ))}
            </section>
            <section className="friendlyPromo"><b>FOOTBALL<br/><span>LIVES HERE</span></b><p>มากกว่าข่าว คือทุกเรื่องของบอล</p><button>เข้าร่วมกับเรา →</button></section>
            <section className="socialCard"><h3>ติดตามเรา</h3><div className="socialGrid"><span>▶<small>125K</small></span><span>f<small>320K</small></span><span>♪<small>180K</small></span><span>𝕏<small>95K</small></span></div></section>
            <section className="newsletter lightCard"><h3>รับข่าวฟุตบอลล่าสุด</h3><p>ไม่พลาดข่าว วิเคราะห์ และตลาดนักเตะ</p><input aria-label="อีเมล" placeholder="กรอกอีเมลของคุณ"/><button type="button">สมัครรับข่าวสาร</button></section>
          </aside>
        </section>
      </div>
    </main>
  );
}
