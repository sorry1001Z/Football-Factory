# football-data.org — เตรียมเชื่อมตารางคะแนนแยก

19 ตุลาคม 2026 (Asia/Bangkok)

## สถานะจริง

รับไฟล์คีย์แล้ว เก็บใน private directory นอก webroot/repository ด้วย permission 0600 และโหลดผ่าน local wp-config แบบไม่บันทึกคีย์ลง WordPress options, Source, Git, log หรือ ZIP

การเรียกแบบอ่านอย่างเดียวไป `https://api.football-data.org/v4/competitions/PL/standings` ถูก cloud proxy ปฏิเสธ `CONNECT tunnel failed, response 403` ก่อนถึงผู้ให้บริการ จึงยังไม่ทราบว่าคีย์ถูกต้องหรือมีสิทธิ์แพ็กเกจใด **ห้ามตีความว่าเป็นการปฏิเสธคีย์จาก football-data.org**

เพิ่ม `api.football-data.org` ใน Network draft โดยคงโดเมนเดิมไว้ Tool ยืนยัน saved และ requires_publish=true แต่การบันทึกร่างไม่ใช่การนำไปใช้กับ runtime การขอสิทธิ์ Network เพิ่มไม่ได้คืนสิทธิ์ที่ใช้ได้ในรอบนี้ ต้อง Review/Save/Publish การตั้งค่า Environment ที่อนุญาตโดเมนนี้ แล้วทดสอบอีกครั้ง ไม่ต้องส่งคีย์ซ้ำ

## สิ่งที่ทำแล้ว

- Football Data Engine 0.3.0 และ Widgets 0.1.2 ติดตั้งใน WordPress local
- เพิ่ม Settings → FF90 Football Data → Standings source เลือกแยกจาก Main provider ได้
- เตรียม API-Football สำหรับ fixtures/results และ football-data.org สำหรับ standings ของ PL/PD/BL1/SA/FL1
- ข้อมูลแต่ละแหล่งใช้คีย์ของตัวเองและ cache คนละส่วน ไม่มีการส่งคีย์ข้าม host ไม่ redirect และคง TLS verification
- ตารางคะแนนแยกใช้ Cache 6 ชั่วโมง ตรวจ competition code/season metadata และแสดงฤดูกาลจากต้นทาง ไม่คำนวณคะแนนเองและไม่ใช้ตารางเก่าแทนอัตโนมัติ
- หากแหล่งใหม่ขัดข้องแสดงข้อผิดพลาดหรือ labelled last-good stale data ไม่อ้างว่ามีข้อมูลปัจจุบันเมื่อยังไม่ยืนยัน
- Worker ติดตามตารางคะแนนแยกได้แม้สถานะ API-Football ขัดข้อง โดยไม่เปิด Content Automation

## ค่าที่เปิดอยู่จริง

Main provider = api-football, standings_provider = same, enabled = true, auto_refresh = true คีย์ทั้งสองตัวมีอยู่ใน local แต่ยังไม่สลับ standings ไป football-data.org จนกว่าจะตรวจข้อมูลจริงสำเร็จ

## แผนโควตาหลังยืนยันได้

ตารางคะแนน 5 ลีกทุก 6 ชั่วโมงประมาณ 20 ครั้ง/วัน อาจถึง 25 ครั้งเมื่อ cache แยกตามวันที่เปลี่ยนตรงเที่ยงคืน ใช้ local hard cap ของ football-data.org ไม่เกิน 100 attempts/วัน UTC หรือไม่เกิน 3,100 ใน 31 วัน ค่า cap นี้เป็นการจำกัดของเรา **ไม่ใช่หลักฐานว่าแพ็กเกจผู้ให้บริการอนุญาตเท่านี้** ยังต้องตรวจ rate/minute และ entitlement จริง ห้ามเปิดบริการเสียเงินโดยไม่ได้รับอนุมัติ

API-Football คงเพดานเดิม 80 attempts/วันแยกอีกบัญชี เมื่อใช้ provider แยกแล้วจะไม่เสียโควตา API-Football กับคำขอ standings 2026 ที่แพ็กเกจปฏิเสธ

## QA รอบนี้

- split-provider HTTP doubles: PASS 34 assertions รวม routing, separate credentials, shared caches, wrong competition, missing season, source/year label, stale/negative cache, denied-without-historical-fallback และ independent scheduler
- API-Football regression: PASS 26 assertions
- Module regression: PASS 84 contracts
- PHP lint และ ZIP/source/runtime byte equality ตรวจในขั้นตอนส่งมอบ
- Live football-data.org: BLOCKED_BY_NETWORK; key/plan/5-league current standings ยัง NOT_VERIFIED ไม่มีผลทดสอบจริงที่อ้างว่าผ่านแล้ว

งานนี้ไม่แก้ Hermes/n8n, ไม่แตะ Production และไม่สมัครบริการเสียเงิน
