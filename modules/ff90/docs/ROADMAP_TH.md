# โมดูลใช้ซ้ำข้ามเว็บไซต์ — current roadmap

สถานะล่าสุดและรายการที่ยังไม่ครบ: **[STATUS_TH.md](STATUS_TH.md)**
การติดตั้งแยก ZIP: **[INSTALL_TH.md](INSTALL_TH.md)**
ผลทดสอบ/ข้อจำกัด: **[QA_REPORT.md](QA_REPORT.md)**
จุดเชื่อม n8n/Hermes: **[N8N_HANDOFF_TH.md](N8N_HANDOFF_TH.md)**

A และ F มี source/distributions เดิมแล้ว รอบนี้เพิ่มเก้าแพ็กเกจสำหรับ
B/C/D/E/G/H/I/J/K โดยแยก theme, SEO, football data, images, human review และ
operations ออกจากกัน L เป็นชุดทดสอบและรายงาน ไม่ต้องทำเป็น runtime plugin

ค่าที่รอเชื่อมภายหลัง: Google OAuth/property, football API key/plan,
licensed image candidates, n8n/Hermes publisher/handler, real cron,
monitoring/backup host/storage และ external staging.

Security V4 เต็มต้องยืนยันสเปก; J ยังเป็น content export ไม่ใช่ full restore;
L ยังไม่ผ่าน external end-to-end. ไม่เปลี่ยนชื่อ baseline ให้ดูเป็นระบบครบชุด
และไม่แก้ Next.js, Core, Hermes automation หรือ Production เพื่อส่งมอบโมดูลใหม่
