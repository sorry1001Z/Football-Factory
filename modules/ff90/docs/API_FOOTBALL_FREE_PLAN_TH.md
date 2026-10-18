# API-Football Free — แผนใช้งานรายเดือน FF90

ตรวจบัญชีจริงผ่าน API เมื่อ 18 ตุลาคม 2026 (Asia/Bangkok) โดยไม่แสดงคีย์ ไม่สมัครหรืออัปเกรดบริการเสียเงิน Source และ ZIP ไม่มีคีย์ คีย์ของ local อยู่ใน private directory นอก webroot/repository

## เงื่อนไขที่ยืนยันได้

- `/status`: plan `Free`, active `true`, limit_day `100` เป็นโควตาต่อวัน ไม่ใช่ยอดรวมที่ยกสะสมไปวันอื่น
- `/leagues?id=39`: metadata ระบุฤดูกาลปัจจุบันเริ่มปี 2026 แต่การปรากฏใน metadata ไม่ได้หมายความว่าแพ็กเกจเข้าถึงข้อมูลฤดูกาลนั้นได้
- `/fixtures?date=...&timezone=Asia/Bangkok`: ดึงข้อมูลวันนี้จริงสำเร็จ ใช้ snapshot เดียวแสดง PL 4, PD 4, BL1 2, SA 4, FL1 6 คู่ ณ เวลาตรวจ จำนวนเป็นภาพขณะทดสอบ ไม่ใช่ค่าที่ hardcode ในเว็บ
- `/standings?league=39&season=2026`: API ส่ง HTTP 200 พร้อม error `Free plans do not have access to this season, try from 2022 to 2024.` ถือเป็น failure ไม่ใช่ตารางว่างสำเร็จ
- `/standings?league=39&season=2024`: สำเร็จ 20 ทีม ใช้ตรวจสิทธิ์เท่านั้น ไม่แทนตารางฤดูกาลปัจจุบันโดยอัตโนมัติ
- หน้า https://www.api-football.com/pricing ตอบ 403 จากสภาพแวดล้อมนี้ จึงยังไม่ยืนยันรายละเอียดทั้งหมดในหน้า Pricing เช่นเงื่อนไขนาที/ลีก/ลิขสิทธิ์การเผยแพร่จากหน้านั้น ใช้ผลบัญชี/API จริงข้างต้นเป็นหลักฐานเฉพาะสิ่งที่ตรวจได้

## การจัดโควตาครบเดือน

| งาน | รอบ Cache | ประมาณการสูงสุดตามรอบปกติ/วัน |
|---|---|---:|
| fixtures วันนี้รวมทุกลีก | 1 ชั่วโมง | 24 |
| fixtures เมื่อวาน/พรุ่งนี้ หากมีคนเรียก | 6 ชั่วโมงต่อวันเป้าหมาย | 8 |
| standings 5 ลีก หากแพ็กเกจรองรับ | 6 ชั่วโมงต่อลีก | 20 |
| status ตรวจ Free/active/limit | 24 ชั่วโมง | 1 |
| รวมกรณีรองรับ standings | | 53 |

ปัจจุบัน standings 2026 ถูกปฏิเสธ จึง negative-cache entitlement 24 ชั่วโมง ไม่ยิงซ้ำทุกชั่วโมง งาน cron ปกติประมาณ 30 ครั้ง/วัน (24+5+1) หรือประมาณ 900–930 ครั้งใน 30–31 วัน หากมีการเรียกเมื่อวาน/พรุ่งนี้จะเพิ่มได้อีกราว 8 ครั้ง/วัน การตรวจ metadata/manual/retry อาจเพิ่มยอด จึงใช้เพดาน hard cap เป็นตัวคุมจริง ไม่รับประกันยอดประมาณการ

- เพดาน local แบบ atomic: **80 attempts ต่อวัน UTC** รวม status/metadata/fixture/standings/retry ที่ผ่าน adapter สูงสุด 2,400 ครั้ง/30 วัน หรือ 2,480 ครั้ง/31 วัน แต่ห้ามใช้เกิน 80 ในวันใดวันหนึ่ง
- กันส่วนต่างจากโควตา Free 100 ไว้อย่างน้อย 20 ครั้ง/วัน ภายใน 80 ยังเหลือจากรอบปกติ 53 อีก 27 ครั้งสำหรับงานตรวจและ retry
- ทุกหน้าและทุกลีกใช้ Cache กลาง ไม่ดึง API ตามจำนวนผู้ชม ไม่มี client-side key
- จำกัดหน้าสาธารณะให้เรียกเมื่อวาน/วันนี้/พรุ่งนี้ ป้องกันการไล่วันที่จนโควตาหมด
- 429 backoff 5 นาที, network/error negative cache 15 นาที, entitlement negative cache 24 ชั่วโมง; มี last-good stale label เมื่อดึงใหม่ไม่สำเร็จ
- หาก provider ส่ง remaining=0 จะพักจนรอบวัน UTC ถัดไป แม้ local counter ยังไม่ถึง 80 รอบรีเซ็ตจริงและยอดที่ใช้นอก WordPress ต้องตรวจ Dashboard ของผู้ให้บริการด้วย
- หากใช้คีย์เดียวในเว็บ/โปรแกรมอื่น local counter จะมองไม่เห็นยอดนั้น อย่าแบ่งคีย์ให้ worker อื่นโดยไม่มี shared budget
- ไม่ทำ automatic paid upgrade หากแพ็กเกจไม่ใช่ Free หรือ inactive scheduled worker จะหยุด

## สภาพแวดล้อม local ปัจจุบัน

WordPress ใช้ Football Data Engine **0.2.0**, Widgets **0.1.1**, provider `api-football`, season `2026`, auto_refresh เปิด (ไม่เปิด Content Automation)

Native hourly hook คือ `ff90_af_refresh`; local runner `/workspace/ff90-tools/run-football-refresh.sh` ตรวจเฉพาะ hook นี้ทุก 60 วินาที เพราะ sandbox ปิด auto WP-Cron อยู่ ไม่รันงานเผยแพร่หรือ cron อื่น มีการทดสอบรัน hook จริงแล้ว บันทึกสถานะที่ `/workspace/ff90-tools/football-refresh.log` โดยไม่มีคีย์

**การวางแผนครบเดือนไม่ใช่หลักฐานว่ารันต่อเนื่องครบเดือนแล้ว** เครื่อง cloud/local ต้องเปิดและ runner ต้องทำงาน หาก environment ถูกพัก/รีสตาร์ตต้องเริ่ม runner ใหม่ ไม่ได้ตั้งบริการ 24/7 ที่มีค่าใช้จ่าย

หน้า local `ff90-football-api-local` แสดงข้อมูลจริง 5 ลีกพร้อม source/fetched time และแจ้ง standings ปัจจุบันไม่รองรับใน Free ยังไม่รับรองว่าบอลถ้วยครบ 13 รายการหรือทุกฟีเจอร์ใน Pricing ผ่านทดสอบแล้ว

## QA

ผ่าน 26 assertions ใน HTTP-doubled contract suite ที่ `wordpress-plugins/ff90-football-data/tests/api-football.php`: ปิด provider ไม่ยิง, shared cache ข้ามลีก, canonical status/null scores, nested standings, season label, private auth/fixed TLS host, invalid query/date, plan errors แม้ HTTP 200, stale/error cache, pagination rejection, retry backoff, atomic quota และ scheduler Free-only

Regression suite 84 ข้อเดิมและ browser 13 ข้อผ่านก่อนผูกคีย์จริงไว้ใน local เพิ่ม live-data browser ที่ 360/390/768/1024/1440px และเก็บผลใน `qa/api-football-browser.json` ไม่พบบัคที่ตรวจพบในขอบเขตนี้

ชุดทดสอบปฏิเสธ real key โดยค่าเริ่มต้น การทดสอบใน sandbox นี้ใช้ `FF90_SANDBOX_NO_SECRETS=1` เฉพาะ WP-CLI เพื่อไม่โหลดคีย์จริง แล้วใช้ synthetic token และ HTTP doubles ห้ามใช้ flags หรือชุดทดสอบนี้กับ production

## ส่วนที่ยังติด

ตารางคะแนนฤดูกาลปัจจุบันของพรีเมียร์ลีก: BLOCKED_BY_FREE_PLAN ไม่ใช้ตารางปีเก่าปลอมเป็นปัจจุบัน ส่วนลีกอื่นยังไม่ได้ยืนยัน standings entitlement จริงครบทุกลีก ตัวเลือกที่มีค่าใช้จ่ายต้องให้ผู้ใช้อนุมัติก่อนเสมอ Google และ Content Automation ไม่อยู่ในงานรอบนี้
