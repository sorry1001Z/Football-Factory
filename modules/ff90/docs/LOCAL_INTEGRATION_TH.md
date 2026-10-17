# ตรวจการเชื่อมต่อ Local — 18 ตุลาคม 2026 (Asia/Bangkok)

ติดตั้งและเปิดใช้ปลั๊กอิน FF90 ทั้ง 14 ตัวร่วมกับธีม ff90-independent 1.2.0 บน WordPress 6.9 / PHP 8.4 / SQLite ใน sandbox เท่านั้น ไม่ใช่เว็บ Production

รันทดสอบซ้ำครั้งนี้:
- `wp eval-file modules/ff90/tests/contracts.php`: PASS 84 ข้อ
- `node modules/ff90/tests/browser.cjs`: PASS 13 ข้อ รวม native Gutenberg, Settings API, independent QA/approval, REST publication, nonce rejection, ไม่มี browser exceptions และ responsive/axe ที่ 360/390/768/1024/1440px
- ทดสอบปลั๊กอินกับ Twenty Twenty-Five แล้วคืนธีม FF90 สำเร็จ อัปเดต screenshots ใน docs/qa/screenshots/

ไม่พบบัคใหม่ในขอบเขตชุดทดสอบนี้ จึงไม่มีการแก้ runtime โค้ดในรอบนี้ การทดสอบคืนค่า provider/worker เป็นปิดและ editorial เป็น advisory ตามเดิม

ข้อจำกัด: Football HTTP เป็น test doubles ไม่ใช่ live API; Google, Football API, n8n/Hermes และ cron จริงยัง NOT_RUN ต้องตั้ง credentials/handler ก่อนใช้งานจริง Monitoring ภายนอกและ full DB/media backup/restore ยังไม่ครบ WXR เป็น content export เท่านั้น Security ยังเป็น baseline ไม่ใช่ V4 ครบทั้งหมด ดู STATUS_TH.md และ QA_REPORT.md สำหรับข้อจำกัดรายโมดูล

WordPress.org update checks แจ้งว่าเชื่อมไม่ได้ใน sandbox ที่จำกัด HTTP ภายนอก ไม่ได้ใช้ผลนี้อ้างว่าอัปเดตปลั๊กอิน/ธีมล่าสุดสำเร็จ
