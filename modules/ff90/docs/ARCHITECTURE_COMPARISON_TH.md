# FF90 เดิม Next.js เทียบ WordPress เต็มตัว

19 ตุลาคม 2026 (Asia/Bangkok) — ข้อเสนอจากโค้ดและการตรวจ local ไม่ใช่ผล benchmark บน VPS

## ข้อเสนอ

สำหรับ FF90 ที่เน้นข่าวฟุตบอล การแก้เมนู/โฆษณา/เลย์เอาต์จากหลังบ้าน การใช้โมดูลซ้ำหลายเว็บ และการดูแลโดยทีมขนาดเล็ก **แนะนำ WordPress เต็มตัวเป็นตัวเลือกหลักสำหรับทดลองขึ้น staging บน VPS เดิม** โดยยังไม่ย้าย Production และไม่ทิ้ง Next.js เดิม

เหตุผลหลักคือทำงานผ่าน WordPress Admin/Media/roles/REST/plugin interface ชุดเดียวได้ ลดการดูแล frontend Node และการเชื่อม CMS ข้ามระบบ ไม่ใช่เพราะพิสูจน์ว่า WordPress เร็วกว่าแล้ว หากเป้าหมายเปลี่ยนเป็นแอป React โต้ตอบซับซ้อนมากหรือมีทีม frontend ดูแลต่อเนื่อง Next.js ยังมีความเหมาะสม ต้องเทียบความต้องการจริงอีกครั้ง

## ความต่างจากโค้ดจริง

| ประเด็น | FF90 เดิม Next.js | WordPress + FF90 Independent |
|---|---|---|
| โครงสร้างข่าว | ContentService อ่าน WordPress ผ่าน GraphQL; local ที่ไม่ตั้ง endpoint ใช้ fallback mock | อ่านโพสต์/หมวด/ภาพผ่าน WordPress โดยตรง |
| หลังบ้าน | มี custom admin/editorial/security UI ต้องดูแลโค้ดและการเชื่อมข้อมูล; ไม่ใช่ว่าไม่มีหลังบ้าน | ใช้ native WordPress และหน้า Settings/QA ของปลั๊กอิน |
| Layout/เมนู/โฆษณา | UI เฉพาะระบบ บางการเปลี่ยนต้องแก้โค้ด/build | Layout A/B, native menus, 3 ad slots, social/contact ตั้งค่าผ่านหลังบ้าน |
| ระบบ deploy บน VPS | Node runtime + build/process supervision และ CMS/DB ที่เลือกใช้; build memory ต้องเผื่อ | Web server + PHP-FPM + MySQL/MariaDB บน VPS เป้าหมาย; local ยัง SQLite |
| API ฟุตบอล | มี clients/registry ใน TypeScript แต่ local benchmark นี้ไม่ได้ตั้ง live keys ให้ Next | เชื่อม API-Football fixtures/results + football-data.org standings จริง 5 ลีกแล้ว |
| Automation | ต้องทดสอบสัญญา publisher/approval กับ Hermes จริง ไม่ใช่เห็น template แล้วถือว่าเชื่อมแล้ว | Native REST/Application Password และ bridge เตรียมไว้ แต่ Hermes publishing ยังรอทดสอบจริง |
| โมดูลใช้กับเว็บอื่น | แชร์ TS services ได้ แต่ขึ้นกับ Node/application contracts | 14 ปลั๊กอินแยกติดตั้งได้ ต้องรักษา dependency/versions และดูแล custom code ต่อ |
| SEO | มีโค้ด V3/V4 เดิม หลายส่วนยังไม่ได้พอร์ตครบ WordPress | Core 0.2.0/Football/GSC แยกโมดูล แต่ GSC จริงยังไม่เชื่อม และไม่ได้อ้าง parity ครบ V3/V4 |
| Security/Backup | ต้อง audit โค้ดเดิมและ deployment เช่นกัน | Security เป็น baseline; Operations มี WXR content export ยังไม่มี full DB/media restore |
| ทำ Web App/แอปในอนาคต | React UI เป็นฐานที่ต่อยอดได้ ต้องทำ auth/offline/app packaging เพิ่ม | มี REST API เป็นฐาน แต่ mobile app/PWA ต้องออกแบบเพิ่มเติม ไม่ได้แปลงเป็นแอปสมบูรณ์อัตโนมัติ |

WordPress มีปลั๊กอิน 14 ตัวไม่ได้แปลว่าฟีเจอร์ทุกตัวครบ V4 หรือไม่ต้องมีนักพัฒนาดูแล ทั้งสองทางมี custom code ที่ต้องอัปเดตและทดสอบ

## ผล local diagnostic ที่วัดแล้ว

หลักฐาน `qa/local-architecture-baseline.json`: หน้าแรกฝั่งละ 21 requests (ครั้งแรกแยกออก เหลือ 20 warm samples) และตรวจไฟล์ JS/CSS ที่เบราว์เซอร์ร้องขอ

| รายการ | Next.js เดิม | WordPress ใหม่ |
|---|---:|---:|
| Warm TTFB median | 22.22 ms | 254.99 ms |
| Warm TTFB p95 | 32.32 ms | 276.61 ms |
| HTML raw | 94,942 bytes | 92,180 bytes |
| JS แยกไฟล์ raw | 375,789 bytes / 7 files | 1,739 bytes / 1 file |
| JS gzip ประมาณจากไฟล์ | 112,590 bytes | 666 bytes |
| CSS raw | 30,763 bytes / 2 files | 33,331 bytes / 3 files |
| ภาพที่โหลดแล้วเสีย ณ จุดตรวจ | 0 | 0 |

**ห้ามใช้ตารางนี้สรุปผู้ชนะความเร็วบน Production** Next ใช้ existing Next 15.5.25 production build, หน้า revalidate=300 และ mock content/fallback ส่วน WordPress ใช้ PHP built-in server, WordPress 6.9, PHP 8.4, SQLite, 14 modules, ข้อมูลข่าว/ฟุตบอลจริง และยังไม่มี full-page cache ข้อมูล/ภาพ/จำนวนข่าวไม่เท่ากัน และไม่ได้ต่อ GraphQL/DB จริงให้ Next ในรอบนี้

TTFB เป็น loopback ภายในเครื่อง ไม่มี latency ผู้ใช้จริง gzip เป็นการบีบอัดไฟล์ที่วัดได้เพื่อประมาณ ไม่ใช่หลักฐานว่าตั้ง HTTP compression บน VPS แล้ว ไม่รวม inline script ในค่า JS แยกไฟล์ รูป lazy ที่ยังไม่ถูกโหลดไม่ถูกนับว่าเสีย ไม่ได้วัด LCP/INP/CLS หรือความจุผู้ใช้พร้อมกันใน Production

สิ่งที่สรุปได้: Next ตอบ HTML เร็วกว่าในการตั้งค่าชุดนี้ และ WordPress ส่ง JS แยกไฟล์น้อยกว่าอย่างมาก ความลื่นจริงยังขึ้นกับภาพ, cache, network, browser และงานหลังโหลด HTML

## ทำให้การเทียบก่อนย้ายยุติธรรม

1. ใช้ staging ที่แยกจาก Production บน VPS เดิมหรือทรัพยากรเทียบเท่า ใช้ข่าว/ภาพ/หมวด/โฆษณาชุดเดียวกันและข้อมูลฟุตบอล snapshot เดียวกัน ตัดการยิง upstream ระหว่าง load test
2. ใช้ Node production build สำหรับ Next และ Nginx/Apache + PHP-FPM + MySQL/MariaDB สำหรับ WordPress ไม่มี debug output กำหนด CPU/RAM/concurrency ให้เทียบกันได้
3. วัดทั้ง cold/warm และ cache hit/miss หน้าแรก/ข่าว/หมวด/search/ตารางแข่ง/standings ตรวจ mobile LCP/CLS และ interaction ที่กำหนดไว้ บันทึก request rate/p95/errors/RSS/CPU/DB queries และ cache ratio
4. WordPress ต้องมี page cache, OPcache, image sizes/WebP/AVIF ตามความเหมาะสม และจำกัดงาน cron นอก request ห้ามอ้างว่า install cache แล้วผ่านโดยไม่วัดจริง
5. Cache ต้อง purge เมื่อเผยแพร่/แก้ข่าว/Featured Image/เมนู/โฆษณา/เลย์เอาต์/ข้อมูลฟุตบอลอัปเดต และใช้ TTL เหมาะกับ NEW/HOT/BEST; bypass login/admin/preview/REST write/approval
6. News Insights ปัจจุบันนับวิวจาก native document request: full-page cache/PWA/REST จะข้าม counter ต้องมี cache-safe analytics ก่อนใช้ HOT/BEST เป็นข้อมูลคนดูจริงบนเว็บที่มี full-page cache ไม่เพิ่มตัวเลขจำลองแก้ปัญหา
7. ทดสอบ backup ทั้ง DB + wp-content + config ที่เก็บลับและ restore ใน staging จริง ขณะนี้ WXR export ไม่ใช่ full backup ห้ามถือว่าผ่านแล้ว
8. รอ Hermes template แล้วทดสอบ publish gate, featured images, idempotency/recovery, source QA และการ purge cache แบบ E2E ก่อนย้าย

## Cloud VPS 03 และต้นทุน

ผู้ใช้มี VPS ของ Visperhost อยู่แล้ว จึงไม่ต้องเช่าเพิ่มเพื่อทดลอง แต่ยังไม่ทราบ vCPU/RAM/disk/OS/บริการที่รันอยู่จริง หน้า https://www.visperhost.net/vps-server/ ตอบ proxy/HTTP403 จาก cloud นี้แม้ลอง escalated read จึงไม่เดาสเปกหรือจำนวนผู้ใช้ที่รองรับจากชื่อแพ็กเกจ

ต้องตรวจว่ามี n8n/DB/เว็บอื่น/คิวภาพร่วมเครื่องหรือไม่ แล้วกำหนด resource budget หาก RAM จำกัด การลด Node frontend process และขั้นตอน build อาจทำให้ดูแลง่ายขึ้น แต่ PHP workers/DB ก็ใช้ RAM เช่นกัน ยังไม่มีการวัด peak RAM เทียบเท่าทั้งสองระบบหรือทดสอบบน VPS จริง

ต้นทุนโฮสต์ที่จ่ายอยู่แล้วอาจไม่ต่างกันระหว่างสองทาง ความต่างหลักอาจเป็นเวลาพัฒนา/บำรุงรักษา/อัปเดต/แก้ deployment มิใช่รับรองว่าจะลดบิล VPS อัตโนมัติ ไม่มีการซื้อ plugin, CDN, control panel, object storage หรือแพ็กเกจ API ใหม่ หากต้องจ่ายเพิ่มต้องแจ้งผู้ใช้ก่อน

## การตัดสินใจตอนนี้

ทดลอง WordPress เต็มตัวต่อเป็นทางหลัก และรักษา Next เดิมไว้เทียบ ยังไม่ย้าย Production จนกว่าจะผ่านการเทียบ dataset เดียว, cache-aware analytics, full backup/restore และ Hermes E2E หากผู้ใช้ต้องการ React application UI ขั้นสูงเป็นแกนหลัก ให้ประเมิน Next/headless ใหม่โดยรวม CMS/DB/process ที่ต้องดูแลทั้งหมด


## อัปเดตสเปก VPS ที่ผู้ใช้ยืนยัน

Cloud VPS 03: CPU 4 vCore, RAM 8 GB, SSD 100 GB, Public IPv4 1 IP, Domestic 1 Gbps shared, International 200 Mbps shared และ Unlimited monthly transfer ส่วน OS, control panel, บริการที่มีอยู่, free disk/RAM และการวาง n8n/Hermes ร่วมเครื่องยังไม่ทราบ ข้อมูลนี้แทนส่วนที่ระบุว่ายังไม่ทราบสเปกข้างต้น ไม่ใช่ผลตรวจเครื่องผ่าน SSH

สเปกนี้เป็นจุดเริ่มต้นที่เหมาะสมในการทดลองทั้ง WordPress และ Next.js ไม่ใช่เหตุผลที่บังคับให้ต้องเลือก WordPress และไม่ใช่หลักฐานว่ารองรับผู้ใช้พร้อมกันจำนวนใดได้แล้ว ข้อเสนอ WordPress ยังอิงความง่ายของ editorial/admin/deploy และการลดชั้น CMS/frontend ที่ต้องดูแล

- WordPress: ใช้ Nginx หรือ web server ที่มีอยู่ร่วมกับ PHP-FPM/OPcache และ MySQL/MariaDB พร้อม full-page cache ที่ purge ถูกต้อง กำหนดจำนวน PHP workers หลังวัด RSS/request และ slow requests จริง ไม่ใช้ SQLite/PHP built-in server เป็นผลแทน VPS Production
- Next.js: CPU/RAM เพียงพอสำหรับเริ่มทดลอง production process เช่นกัน แต่ต้องนับ CMS/DB และ build memory รวมด้วย หลีกเลี่ยงการ build ขณะ automation/image processing หนักบนเครื่องเดียวกัน
- หากเพิ่ม n8n/Hermes ร่วม VPS: แยก processes/queues และเผื่อ RAM/CPU ก่อนเพิ่ม concurrency ยังไม่เปิดหรือเปลี่ยน Content Automation ในงานนี้ ตรวจว่ามี browser/AI/image jobs ที่กินทรัพยากรหรือไม่
- SSD 100 GB ต้องแบ่งให้ OS, DB, uploads, logs และพื้นที่ว่างสำหรับ backup/restore ชั่วคราว ภาพข่าวอาจเป็นส่วนที่โตเร็ว ควรใช้ขนาดภาพเหมาะสม/รูปแบบบีบอัดและ log rotation สำรองนอก VPS แยกจากสำเนาในเครื่อง ไม่เก็บ full backup ทุกวันไม่จำกัดจนดิสก์เต็ม
- Shared bandwidth เป็นอัตราพอร์ตที่แบ่งใช้ ไม่ใช่ความเร็วรับประกันต่อผู้ชม Unlimited transfer ไม่ได้หมายถึง throughput, CPU หรือ concurrent users ไม่จำกัด ยังต้องวัดจากจุดที่ผู้ชมใช้งานจริง
- 1 Public IPv4 สามารถใช้ reverse proxy/SNI แยก staging และเว็บไซต์ตาม hostname ได้ แต่ต้องแยก DB/config/credentials/cache/cookies และ resource limits ให้เหมาะสม การรันสองระบบเพื่อเทียบพร้อมกันมีต้นทุนทรัพยากร จึงยังต้องออกแบบก่อนติดตั้ง

ไม่จำเป็นต้องเสนอเช่า VPS ใหม่จากสเปกนี้ ขณะนี้คงทดสอบ local และรอ Automation ตามผู้ใช้ ยังไม่ SSH, deploy, เปลี่ยน DNS หรือซื้อบริการใด การตัดสินใจจำนวนผู้ใช้/ความเร็ว/พื้นที่เหลือต้องยืนยันด้วยข้อมูลบนเครื่องจริงและ load/restore tests
