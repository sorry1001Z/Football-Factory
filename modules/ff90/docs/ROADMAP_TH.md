# โมดูลที่ใช้ซ้ำข้ามเว็บไซต์ — แผนงานและสถานะจริง

วันที่เริ่ม 17 ตุลาคม 2026 — ทำงานแยกจาก Production/Hermes automation

หลักการ: แกนกฎไม่ผูกชื่อเว็บ, WordPress adapter แยกจากแกน, เปิด/ปิดแต่ละ
ปลั๊กอินได้, ใช้ native posts/media/permissions และ versioned contracts.
คำว่าใช้ได้กับทุกเว็บในงานนี้หมายถึง WordPress ที่รองรับข้อกำหนดของปลั๊กอิน
ส่วนเว็บ Next.js/ระบบอื่นต้องมี adapter ของแพลตฟอร์มนั้น ไม่ใช่ติดตั้ง PHP ZIP ได้ตรงๆ

| โมดูล | ลำดับ/สถานะ |
|---|---|
| A SEO V4 | พอร์ตเป็น `ff90-seo` 0.2.0 พร้อม Intent/Deep Quality/Schema; Football และ GSC แยก ZIP แล้ว ยังไม่ใช่ V4 ครบชุด ดู MODULES_TH.md |
| B Security V4 | ถัดไป: ต้องกำหนดขอบเขต V4; ของเดิม Next.js มี guards/CSRF/rate limit ไม่ถือว่าเป็น WP security plugin |
| C Editorial Approval | ต้นแบบยังไม่เปิดใช้ เก็บนอก source ที่ส่งมอบ; รอกำหนดนโยบายคนอนุมัติ/ประวัติ/audit/การแก้ข่าวหลังอนุมัติให้ครบ |
| D Football Data Engine | มี Next.js adapters เดิม; ต้องทำ WordPress bridge และตรวจ credentials/provider จริงก่อนเปิดใช้ |
| E n8n / Recovery | มี workflow/recovery เดิม; ไม่แก้ระบบ Hermes หรือเปิด workflow อัตโนมัติ |
| F Theme | เสร็จ Local QA: ff90-independent 1.2.0 |
| G Standings / Fixtures | ทำหลัง D; ธีมมี hooks แต่ไม่มี production data renderer |
| H Image Selection / Anti-Repetition | มี helper เดิม; ต้องยืนยันสิทธิ์ source/นิยามซ้ำ/ช่วงเวลาและทำ adapter ก่อนใช้งานจริง |
| I Featured Banner Renderer | ฝั่งธีมแสดง 13 ประเภทแล้ว; ยังไม่ใช่ปลั๊กอิน renderer อิสระครบวงจร |
| J Analytics / Monitoring / Backup | ff90-news-insights เสร็จ Local QA; analytics provider/cache-safe tracking/monitoring/backup/restore ยังไม่ครบ |
| K Content QA / Fact Checking | ตัวตรวจโครงสร้างเป็นต้นแบบนอก source; ไม่อ้างว่า deterministic checks พิสูจน์ข้อเท็จจริงได้ |
| L Integration & E2E | ทดสอบทุก milestone ใน local จริง; final staging/provider/Hermes E2E ยัง NOT_RUN |

## ลำดับงาน

1. A: PHP SEO + Editor + sitemap/internal links + Intent/Deep Quality/Schema เสร็จ local; Football และ GSC adapter พร้อมตั้งค่า ส่วน live GSC/provider verification รอภายหลัง
2. B/C/K: สิทธิ์/การอนุมัติ/การตรวจเนื้อหา ออกแบบร่วมกัน แต่แยกแพ็กเกจ
3. D/G: ข้อมูลที่มี source + renderer ที่ไม่สร้างคะแนน/โปรแกรมเอง
4. H/I: ภาพมีสิทธิ์และเลือกไม่ซ้ำ + renderer
5. E/J: เชื่อม orchestration/recovery, analytics/monitoring/backup โดยคง approval gates
6. L: E2E ทั้งเส้นทางรวม staging, fail-closed, recovery และ restore จริง

ไม่ติดป้าย V4 ให้โค้ด subset, ไม่ถือว่ามีไฟล์แปลว่ารันจริงแล้ว,
ไม่ต้องแก้หรือรีแฟกเตอร์ Next.js/Hermes เดิมเพื่อส่งมอบโมดูล WordPress ใหม่.
