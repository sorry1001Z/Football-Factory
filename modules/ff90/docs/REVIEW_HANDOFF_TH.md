# ส่งต่อให้แชทตรวจปลั๊กอิน FF90

Repository: https://github.com/sorry1001Z/Football-Factory
Branch: `codex/ff90-independent-theme`
Implementation baseline: `8a8ffe8` (ใช้ branch ล่าสุดสำหรับเอกสารส่งต่อ)

## คำสั่งสำหรับแชทถัดไป

โปรดตรวจ Source ของปลั๊กอินทั้งหมดใน `wordpress-plugins/` บน branch ข้างต้น อ่านเอกสารนี้ร่วมกับ `modules/ff90/docs/STATUS_TH.md`, `INSTALL_TH.md`, `QA_REPORT.md` และ `N8N_HANDOFF_TH.md` ก่อนสรุปสถานะ ตรวจโค้ดจริงและหลักฐานทดสอบ แยก implemented / tested locally / waiting integration / NOT_RUN ให้ชัด อย่าสรุปว่า V4 ครบหรือ production ready จากเลขเวอร์ชัน ห้ามแก้ Production, News Automation ของ Hermes หรือเผยแพร่ข้อมูลลับ หากเข้า private repository ไม่ได้ ให้ผู้ใช้แนบไฟล์ ff90-all-plugins-review.zip ซึ่งมี Source, เอกสาร และ ZIP ติดตั้งแยกแต่ละตัว

## ปลั๊กอินทั้งหมด 14 ตัว

| Directory | Version | หน้าที่ / ข้อจำกัดสำคัญ |
|---|---|---|
| football-factory-core | 0.1.0 | Core เดิม: CPT/REST/schema scaffolding; ไม่ได้ตรวจใหม่ครบทุกส่วน |
| ff90-news-insights | 1.0.0 | นับวิวและ NEW/HOT/BEST; full-page cache อาจข้ามตัวนับ |
| ff90-seo | 0.2.0 | Intent, quality, schema validation, internal links, sitemap/news sitemap; ไม่ได้อ้างครบสเปก V3/V4 ทั้งหมด |
| ff90-seo-football | 0.1.0 | Football entity adapter แบบ static; ต้อง map taxonomy และตรวจข้อมูลปัจจุบัน |
| ff90-seo-gsc | 0.1.0 | OAuth/GSC connector; Google จริง NOT_RUN |
| ff90-security | 0.1.0 | Security baseline; ไม่ใช่ Security V4 ครบชุด |
| ff90-content-qa | 0.1.0 | ตรวจโครงสร้าง/แหล่งข่าวและ human fact/rights attestation; ไม่ใช่ fact-check API |
| ff90-editorial-approval | 0.1.0 | Approval ผูกกับ snapshot; ต้องเชื่อม publisher ของ Hermes ผ่านสัญญาที่กำหนด |
| ff90-football-data | 0.1.0 | football-data.org v4 adapter/cache/quota; API จริง NOT_RUN |
| ff90-football-widgets | 0.1.0 | Fixtures/results/standings; ต้องใช้ Football Data |
| ff90-image-registry | 0.1.0 | สิทธิ์ภาพ/hash/lease/heuristic กันภาพซ้ำ; ต้องมีแหล่งภาพมีสิทธิ์ |
| ff90-banner-renderer | 0.1.0 | Featured banner 13 รูปแบบ; ไม่สร้างภาพ |
| ff90-automation-bridge | 0.1.0 | Durable inbox/idempotency/recovery; n8n/Hermes จริง NOT_RUN; ไม่มี bundled publisher |
| ff90-operations | 0.1.0 | Health และ private WXR content export; ไม่ใช่ full DB/media backup และไม่มี restore engine |

SEO Football และ GSC ใช้ร่วมกับ SEO Core; Editorial ใช้ Content QA; Widgets ใช้ Football Data อ่าน INSTALL_TH.md สำหรับลำดับและการตั้งค่า สิทธิ์/nonce/REST authentication ต้องคงไว้ Privileged PHP/direct SQL ไม่อยู่ภายใต้ sandbox ของ Editorial Gate

## หลักฐานและขอบเขต

งานล่าสุดมี local module contracts 84 cases, browser 13 cases และ SEO regression 42 cases ตามไฟล์ใน `modules/ff90/docs/qa/` ไม่ใช่ผลทดสอบ live staging หรือ external services การเรียก Football API ใช้ HTTP doubles Google/Football/n8n/Hermes จริงและ full backup restore ยัง NOT_RUN ตรวจรายงานแต่ละชุดก่อนขยายข้อสรุป

Theme แยกอยู่ที่ `wordpress-themes/ff90-independent/` รุ่น 1.2.0 ไม่ได้นับเป็นปลั๊กอินและไม่รวมใน ZIP นี้ ไม่มีการเปลี่ยน runtime ระหว่างทำชุดส่งต่อ

## เปิดชุดส่งต่อ

แตก `ff90-all-plugins-review.zip`: `source/` เป็นไฟล์ที่ติดตามใน Git ของปลั๊กอินทั้ง 14 ตัวพร้อมเอกสารโมดูล, `plugins/` เป็น ZIP ติดตั้งแยกตัว, `MANIFEST.json` ระบุ hash ของแต่ละ ZIP ห้ามอัปโหลดชุดรวมเป็นปลั๊กอินตัวเดียว ชุดนี้ไม่มี credentials จาก environment และไม่รวม WordPress database/media
