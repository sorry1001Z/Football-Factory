import Link from 'next/link';

export function Header() {
  return (
    <header className="siteHeader">
      <div className="container headerInner">
        <Link href="/" className="brand" aria-label="Football Factory home"><span className="brandBall">⚽</span><span>FOOTBALL <em>FACTORY</em></span></Link>
        <div className="searchMock">ค้นหาข่าว ทีม นักเตะ หรือการแข่งขัน… <b>⌕</b></div>
        <nav className="mainNav" aria-label="เมนูหลัก"><Link href="/">หน้าแรก</Link><Link href="/match/arsenal-v-tottenham">ผลบอลสด</Link><Link href="/league/premier-league">ตารางคะแนน</Link><Link href="/league/premier-league">ลีก</Link><Link href="/news/transfer-roundup">ตลาดนักเตะ</Link><Link href="/news/arsenal-pressing-analysis">วิเคราะห์</Link></nav>
        <span className="liveBadge">LIVE</span>
      </div>
    </header>
  );
}
