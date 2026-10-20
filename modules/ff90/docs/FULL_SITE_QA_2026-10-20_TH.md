# FF90 — Full-site local QA รอบ 20 ตุลาคม 2026

## ผลส่งมอบ

ติดตั้ง Content & Image Automation จาก ZIP ผู้ใช้เป็นปลั๊กอินตัวที่ 15 บน WordPress local แล้ว ใช้รุ่น compatibility patch 0.3.1 คง uploaded 0.3.0 SAFE ต้นฉบับไว้นอก repository

แก้เมนู slug ชนกับ Automation Bridge, image_contract ยอมรับกรณีไม่มี clean master, attestation ที่เป็น truthy string/integer และการไม่ระบุ article_type การตรวจเหล่านี้เป็น metadata validation ไม่ใช่พิสูจน์สิทธิ์ภาพหรือข้อเท็จจริงจริง

Queue OFF, Auto Publish OFF, Kill Switch ON ของใหม่ และ Bridge worker OFF ตรวจค่าบนเว็บหลักแล้ว ไม่มี MiniMax/Hermes calls, ไม่มีการเผยแพร่ข่าว และไม่แตะ VPS/Production

## ขอบเขตและหลักฐาน

- WordPress 6.9, PHP 8.4, SQLite, Chromium บนสำเนาแยก `/workspace/ff90-qa-full` ฐานข้อมูล/ไฟล์แยกจากเว็บหลัก ลบ credential loaders จริงออก และปิด provider/worker ในสำเนา
- PHP/WordPress/pure/parity: **547 assertions ผ่าน** รวม theme 217, ads 6, modules 84, SEO 42+28, GSC HTTP doubles 29, API-Football HTTP doubles 26, split-provider HTTP doubles 34, plugin ใหม่ pure 22 + WP integration 12 และ TS/PHP reference parity 47
- Browser: **97 cases ผ่าน** แบ่ง theme/layout 32, submenu 10, editorial/ads/insights 17, edge 4, SEO coexistence 8, module UI 13, SEO editor UI 7 และ plugin ใหม่/24 draft previews 6
- PHP lint 71 ไฟล์, JS syntax 3 ไฟล์ผ่าน; browser test ใหม่ตรวจ syntax แยกด้วย
- Theme Check ไม่มี REQUIRED/WARNING/ERROR มี RECOMMENDED 4 ข้อกับ INFO 1 ข้อ ไม่ได้อ้างว่าไม่มีคำแนะนำเหลือ
- ตรวจ real provider/cache smoke แยกบนเว็บหลัก: matches/standings 5 ลีกสถานะ PASS ทั้งหมด ผลใน live-provider-smoke.json ไม่ใช้ HTTP doubles มาสวมเป็น live check
- ข่าวนำเข้า 24 ฉบับบนเว็บหลัก: SHA ของ ID/status/title/content/excerpt ก่อน/หลังตรงกัน ทั้งหมดยัง draft ไม่มี publication

ดูรายละเอียด machine-readable ใน `qa/full-site-2026-10-20/summary.json` และไฟล์ผลแต่ละ suite

## สิ่งที่ browser ตรวจ

สอง Layout ที่ 360/390/768/1024/1440, native Customizer persistence/nonce, data/permalink/featured image preservation, keyboard/no-JS navigation, league/cup submenus, light/dark, article/category/search/empty search/404/author, 13 banner image frames, three ad slots/contact/social placeholders, NEW/HOT/BEST and bot/DNT/logged-in exclusions, search XSS, empty news/no-image states, Gutenberg/Classic sources and SEO metadata, independent human QA/approval/native REST gate, alternative theme และ private REST permissions

ของใหม่ทดสอบทั้ง authenticated admin UI และ existing Inbox ว่าแยกเมนูได้, status/preflight ผ่าน cookie+REST nonce จริง, anonymous denied, preflight 422 พร้อม ready=false/draft_created=false และเปิดอ่าน Draft ทั้ง 24 ด้วย admin ที่ 390px พร้อมยืนยัน anonymous 404 ทุกรายการ ไม่เผยแพร่ screenshots/เนื้อหาของ Draft เหล่านั้น

## ข้อผิดพลาดระหว่างจัดสภาพแวดล้อม QA

การคัดลอกครั้งแรกละ directory dist ทำให้ WordPress core js/css assets มาไม่ครบและ Gutenberg ใช้ไม่ได้ แก้โดยคัดลอก core assets ที่ขาด แล้ว rerun module/SEO browser suites ผ่าน ไม่มีการแก้ assertion ให้เลิกตรวจ JavaScript

legacy Core-off fallback test ปรับใน runner สำเนาให้ยอมรับข้อความยังไม่ได้เชื่อมของ independent Football Widgets ซึ่งปัจจุบันไม่ขึ้นกับ Core แล้ว ยังตรวจ HTTP200/ไม่ประดิษฐ์ข้อมูล ไม่ได้ deactivate ตัวใหม่เพื่อหลบปัญหา

## ข้อจำกัดที่ยังเหลือ

- Content & Image Automation ยังเป็น control panel/preflight เสมอ 422 ไม่มี news writer, image renderer/upload, draft creation หรือ publisher จริง ไม่ได้ทำให้ร่างข่าว 24 ฉบับผ่าน editorial QA โดยอัตโนมัติ
- กฎ Preflight/Content QA/Editorial และ kill switch ของ Bridge ยังไม่ได้รวม flow เดียว ต้องทำก่อนเปิด n8n/Hermes จริง ดู PLUGIN_API_MAP_TH.md
- Source news fact/rights/declared hashes ต้องตรวจอีกครั้ง ไม่มีภาพแนบ การทดสอบภาพใช้ original synthetic QA fixtures ไม่ใช่หลักฐานตรวจภาพข่าวจริงครบทุกข่าว
- Full Backup/Restore ของ DB/media ยังไม่ทำ; WXR/checksum tests ไม่ใช่ restore test
- Google จริง, Hermes/n8n/MiniMax จริง, MySQL/MariaDB บน VPS, TLS/deployment/load/CDN/full-page cache/Firefox/Safari ยัง NOT_RUN
- WP.org update calls ถูกบล็อกใน local network ไม่ได้ตรวจว่าปลั๊กอินทุกตัวมีเวอร์ชันใหม่หรือไม่

การผ่านชุดนี้หมายถึงไม่พบความล้มเหลวค้างใน flow ที่รันทดสอบ ไม่ใช่การรับรองว่าไม่มีบัคหรือ production-ready ครบทุกส่วน

## การรันซ้ำ

ใช้สำเนาแยกพร้อม FF90_QA_SANDBOX=true และไม่มี real provider keys เสมอ รัน PHP/browser suites ตามลำดับ ห้ามรันพร้อมกันบนฐานเดียวกัน และห้าม seed/empty-state/plugin-toggle กับเว็บหลักที่เก็บงานจริง

Source tests: theme/tests, modules/ff90/tests, SEO/GSC/Football Data tests และ Content & Image tests ในแต่ละ plugin Browser ใหม่ต้องตั้ง FF90_QA_WP ให้ wrapper ของสำเนาโดยชัดเจน ชุดทดสอบเดิมที่ hardcode path ใช้ runner สำเนาปรับ wrapper/root ไป clone และเก็บผลนอก source ก่อนรวบรวมเฉพาะผลที่ไม่มีข้อมูลลับ
