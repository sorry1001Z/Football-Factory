# สถานะ A–L — 18 ตุลาคม 2026

คำว่า "ทำแล้ว" ในตารางหมายถึงโค้ดและการทดสอบ Local ตามขอบเขตที่ระบุ
ไม่ใช่การยืนยันว่าขึ้น Production หรือผ่านบริการภายนอกจริงแล้ว
ทุกปลั๊กอินแยก ZIP และใช้กับ WordPress ธีมอื่นได้ แพลตฟอร์มอื่นต้องมี adapter

| หัวข้อ | ทำแล้ว | หมายเหตุ / งานที่ยังรอ |
|---|---|---|
| A SEO | SEO Core 0.2.0 + Football SEO Adapter + GSC Connector | รอ OAuth/Consent/Property Google จริง; ไม่อ้างครบสเปก SEO V4 ภายนอก หรือ GSC opportunity UI ครบทุกประเภท |
| B Security V4 | `ff90-security` 0.1.0: login throttle, headers, private redacted audit | เป็น baseline; ยังไม่ใช่ V4 ครบชุด, ไม่มี WAF/MFA/malware scanner/pentest; รอรายละเอียด V4 และการตรวจ host/CDN จริง |
| C Editorial Approval | `ff90-editorial-approval` 0.1.0 + K: saved-version QA/approval, history, pause, opt-in native/REST/cron gate | ค่าเริ่มต้น advisory; ให้ publishers ใช้ helper/native preflight; ต้องเชื่อม publisher ของ Hermes จริง และทดสอบ staging; privileged PHP/SQL ไม่ใช่ sandbox ของปลั๊กอิน |
| D Football Data Engine | `ff90-football-data` 0.1.0: football-data.org v4, cache/stale/quota/lock/timezone | รอ API key/plan และตรวจข้อมูลจริง; ไม่มี API-Football adapter ในแพ็กเกจนี้; current standings ไม่อ้างเป็น historical table |
| E n8n / Recovery | `ff90-automation-bridge` 0.1.0: authenticated inbox, idempotency, owner permissions, leases, bounded retry/recovery | รอ n8n/Hermes handler + Native WP App Password + HTTPS + cron จริง; worker ปิดเริ่มต้น; ไม่ publish และไม่แก้ workflow เดิม |
| F Theme | `ff90-independent` 1.2.0 ทำเสร็จแล้วตาม Local QA เดิม | ไม่แก้ Source ธีมรอบนี้; deployment/staging จริงยังแยกจากการทดสอบ Local |
| G Standings / Fixtures | `ff90-football-widgets` 0.1.0: fixtures/results/standings shortcodes + theme hooks | รอข้อมูลจริงจาก D; ทดสอบ renderer ด้วย HTTP test doubles อย่างชัดเจน |
| H Image Selection / Anti-Repetition | `ff90-image-registry` 0.1.0: human rights records, SHA-256, dHash+mean-color heuristic, recent-use ledger, exact-hash atomic reservations | รอ image-candidate feed ที่มีสิทธิ์จาก Hermes/ผู้ให้บริการ; visual matching ไม่รับประกันทุก crop/rotation และไม่พิสูจน์สิทธิ์ตามกฎหมาย; ไม่ backfill ข่าวเก่าอัตโนมัติ |
| I Featured Banner Renderer | `ff90-banner-renderer` 0.1.0: แยกจากธีม, 13 ประเภท, native responsive images ไม่ตัดภาพ, REST kind metadata | รอภาพจริงจาก Image Factory; renderer ไม่สร้างภาพ; รักษา category fallback ของธีมเดิม |
| J Analytics / Monitoring / Backup | News Insights เดิม + `ff90-operations` 0.1.0: private DB/module health และ private WXR content export/checksum | **ยังบางส่วน**: รอ cache-aware analytics, external monitoring/alert adapter, host/private storage, full DB/media/config backup และ restore drill; WXR ไม่ใช่ full backup และไม่มี restore engine |
| K Content QA / Fact Checking | `ff90-content-qa` 0.1.0: structural/source checks, Gutenberg/Classic sources, independent human fact/rights attestation | ข้อเท็จจริงเป็น human-attested ไม่ใช่ AI/automatic truth verification; รอแหล่งข่าวและเจ้าหน้าที่ตรวจจริง; ไม่มี fact-check API ภายนอก |
| L Integration & E2E QA | Local contracts + browser integration + 5 mobile/tablet/desktop widths + unrelated theme | **ยังบางส่วน**: external staging, live Google/provider/n8n/Hermes, full-cache analytics, backup restore และ Production E2E ยัง NOT_RUN |

## ขอบเขตที่ไม่เปลี่ยน

- ไม่แก้ Next.js, Core เดิม, ข่าวอัตโนมัติของ Hermes, workflow n8n เดิม หรือ Production
- ไม่สร้างคะแนนฟุตบอล/คนดู/ข่าวจริงปลอม ไม่เอาข้อมูลทดสอบไปนับเป็น live evidence
- ไม่ใส่ secret ลง Repo/ZIP; native WordPress user permissions/nonces เป็นฐาน
- GitHub source push ใช้งานได้; การสร้าง PR ผ่าน API เคยถูก Forbidden และยังไม่อ้างว่ามี PR ใหม่

## ข้อจำกัดด้านการอนุมัติที่ต้องส่งต่อให้ผู้เชื่อม

C ตรวจ native wp_insert_post_data, REST final proposed fields และ scheduled
core publisher ก่อนเผยแพร่ รวม sources/author/Featured Image/bytes เมื่อ H ทำงาน
ทั้ง Gutenberg และ Classic. ใช้ `ff90_editorial_publish($post_id)` เป็น publishing
entry point ที่ระบุชัดและ fail closed หาก QA/plugin/approval ไม่พร้อม

ปลั๊กอิน PHP อื่นที่เรียก `wp_publish_post` โดยตรงหรือเขียน SQL มีสิทธิ์ใน process
เดียวกันและข้าม preflight ได้ ต้องแก้ publisher adapter ของระบบนั้นเมื่อได้รับมอบหมาย
ไม่ใช่ใส่ module C แล้วอ้างว่าคุมทุก privileged plugin ได้ทันที


## อัปเดต API-Football — 18 ตุลาคม 2026

Football Data Engine 0.2.0 และ Widgets 0.1.1 เพิ่ม API-Football บน local แล้ว ยืนยัน Free active 100/day, fixtures วันนี้ 5 ลีก และพบว่า standings PL ปี 2026 ถูกปฏิเสธ (2024 ใช้ได้) สถานะเก่า NOT_RUN ของ API-Football ในเอกสารนี้ถูกแทนเฉพาะส่วนที่ตรวจจริงข้างต้น ดู [แผน Free และผลเชื่อมจริง](API_FOOTBALL_FREE_PLAN_TH.md) ส่วน Google/Hermes/Production และฟีเจอร์อื่นยังคงสถานะเดิม


## 19 ตุลาคม 2026 — เตรียมแหล่งตารางคะแนนแยก

เพิ่ม Data Engine 0.3.0 / Widgets 0.1.2 และรับคีย์ football-data.org แล้ว แต่ cloud proxy ปฏิเสธ CONNECT 403 ก่อนถึง API จึงยังไม่สลับ source และไม่อ้างว่าตรวจสิทธิ์ 5 ลีกสำเร็จ ดู [สถานะและขั้นตอนแก้ Network](FOOTBALL_DATA_CONNECTION_TH.md)
