# ใช้ FF90 Modular SEO 0.1.0

นี่คือ SEO ชุดแรกที่พอร์ตจากแนวคิด V3 เป็น WordPress Plugin แยกจากธีม
**ยังไม่ใช่ SEO V4 ครบสเปก** ดู `SPEC_AND_PARITY.md` สำหรับส่วนที่ยังขาด

1. อัปโหลด `ff90-seo-0.1.0.zip` ที่ Plugins → Add New → Upload Plugin แล้ว Activate
2. ไป Settings → FF90 SEO ค่าเริ่มต้น **Advisory** วิเคราะห์เท่านั้น
   หากมี Yoast/RankMath/SEO เดิม ให้คง Advisory เพื่อไม่แย่ง Metadata
3. ถ้าจะให้ FF90 ดูแล Metadata เอง ให้ทดลองบน Staging ก่อนเลือก **FF90 standalone**
4. เปิดข่าวใน Gutenberg → Settings → แท็บ Post → **FF90 SEO**
   จะวิเคราะห์ข้อความที่กำลังแก้หลังหยุดพิมพ์ประมาณ 0.8 วินาที ผ่าน REST ของเว็บเอง
   Classic Editor มีช่อง FF90 SEO และรายงานฉบับที่บันทึกแล้ว
5. Description ใส่ข้อความเฉพาะข่าว; Canonical เว้นว่างเพื่อใช้ permalink จริง
   ไม่จำเป็นต้องกรอก Canonical เองทุกข่าว
6. Internal links เป็นคำแนะนำไปยัง Category/Tag ที่ผูกกับข่าวและพบชื่อในเนื้อหา
   ยังไม่แทรกลิงก์อัตโนมัติและไม่แก้ข้อความเดิม
7. Noindex ใช้ได้เมื่อ FF90 เป็นเจ้าของ Metadata ในโหมด standalone
8. Publish gate ปิดเริ่มต้น หากเปิดจะกั้นเฉพาะข้อผิดโครงสร้าง เช่น Canonical
   ไม่ถูกต้อง/ไม่มีชื่อเรื่อง/H1 ไม่ตรงนโยบายธีม ไม่ใช้คะแนนภาษาไทยตัดสินห้ามเผยแพร่
   ยังต้องใช้ระบบอนุมัติและตรวจสิทธิ์ของคนอยู่เสมอ

## Sitemap

- ปกติ: `/wp-sitemap.xml` ของ WordPress
- ข่าว: `/ff90-news-sitemap.xml` ใน standalone เมื่อใช้ pretty permalinks
- ข่าวบน plain permalinks: `/?ff90_news_sitemap=1`
- รวมข่าวเผยแพร่ไม่เกิน 48 ชั่วโมง ไม่นับ draft/private/password/noindex
- ถ้าเกิน 1,000 ข่าว จะแยก child sitemap พร้อม index อัตโนมัติ
- Submit URL Sitemap ใน Google Search Console ได้ด้วยบัญชีเจ้าของเว็บไซต์
- Sitemap ช่วยค้นพบ URL แต่ไม่รับประกันการเก็บดัชนี Google News หรืออันดับ
- หากใช้ CDN ต้องล้างแคชเมื่อเผยแพร่/แก้ข่าว และตั้งข้อยกเว้นหรือ TTL สั้นให้ News Sitemap

GSC OAuth และสถิติจริงยังไม่ได้ทำ จึงแสดงสถานะไม่เชื่อมต่อ ไม่มีตัวเลขสมมติ
SportsEvent/ข้อมูลทีมและนักเตะอัตโนมัติยังรอตัวเชื่อมข้อมูลที่ตรวจสอบ source แล้ว

ปลั๊กอินไม่ส่งบทความไป API วิเคราะห์ภายนอก ไม่ต้องรัน Next.js และไม่มี JavaScript
เพิ่มในหน้าผู้อ่าน ปิดปลั๊กอินแล้วข้อมูล SEO ยังเก็บอยู่ ไม่ลบข่าวหรือ Featured Image

## อัปเดต 0.2.0

เพิ่ม Target keyword, Intent, Deep Quality และ Schema graph validation
รายละเอียดการติดตั้งปลั๊กอินฟุตบอล/GSC แยกตัว ดู **MODULES_TH.md**
GSC connector มีโค้ด OAuth พร้อมตั้งค่าแล้ว แต่ต้องให้ผู้ดูแล Connect/Consent
และเลือก Property จริงก่อนดูสถิติ ส่วนบันทึก 0.1.0 ด้านบนเป็นสถานะรุ่นก่อนหน้า
