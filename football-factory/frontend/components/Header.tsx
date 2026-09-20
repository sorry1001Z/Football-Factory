import Link from 'next/link';
import Image from 'next/image';
import { BRAND_NAME, BRAND_HOME_LABEL, BRAND_LOGO_PATH } from '@/lib/brand';

export function Header() {
  return (
    <header className="siteHeader">
      <div className="container headerInner">
        <Link href="/" className="brand" aria-label={BRAND_HOME_LABEL}>
          <Image
            src={BRAND_LOGO_PATH}
            alt={BRAND_NAME}
            height={56}
            width={275}
            className="brandLogo"
            priority
          />
        </Link>
        <div className="searchMock">ค้นหาข่าว ทีม นักเตะ หรือการแข่งขัน… <b>⌕</b></div>
        <nav className="mainNav" aria-label="เมนูหลัก"><Link href="/">หน้าแรก</Link><Link href="/match/arsenal-v-tottenham">ผลบอลสด</Link><Link href="/league/premier-league">ตารางคะแนน</Link><Link href="/league/premier-league">ลีก</Link><Link href="/news/transfer-roundup">ตลาดนักเตะ</Link><Link href="/news/arsenal-pressing-analysis">วิเคราะห์</Link></nav>
        <span className="liveBadge">LIVE</span>
      </div>
    </header>
  );
}
