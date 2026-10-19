# football-data.org — เชื่อมตารางคะแนนจริงสำเร็จ

อัปเดต 19 ตุลาคม 2026 (Asia/Bangkok)

## ผลล่าสุด

WordPress local ใช้ API-Football สำหรับตารางแข่ง/ผล และ football-data.org สำหรับตารางคะแนน แยกคีย์และโควตาอย่างชัดเจน ไม่ได้สมัครหรืออัปเกรดบริการเสียเงิน ไม่เปิด Content Automation และไม่แตะ Production

| ลีก | Code | ฤดูกาลที่ API คืน | จำนวนทีม | ผลจริง |
|---|---|---|---:|---|
| พรีเมียร์ลีก | PL | 2026/2027 | 20 | HTTP 200 |
| ลาลีกา | PD | 2026/2027 | 20 | HTTP 200 |
| บุนเดสลีกา | BL1 | 2026/2027 | 18 | HTTP 200 |
| เซเรีย อา | SA | 2026/2027 | 20 | HTTP 200 |
| ลีกเอิง | FL1 | 2026/2027 | 18 | HTTP 200 |

ข้อมูลจริงทั้งหมดไม่ใช่ HTTP doubles และไม่ใช่ตารางปี 2024 หลักฐานอยู่ใน `qa/football-data-live.json` ระบุ source, season, fetched_at และ header rate limit โดยไม่มีคีย์หรือข้อมูลบัญชีส่วนตัว

## ปัญหา CONNECT 403 ที่แก้ผ่านแล้ว

ก่อนหน้านี้ proxy ปฏิเสธการเปิด CONNECT tunnel ไป api.football-data.org ก่อนคำขอถึง API จึงใช้ผลนั้นตัดสินว่าคีย์ผิดไม่ได้ ได้เพิ่ม hostname ที่จำเป็นใน Network draft โดยคงโดเมนอื่นไว้ และตั้ง WordPress accessible hosts/proxy ให้ใช้เส้นทางของคลาวด์ คีย์เดิมถูกเก็บใน private directory นอก webroot/repository permission 0600

การทดสอบรอบล่าสุดผ่าน proxy ได้ HTTP 200 ทั้ง 5 ลีกด้วยคีย์เดิม ยืนยันว่า **ตัวบล็อก CONNECT หายไปและคีย์ใช้งานได้แล้ว** ไม่ทราบเวลาแน่ชัดที่ policy runtime มีผลจากภายในเครื่อง จึงไม่อ้างว่าการบันทึกร่างเพียงอย่างเดียวเปลี่ยน runtime ทันที ตอนนี้ไม่ต้องส่งคีย์ซ้ำ และไม่ต้องรอ Publish เพื่อใช้งานการเชื่อมต่อที่ตรวจผ่านแล้ว แต่การเก็บ configuration ให้ task อนาคตยังต้องทำตามขั้นตอน Save/Publish ของแพลตฟอร์ม

## ขอบเขตใช้งานจริง

- ตารางคะแนน 5 ลีก: อันดับ, ทีม, แข่ง, ชนะ, เสมอ, แพ้, ประตูได้/เสีย, ผลต่าง, คะแนน พร้อมฤดูกาลจาก response
- ตารางแข่ง/ผลจาก API-Football: หน้าสาธารณะรองรับเมื่อวาน/วันนี้/พรุ่งนี้ แชร์ snapshot เดียวข้ามลีก ไม่ใช่ปฏิทินแข่งล่วงหน้าทั้งเดือน
- ตารางแข่ง/ผล Cache 1 ชั่วโมงสำหรับวันนี้ และ 6 ชั่วโมงสำหรับเมื่อวาน/พรุ่งนี้ ตารางคะแนน Cache 6 ชั่วโมง ไม่ใช่บริการบอลสดแบบวินาทีต่อวินาที
- fetched_at คือเวลาที่เว็บดึงข้อมูล ไม่ใช่การรับรองเวลาที่ผู้ให้บริการอัปเดตการแข่งขัน ไม่มี SLA ของความสดจากต้นทางที่ทดสอบแล้ว
- หากแหล่งข้อมูลขัดข้องใช้ last-good ที่ติดป้าย stale หรือแสดง error ไม่ประดิษฐ์คะแนนและไม่สลับไปฤดูกาลเก่า
- บอลถ้วย 13 เมนู/league อื่น, player stats, odds, events และการครอบคลุมทั้ง API ยังไม่ทดสอบครบ ห้ามอ้างว่า Free ใช้ได้ทุกฟีเจอร์

## แผน 30–31 วัน

| Provider / งาน | ประมาณต่อวัน | 30 วัน | 31 วัน | เพดาน local/วัน UTC |
|---|---:|---:|---:|---:|
| football-data.org: 5 standings ทุก 6 ชม. | 20–25 | 600–750 | 620–775 | 100 |
| API-Football: today fixtures + status + optional yesterday/tomorrow | 25–33 | 750–990 | 775–1,023 | 80 |

ตัวเลขเป็นการประมาณตามรอบ Cache ไม่ใช่ยอดที่เกิดแล้วครบเดือน วันที่เปลี่ยนตรงเที่ยงคืนอาจทำให้ standings ต้องสร้าง cache ใหม่จึงเผื่อไว้ 25/day การตรวจ metadata, manual invalidation และ error retry เพิ่มยอดได้ แต่ถูกคุมด้วย quota/lock/backoff และ shared cache

API-Football ยืนยันจาก status จริงก่อนหน้า Free active 100/day จึงตั้ง local 80/day กัน 20 ไว้ วันหนึ่งยืมโควตาของวันอื่นไม่ได้ ส่วน football-data.org คืน headers available-minute 9,8,7,6,5 ระหว่าง 5 คำขอต่อเนื่อง สอดคล้องงบ 10/minute รอบที่ตรวจ การ refresh ชุดละ 5 คำขอทุก 6 ชั่วโมงจึงต่ำกว่ารอบดังกล่าวมาก **100/day เป็นเพดานที่เราตั้งเอง ไม่ใช่ daily quota ที่อ้างว่าผู้ให้บริการกำหนด** หากมีโปรแกรมอื่นใช้คีย์เดียวกันต้องรวมยอดเหล่านั้นด้วย

เพดาน local สูงสุดในเดือน 31 วันคือ FD 3,100 และ API-Football 2,480 แต่การวางรอบปกติใช้ต่ำกว่านั้นมาก จึงมีโควตาเพียงพอสำหรับอัปเดตรายวันตลอดเดือนภายใต้สิทธิ์ที่ตรวจวันนี้ ไม่ได้ยืนยันสิทธิ์/ราคา/ความพร้อมของผู้ให้บริการล่วงหน้าในทุกวันของเดือน

## การรันต่อเนื่อง

Current options: provider=api-football, standings_provider=football-data.org, enabled=true, auto_refresh=true Native hook `ff90_af_refresh` ถูกทดลองรันสำเร็จโดยใช้ cached data แล้ว ไม่มีการดึงซ้ำเมื่อ cache ยังใหม่

ตอนเริ่มตรวจรอบนี้ไม่พบ server 8088 และ dedicated runner ที่ยังทำงานอยู่ จึงเริ่ม PHP server และ `/workspace/ff90-tools/run-football-refresh.sh` ใหม่ ตัว runner ตรวจเฉพาะ hook ฟุตบอลทุก 60 วินาที ไม่แตะ cron ของข่าวหรือ Hermes/n8n

**โควตาครอบคลุมทั้งเดือน แต่ local/cloud ต้องเปิดและมี runner ทำงาน** ยังไม่มีหลักฐานรันต่อเนื่องครบ 30/31 วัน หากเครื่องถูกพัก/รีสตาร์ตต้องเริ่ม server/runner ใหม่ ไม่ได้เปิดบริการ 24/7 ที่มีค่าใช้จ่าย การเก็บ backup ไว้เครื่องเดียวไม่ใช่ offsite backup

## QA

Code unchanged in this connection-verification round: regression evidence from prior implementation is split-provider HTTP doubles 34 assertions, API-Football 26 assertions และ module contracts 84 ข้อ

รอบนี้เพิ่มการยืนยัน 5 league endpoints จริง, เปิด options จริง, รัน native scheduled hook จริง และตรวจหน้าเว็บข้อมูลจริงที่ 360/390/768/1024/1440 px ผล browser อยู่ใน `qa/split-provider-live-browser.json` ภาพอยู่ใน `qa/screenshots/split-provider-real-1440.png` และ `split-provider-real-390.png` ไม่ใช้ผล HTTP mocks แทนผล provider จริง
