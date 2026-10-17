# SEO แบบแยกปลั๊กอิน — 18 ตุลาคม 2026

## ติดตั้งตามลำดับ

1. **FF90 Modular SEO 0.2.0** — แกน PHP ทั่วไป ใช้กับเว็บ WordPress
   ประเภทอื่นได้ ไม่ต้องเปิดโมดูลฟุตบอลหรือ GSC
2. **FF90 SEO Football Adapter 0.1.0** — เปิดเฉพาะเว็บฟุตบอล ต้องมีแกน SEO
3. **FF90 SEO Search Console Connector 0.1.0** — เปิดเมื่อจะเชื่อม Google
   ใช้กับเว็บที่ไม่ใช่ฟุตบอลก็ได้ ต้องมีแกน SEO

ทั้งสามเป็น ZIP แยกกัน ไม่มี Parent Theme, Node server หรือบริการวิเคราะห์ภายนอก
บังคับใช้ เว็บ Next.js/แพลตฟอร์มอื่นต้องทำ adapter ของแพลตฟอร์มนั้น ไม่สามารถ
ติดตั้ง ZIP ของ WordPress โดยตรงได้ โค้ด Next.js/Hermes เดิมไม่ได้ถูกเปลี่ยน

## สิ่งที่เพิ่มจาก 0.1.0

- Search Intent: weighted phrases, negative patterns, locale, confidence,
  ambiguity และ tie-break ตาม V3; เพิ่ม Target keyword ใน Editor
- Deep Quality: เกณฑ์ title/meta, H1/H2 ซ้ำ, เนื้อหาบาง, ประโยค/ย่อหน้ายาว,
  stuffing, repeated phrase, provenance/schema completeness, alt coverage,
  freshness, duplicate signals และคำแนะนำ internal/source links
- Thai analyzer พอร์ต orthographic-cluster heuristic จาก V3 ไม่ใช่ word segmenter
  และไม่ใช้ความยาวภาษาไทยเป็นข้อห้ามเผยแพร่เพียงอย่างเดียว
- Schema Validator ตรวจ empty graph, missing type, duplicate ID และ unresolved
  references; เพิ่ม safe nesting depth ไม่ได้อ้างว่าเป็น Google Rich Results Test
- Football identities/relations/intent แยกจากแกน; ใช้ seed registry ของ Repo
  ไม่มีคะแนนสด ไม่มีนักเตะหรือ Match ที่แต่งขึ้น และไม่ยืนยัน membership ฤดูกาลปัจจุบัน
- Internal links ป้องกันลิงก์เดิม/heading/script/style/comment/attributes,
  ไม่แนะนำชื่อกำกวม, dedupe target และให้ offset แบบ UTF-16 สำหรับ JS
- GSC เป็น connector จริงในฝั่งโค้ด OAuth + PKCE + refresh + property selection +
  Search Analytics + revoke ไม่ใช่แค่ interface ที่คืน Mock Data

## การใช้งานฟุตบอล

แก้ Category/Tag → Football identity → เลือกทีม/การแข่งขัน → ยืนยันว่าเป็น
landing page ถูกต้องแล้ว จึงมีลิงก์แนะนำไป archive จริงของเว็บนั้น หากยังไม่ map
หรือ map ซ้ำกำกวมจะไม่สร้าง URL ขึ้นเอง Registry เปลี่ยนผ่าน filter ได้
Schema ทีม/การแข่งขันเป็น candidate ในรายงาน ไม่แทรก entity JSON-LD สาธารณะ
อัตโนมัติก่อนออกแบบเจ้าของ graph ร่วมกับระบบข้อมูลจริง

## การเตรียม GSC — ยังไม่ต้องเชื่อมตอนนี้

- สร้าง Google OAuth Web client และเปิด Search Console API ใน Google Cloud
- ใส่ `FF90_GSC_CLIENT_ID` และ `FF90_GSC_CLIENT_SECRET` ผ่าน server environment
  หรือ `wp-config.php` ไม่ใส่ค่าลับใน Repo หรือบทสนทนา
- ใส่ redirect URI ตรงตาม Settings → FF90 Search Console
- ใช้ HTTPS บนเว็บจริง; localhost HTTP ใช้ได้เฉพาะทดสอบในเครื่อง
- เมื่อพร้อม กด Connect Google ด้วยผู้ดูแลเว็บ, ให้สิทธิ์ readonly,
  เลือก Property ที่บัญชีเข้าถึงได้ แล้ว Fetch real metrics
- Token เข้ารหัสใน wp_options แบบไม่ autoload; รองรับ refresh/disconnect/revoke
  หากเปลี่ยน WordPress salts ต้องเชื่อมใหม่ ไม่ส่ง token ออก REST/Editor
- ค่า Google credential ที่มีใน cloud environment ไม่ใช่ OAuth client/grant ของ
  Search Console เว็บนี้ จึงไม่ได้เอามาใช้แทนสิทธิ์บัญชีของผู้ดูแล
- ยังไม่ได้ทดสอบ Google จริง ผลทดสอบ OAuth ใช้ HTTP test doubles ชัดเจน

## ขอบเขตและความต่างจาก TypeScript

เวอร์ชัน 0.2.0 ปิดช่องว่างของ Intent/Deep Quality/Football Adapter/Schema
ที่แจ้งไว้ใน 0.1.0 และเตรียม GSC connector พร้อมตั้งค่า แต่ไม่ใช่คำยืนยันว่า
ทุก export ของ V3 หรือสเปก SEO V4 ภายนอกถูกพอร์ตครบทุกบรรทัด

นโยบายที่ตั้งใจปรับให้เข้ากับ WordPress: Canonical จำกัด same-origin และเก็บ
query ที่ระบุ native post identity; Publish Gate ของ WP เน้น structural veto
ไม่ใช้คะแนน advisory 75 เป็นเหตุห้ามเผยแพร่ภาษาไทยอัตโนมัติ; link anchor ที่ยาว
เกิน limit จะข้ามแทนการตัดครึ่ง Unicode; link context string/ตัวเลือกปลดการป้องกัน
markup ของ V3 ไม่เปิดใช้; GSC metrics ใช้ช่วงวันที่ inclusive ตาม API จริง

GSC opportunity classifier/aggregation Wave D เดิมยังไม่ได้พอร์ตเป็น UI แนะนำ
โอกาสครบ 8 ประเภท; URL Inspection, comparison-period enrichment และ current
player/match identity ไม่ได้อยู่ใน connector นี้ ไม่คืนค่าคาดเดาแทนข้อมูลที่ขาด
การเชื่อม provider/Google จริง, staging และ cache/CDN production ยัง NOT_RUN

PHP intl ช่วยให้ normalization NFKC ครบ; หากไม่มี จะรายงาน basic_unicode
และแจ้งใน Editor การนับ/offset ใช้ iconv; GSC token encryption ต้องรองรับ sodium
ทั้งหมดตรวจใน Local WP/PHP จริง ไม่ใช่การยืนยันกับทุกโฮสต์หรือทุกปลั๊กอิน SEO
