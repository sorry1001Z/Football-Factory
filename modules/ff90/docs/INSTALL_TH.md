# ติดตั้งชุดโมดูล WordPress

ZIP รวมเป็น **ชุดไฟล์สำหรับแตกออก** ไม่ใช่ปลั๊กอินก้อนเดียวสำหรับอัปโหลดตรงๆ
เลือกติดตั้ง ZIP รายตัวผ่าน Plugins → Add New → Upload Plugin
เริ่มบน WordPress ทดสอบก่อน ไม่ติดตั้งหรือเปิดใช้บน Production โดยอัตโนมัติ

## ลำดับแนะนำ

1. `ff90-security` — baseline headers/login/audit
2. `ff90-content-qa` — sources และ human QA
3. `ff90-editorial-approval` — ต้องมี Content QA
4. `ff90-football-data` → `ff90-football-widgets` — ตัวหลังต้องมี engine
5. `ff90-image-registry` — ให้ reviewer ระบุสิทธิ์ภาพใน Media Library
6. `ff90-banner-renderer` — shortcode/REST banner kind ใช้ได้ทุกธีม
7. `ff90-automation-bridge` — inbox และ worker/recovery
8. `ff90-operations` — health และ content export

SEO 3 ตัวและ News Insights เดิมติดตั้งแยกได้ตามที่ส่งมอบก่อนหน้า ไม่จำเป็นต้อง
เปิด Football SEO Adapter บนเว็บที่ไม่ใช่ฟุตบอล ธีม FF90 ไม่ใช่ dependency ของโมดูลใหม่

## หลังบ้านที่ใช้

- Settings → **FF90 Editorial**: เปิด Enforce เมื่อตรวจ workflow พร้อมแล้ว
  Pause มีผลกับ enforced paths; Activation เริ่มที่ advisory ไม่เปลี่ยนข่าวเก่า
- ข่าว → sidebar **Content QA** ใน Gutenberg หรือ meta box ใน Classic:
  ใส่ URL แหล่งอ้างอิงและ Save draft. ข้อมูล sources เป็น edit-context ใน REST
  ไม่ส่งออกกับ public native post response
- ให้อีกบัญชีที่เป็น Editor/Administrator ตรวจข้อเท็จจริง/สิทธิ์ แล้ว Approve saved
  version. ผู้เขียนตรวจอนุมัติตัวเองไม่ได้ การเปลี่ยนข้อมูลทำให้ต้องตรวจใหม่
- Media Library → License/source URL, credit, expiry (site date), human declaration
  ระบบไม่สร้างสิทธิ์การใช้ภาพขึ้นเอง และจะปฏิเสธภาพที่สิทธิ์ยังไม่ครบ/หมดอายุ
- Settings → **FF90 Football Data**: ใส่ `FF90_FOOTBALL_DATA_TOKEN` ใน env/wp-config
  (ไม่ใช่ Repo/ช่องข่าว), เลือก competition แล้วเปิด provider เมื่อพร้อม
- วาง `[ff90_fixtures competition="PL"]`, `[ff90_results competition="PL"]`,
  `[ff90_standings competition="PL"]` ในเว็บใดก็ได้; fixtures/results ระบุ `date="YYYY-MM-DD"`
  ได้ Standings เป็น current table เท่านั้น ถ้าไม่มี provider จะแจ้งว่ายังไม่เชื่อม
- `[ff90_featured_banner post_id="123" kind="preview"]` ใช้ Featured Image จริง
  ของ public post ไม่ดึง draft/password post. ถ้าไม่ระบุ kind ใช้ meta/category fallback
- Settings → **FF90 Automation**: worker ปิดอยู่. เปิดเฉพาะเมื่อ cron และตัวเชื่อม
  พร้อม Inbox ใช้ WordPress Application Password ผ่าน HTTPS ไม่มี anonymous write
- Settings → **FF90 Operations**: ดู health; ตั้ง `FF90_BACKUP_DIR` เป็น private path
  นอกทุก webroot ก่อน export เนื้อหา WXR. ไม่ fallback ไป uploads สาธารณะ

## ค่าที่รอเชื่อมภายหลัง

- Google: OAuth client/secret + consent + property ตามเอกสาร SEO/GSC เดิม
- Football: API token/plan ของ football-data.org; ต้องตรวจ access จริงก่อนเปิด
- n8n/Hermes: WP URL + App Password, handler และ cron จริง; ดู N8N_HANDOFF_TH.md
- Images: candidate feed ที่ยืนยันสิทธิ์แล้ว ส่ง attachment IDs ให้ selector
- Monitoring/Full backup: host/storage/backup provider และพื้นที่ staging สำหรับ restore

ไม่ต้องส่งค่าลับในแชท เก็บผ่าน server configuration/credential manager ของระบบจริง

## หมายเหตุ

Security เป็น baseline ไม่ใช่ external V4 ครบชุด ภาพคล้ายเป็น heuristic;
WXR มีข่าว/metadata/author metadata/attachment URLs แต่ไม่มีไฟล์ภาพจริงหรือ full
account/options/config tables. ไม่มี restore engine ในแพ็กเกจนี้ การ verify checksum
ไม่ใช่การทดสอบกู้คืน. อ่าน STATUS_TH.md ก่อนระบุว่าโมดูลใดพร้อมใช้งานจริงแล้ว


## อัปเดต API-Football — 18 ตุลาคม 2026

Football Data Engine 0.2.0 และ Widgets 0.1.1 เพิ่ม API-Football บน local แล้ว ยืนยัน Free active 100/day, fixtures วันนี้ 5 ลีก และพบว่า standings PL ปี 2026 ถูกปฏิเสธ (2024 ใช้ได้) สถานะเก่า NOT_RUN ของ API-Football ในเอกสารนี้ถูกแทนเฉพาะส่วนที่ตรวจจริงข้างต้น ดู [แผน Free และผลเชื่อมจริง](API_FOOTBALL_FREE_PLAN_TH.md) ส่วน Google/Hermes/Production และฟีเจอร์อื่นยังคงสถานะเดิม
