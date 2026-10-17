# Integration contract สำหรับ n8n/Hermes — ยังไม่เปิด workflow จริง

ใช้ WordPress native Application Password ของ service account ผ่าน HTTPS
เก็บค่าใน n8n credential store. ห้ามใส่ค่าใน workflow JSON หรือ Repo
โมดูลนี้ไม่เปลี่ยน workflow ที่มีอยู่และไม่เรียก n8n API ระหว่างติดตั้ง

## Inbox

`POST /wp-json/ff90-automation/v1/jobs` (authenticated)

```json
{
  "key": "editorial-run-unique-id-at-least-8-chars",
  "task": "content_qa",
  "payload": { "post_id": 123 }
}
```

123 เป็นตัวอย่าง ต้องใช้ ID ข่าว draft จริงที่ service account มีสิทธิ์ edit
Key เดิมกับ task/payload เดิมคืน job เดิม; เปลี่ยน payload ภายใต้ key เดิมตอบ 409
อ่าน state ด้วย `GET /wp-json/ff90-automation/v1/jobs/{id}` ด้วย owner หรือ admin

- `content_qa`: อ่าน QA แล้วหยุด `waiting_review`; ไม่อนุมัติหรือ publish แทนคน
- `football_sync`: admin เท่านั้น, payload `competition` และ `date`;
  ถ้า API ไม่พร้อมจะแสดง blocked/error ตามจริง ไม่มี scores สมมติ
- `handoff`: blocked จนกว่าจะลง delivery adapter ที่ได้รับอนุญาต

## Worker / recovery

เริ่มต้นปิด สามารถเปิด five-minute WP cron ใน Settings → FF90 Automation
ต้องตั้ง server cron runner จริงเมื่อ DISABLE_WP_CRON=true หรือเว็บไม่มี traffic
มี lease 120 วินาที/worker token และ conditional commit, max 3 attempts,
retry เฉพาะ transient errors, backoff และ recover lease หมดอายุ

สัญญาไม่ใช่ exactly-once ของ external side effects. Handlers ที่เชื่อมภายหลังต้อง
ทำ idempotency ของตนเอง งาน auth/validation/approval/rights ต้องไม่ถูก retry ข้าม gate

Hook `ff90_automation_handlers` ใช้เพิ่ม trusted PHP callable สำหรับ task ที่รองรับ
โค้ด bundled ไม่ publish ข่าว. Publishing adapter ของ Hermes ต้องเรียก
`ff90_editorial_publish($post_id)` หลัง independent QA/approval ฉบับล่าสุด
อย่าใช้ direct wp_publish_post/SQL แล้วอ้างว่าผ่าน approval gate แล้ว

## จุดส่งต่ออื่น

- Sources: native `POST /wp-json/wp/v2/posts/{id}` → meta `_ff90_qa_sources`
  เฉพาะผู้มีสิทธิ์ edit; human QA/review records ไม่เปิดให้ REST เขียนแทนคน
- Featured Image: native `featured_media`; banner kind: meta `_ff90_banner_kind`
- Candidate images: trusted server call `ff90_image_select($attachment_ids,$post_id)`
  แล้ว `ff90_image_reserve(...)`; ไม่เลือกภาพจากเว็บภายนอกที่ยังไม่มีสิทธิ์
- Monitoring: admin-only `GET /wp-json/ff90-operations/v1/health`
- Audit: admin-only `GET /wp-json/ff90-security/v1/audit`

Live n8n/Hermes delivery, scheduler, credential checks และ publish/rollback E2E
ต้องทดสอบกับ staging ที่ได้รับอนุญาตภายหลัง ผล local mock ไม่ใช่หลักฐานเหล่านี้
