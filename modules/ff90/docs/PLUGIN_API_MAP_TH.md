# FF90 — แผนที่ปลั๊กอิน/API 15 ตัว

20 ตุลาคม 2026 — ติดตั้งบน local เท่านั้น

| ปลั๊กอิน / รุ่น | เจ้าของหน้าที่ | การเชื่อม API ตอนนี้ |
|---|---|---|
| football-factory-core 0.1.0 | CPT/REST/schema และโครงข้อมูลเดิม | REST ภายใน; ไม่ใช่ตัวดึง provider หลักในธีมปัจจุบัน |
| ff90-seo 0.2.0 | วิเคราะห์, canonical/schema/robots/sitemaps ตาม ownership mode | PHP ภายใน ไม่มี AI API; ยังไม่ใช่ V4 parity ครบทั้งหมด |
| ff90-seo-football 0.1.0 | football entities/taxonomy/internal-link suggestions | Static seed + WP taxonomy ไม่เรียก live football API |
| ff90-seo-gsc 0.1.0 | OAuth/Search Console read-only metrics | โค้ดเตรียมไว้ Google จริงยัง NOT_RUN |
| ff90-security 0.1.0 | login throttle, headers, audit | ไม่เรียก API; security baseline ไม่ใช่ V4 ครบ |
| ff90-content-qa 0.1.0 | sources, snapshot และ independent human fact/rights attestation | ไม่ได้ตรวจข่าวกับ BBC หรือเว็บต้นทางอัตโนมัติ |
| ff90-editorial-approval 0.1.0 | approval fingerprint และ opt-in publish gate | ไม่เรียก API; privileged PHP/SQL ไม่ใช่ขอบเขต sandbox |
| ff90-football-data 0.3.0 | ผู้เรียก provider เพียงชั้นเดียวสำหรับ widgets/theme ปัจจุบัน พร้อม cache/quota | API-Football fixtures/results และ football-data.org standings เชื่อมจริง |
| ff90-football-widgets 0.1.2 | HTML fixtures/results/standings และ shortcodes | อ่าน Engine ไม่ยิง upstream เอง |
| ff90-image-registry 0.1.0 | local image rights/hash/recent use/leases | ไม่มี image search/download API; perceptual matching เป็น heuristic |
| ff90-banner-renderer 0.1.0 | แสดง featured banner 13 kinds จาก attachment จริง | ไม่สร้างภาพ AI; ไม่อัปโหลดหรือค้นภาพแทนผู้ใช้ |
| ff90-news-insights 1.0.0 | aggregate views และ NEW/HOT/BEST | ไม่มี external analytics; full-page cache ต้องเพิ่ม cache-safe counter |
| ff90-automation-bridge 0.1.0 | authenticated inbox, idempotency, leases/retry/recovery | รับ REST จาก n8n/Hermes ในอนาคต; worker OFF และไม่มี bundled publisher |
| ff90-operations 0.1.0 | private health และ WXR content export | ไม่มี full DB/media backup/restore หรือ external monitoring adapter |
| ff90-content-image-automation 0.3.1 | control panel + metadata preflight + banner/card asset selection rules | ไม่ได้เรียก MiniMax/Hermes จริง; queue OFF, auto publish OFF, kill switch ON และ preflight 422 เสมอ |

## ตัวที่เชื่อม API ภายนอกจริง

Football Data Engine เท่านั้นใน flow ที่เปิดอยู่:

- API-Football: fixed HTTPS `v3.football.api-sports.io`, header `x-apisports-key`, server config `API_FOOTBALL_KEY`; /fixtures ใช้ snapshot ร่วมข้ามลีก วันนี้ cache 1h, ข้างเคียง 6h; local cap 80/day UTC จากบัญชีที่ตรวจ Free 100/day
- football-data.org: fixed HTTPS `api.football-data.org/v4/competitions/{code}/standings`, header `X-Auth-Token`, server config `FF90_FOOTBALL_DATA_TOKEN`; 5 ลีก cache 6h, local cap 100/day UTC ซึ่งไม่ใช่ official daily limit ที่อ้างแทน provider
- ธีมและ Widgets ไม่มีคีย์ใน browser ไม่เรียก provider ตามผู้ชมแต่ละคน

GSC ต้อง OAuth client/secret/property ที่ได้รับสิทธิ์ แล้วเก็บ tokens เข้ารหัสใน WP options; ยังไม่เชื่อมจริง ส่วน n8n/Hermes ใช้ WordPress Application Password ผ่าน HTTPS และสิทธิ์ที่เหมาะสมเมื่อพร้อม ปัจจุบันไม่มีการเปิด workflow จริง MiniMax ใน config ใหม่เป็นชื่อเป้าหมาย ไม่ใช่หลักฐานว่ามี authentication หรือเรียกโมเดลแล้ว

## จุดซ้อนทับและสัญญาที่ต้องรวมก่อนเปิด Automation

1. **เมนู Automation:** ZIP เดิมใช้ slug ff90-automation ซ้ำกับ Bridge แก้ตัวใหม่เป็น ff90-content-image-automation แล้ว เมนูเดิม Settings → FF90 Automation และเมนูใหม่ FF90 Content & Image ผ่านทดสอบแยกกัน
2. **QA/approval/preflight:** Preflight ใหม่ตรวจรูปแบบ input, Content QA บันทึก sources/human review, Editorial Approval ตัดสินเวอร์ชันที่อนุมัติ กฎบางส่วนคล้ายกันแต่ยังไม่ได้ต่อเป็น workflow เดียว ห้ามถือว่า preflight สำเร็จจากค่าที่ผู้ส่งอ้างว่า PASS หรือแทน human review
3. **Kill switch:** ของใหม่คุมเฉพาะ flow ที่ปลั๊กอินใหม่ให้บริการ ไม่ใช่ global switch ของ Bridge/WordPress ปัจจุบัน Bridge worker OFF แยกกัน ยังต้องเชื่อม pause/kill contract ก่อน enable workflow จริง การเผยแพร่ด้วยมือใน WordPress ยังขึ้นกับสิทธิ์และ Editorial enforce setting
4. **Image Registry/Banner/new control:** Registry คุม attachment/สิทธิ์ที่คนรับรอง/bytes, Renderer แสดงภาพ, ของใหม่เลือก asset จาก QC metadata แต่ยังไม่ render pixels, upload หรือทำ independent visual/rights QA ต้อง map registry/clean master/hero/card ก่อนใช้จริง
5. **SEO/Core/theme:** Theme ไม่ผลิต SEO ซ้ำ SEO มี advisory/standalone ownership และประสาน Core schema ผล regression ตรวจ canonical/schema แล้ว ยังต้องตั้ง ownership ชัดหากเพิ่ม SEO plugin อื่น
6. **Core กับ Engine:** CPT/REST เดิมไม่ใช่ cache/provider reader ของ widget ใหม่ อย่าเปิด publisher/sync อีกทางให้ยิง API ซ้ำโดยไม่มี shared quota รวมผู้ใช้คีย์เดียวกันทุก worker/เว็บ
7. **40 ข่าว/วัน:** เป็น daily_target ในแผงใหม่ ยังไม่มี scheduler/quota ข่าวที่ทำงานจริง และไม่ใช่โควตา API ฟุตบอล

## ข่าว 24 Draft

ปลั๊กอินใหม่ไม่ได้เขียนข่าวซ้ำ ไม่ได้ย่อ/แก้เนื้อหา ไม่หาภาพหรือรับรอง fact-check ที่แพ็กอ้าง การตรวจครั้งนี้ยืนยัน 24 Draft เดิมและเนื้อหาไม่เปลี่ยน ยังไม่มี Featured Image และยังต้องตรวจข้อเท็จจริง/ความตรงของพาดหัว/ค่า hash ที่ส่งมา
