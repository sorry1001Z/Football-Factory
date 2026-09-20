import Image from 'next/image';
import {
  BRAND_NAME,
  BRAND_LOGO_MARK_PATH,
  PUBLIC_CONTACT_EMAIL,
} from '@/lib/brand';

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footerGrid">
        <div>
          <Image
            src={BRAND_LOGO_MARK_PATH}
            alt={BRAND_NAME}
            height={48}
            width={220}
            className="footerLogo"
          />
          <p>ศูนย์รวมข่าวฟุตบอล สถิติ บทวิเคราะห์ และเรื่องราวที่แฟนบอลตัวจริงไม่ควรพลาด</p>
        </div>
        <div><strong>เมนูหลัก</strong><p>หน้าแรก<br/>ผลบอลสด<br/>ตารางคะแนน<br/>ทีม<br/>บทความ</p></div>
        <div><strong>ลีกยอดนิยม</strong><p>พรีเมียร์ลีก · FA Cup<br/>บุนเดสลีกา · DFB-Pokal<br/>เซเรีย อา · Coppa Italia<br/>ลาลีกา · Copa del Rey<br/>ลีกเอิง · Coupe de France<br/>UCL · UEL · UECL</p></div>
        <div><strong>ติดต่อเรา</strong><p><a href={`mailto:${PUBLIC_CONTACT_EMAIL}`}>{PUBLIC_CONTACT_EMAIL}</a><br/>Facebook · YouTube · TikTok · X</p></div>
      </div>
      <div className="container footerBottom">© 2026 {BRAND_NAME}. All rights reserved.</div>
    </footer>
  );
}
