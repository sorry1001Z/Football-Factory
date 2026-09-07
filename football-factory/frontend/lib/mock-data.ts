import type { MatchItem, NewsItem } from './types';

export const mockNews: NewsItem[] = [
  { slug:'man-utd-comeback', title:'แมนยูคืนฟอร์มโหด! เปิดรังถล่มคู่แข่ง 3-0', excerpt:'ฟอร์มเกมรุกกลับมาลื่นไหล พร้อมประเด็นสำคัญหลังเกมที่แฟนบอลต้องรู้', category:'พรีเมียร์ลีก', publishedAt:'7 ก.ย. 2026' },
  { slug:'city-title-focus', title:'เรายังหัวแชมป์และจะทำงานหนักต่อไป', excerpt:'เจาะทิศทางของทีมลุ้นแชมป์หลังผ่านช่วงโปรแกรมหนัก', category:'พรีเมียร์ลีก', publishedAt:'7 ก.ย. 2026' },
  { slug:'coach-five-points', title:'สถิติ: 5 จุดที่ทีมใหญ่ต้องรีบปรับก่อนโปรแกรมถัดไป', excerpt:'วิเคราะห์ตัวเลขและภาพรวมแท็กติกจากเกมล่าสุด', category:'พรีเมียร์ลีก', publishedAt:'7 ก.ย. 2026' },
  { slug:'thai-europe-watch', title:'เปิดสถิติแข้งไทยในลีกยุโรป ซีซั่น 2026/27 ใครผลงานเด่นสุด?', excerpt:'สรุปนาทีลงเล่น ผลงาน และบทบาทของนักเตะไทยในยุโรป', category:'ทีมชาติไทย', publishedAt:'7 ก.ย. 2026' },
  { slug:'salah-liverpool-future', title:'ซาลาห์ ยืนยัน ต้องการอยู่ลิเวอร์พูลต่อ', excerpt:'อัปเดตสถานการณ์ล่าสุดและสิ่งที่ต้องจับตาในสัญญาฉบับใหม่', category:'พรีเมียร์ลีก', publishedAt:'6 ก.ย. 2026' },
  { slug:'madrid-form', title:'อันเชล็อตติ ยืนยัน เรอัล มาดริด ยังมุ่งมั่นเต็มร้อย', excerpt:'ความพร้อมของราชันชุดขาวก่อนเกมสำคัญ', category:'ลาลีกา', publishedAt:'6 ก.ย. 2026' },
  { slug:'messi-free-kick', title:'เมสซี ทำอีกแล้ว! ยิงฟรีคิกสุดสวยพาทีมคว้าชัย', excerpt:'ประตูสุดสวยและตัวเลขสำคัญจากเกมล่าสุด', category:'เมเจอร์ลีก', publishedAt:'6 ก.ย. 2026' },
  { slug:'transfer-roundup', title:'อัปเดตตลาดนักเตะ: สรุปดีลล่าสุดและข่าวลือสำคัญ', excerpt:'รวบรวมความเคลื่อนไหวของสโมสรชั้นนำจากหลายลีก', category:'ตลาดนักเตะ', publishedAt:'6 ก.ย. 2026' },
  { slug:'chelsea-clean-sheet', title:'เชลซี ยังไร้ชัย! เสมอคู่แข่งแบบไร้สกอร์', excerpt:'จุดที่ต้องแก้ของเชลซีหลังเกมที่โอกาสมากแต่จบไม่ลง', category:'พรีเมียร์ลีก', publishedAt:'5 ก.ย. 2026' },
  { slug:'young-star-week', title:'ดาวรุ่งที่น่าจับตามองประจำสัปดาห์', excerpt:'5 ผู้เล่นอายุน้อยที่ผลงานโดดเด่นและมีโอกาสขึ้นทีมชุดใหญ่', category:'วิเคราะห์', publishedAt:'5 ก.ย. 2026' },
  { slug:'arsenal-pressing-analysis', title:'เจาะแท็กติกอาร์เซนอล: ทำไมการเพรสแดนบนถึงอันตรายขึ้น', excerpt:'อธิบายระบบเพรสและการเคลื่อนที่แบบอ่านง่าย', category:'พรีเมียร์ลีก', publishedAt:'5 ก.ย. 2026' },
  { slug:'laliga-midfield-trend', title:'ลาลีกายุคใหม่: กองกลางแบบไหนกำลังครองเกม', excerpt:'แนวโน้มแท็กติกที่เห็นชัดจากทีมชั้นนำในสเปน', category:'ลาลีกา', publishedAt:'5 ก.ย. 2026' },
  { slug:'bundesliga-transition', title:'บุนเดสลีกาเล่นเร็วขึ้นแค่ไหน? ดูจากเกมเปลี่ยนรับเป็นรุก', excerpt:'เทียบตัวเลขและรูปแบบการสวนกลับของทีมชั้นนำ', category:'บุนเดสลีกา', publishedAt:'4 ก.ย. 2026' },
  { slug:'seriea-defensive-shape', title:'เซเรีย อา กับศิลปะเกมรับที่เปลี่ยนไป', excerpt:'ทีมอิตาลีกำลังปรับโครงสร้างเกมรับให้เหมาะกับฟุตบอลสมัยใหม่', category:'เซเรีย อา', publishedAt:'4 ก.ย. 2026' },
  { slug:'ucl-big-match-preview', title:'แชมเปียนส์ลีก: 5 คู่ใหญ่ที่ห้ามพลาดสัปดาห์นี้', excerpt:'พรีวิวจุดแข็ง จุดอ่อน และคีย์แมนของแต่ละคู่', category:'ยูฟ่า แชมเปียนส์ลีก', publishedAt:'4 ก.ย. 2026' },
  { slug:'premier-league-xg', title:'พรีเมียร์ลีกกับค่า xG: ทีมไหนสร้างโอกาสดีที่สุด', excerpt:'อ่านสถิติอย่างง่ายและดูว่าตัวเลขบอกอะไรเกี่ยวกับฟอร์มจริง', category:'พรีเมียร์ลีก', publishedAt:'4 ก.ย. 2026' },
  { slug:'la-liga-high-line', title:'ทำไมหลายทีมลาลีกากล้าเล่นไลน์สูงกว่าเดิม', excerpt:'วิเคราะห์พื้นที่ระหว่างไลน์และความเสี่ยงในการดันเกม', category:'ลาลีกา', publishedAt:'3 ก.ย. 2026' },
  { slug:'bundesliga-young-coaches', title:'โค้ชรุ่นใหม่ในบุนเดสลีกากำลังเปลี่ยนเกมอย่างไร', excerpt:'แนวคิดใหม่ที่ส่งผลต่อเพรสซิ่งและการสร้างเกม', category:'บุนเดสลีกา', publishedAt:'3 ก.ย. 2026' },
  { slug:'seriea-wingbacks', title:'วิงแบ็กกลับมาเด่นอีกครั้งในเซเรีย อา', excerpt:'บทบาทริมเส้นที่เปลี่ยนไปและเหตุผลที่หลายทีมเลือกใช้', category:'เซเรีย อา', publishedAt:'3 ก.ย. 2026' },
  { slug:'ucl-set-pieces', title:'ลูกตั้งเตะกำลังตัดสินเกมยุโรปมากขึ้นหรือไม่', excerpt:'ดูแนวโน้มและรูปแบบเซ็ตพีซของทีมระดับแชมเปียนส์ลีก', category:'ยูฟ่า แชมเปียนส์ลีก', publishedAt:'3 ก.ย. 2026' },
];

export const mockMatches: MatchItem[] = [
  { slug:'man-utd-v-everton', league:'พรีเมียร์ลีก', home:'แมนฯ ยูไนเต็ด', away:'เอฟเวอร์ตัน', status:'live', homeScore:2, awayScore:0, kickoff:"LIVE 78'" },
  { slug:'arsenal-v-tottenham', league:'พรีเมียร์ลีก', home:'อาร์เซนอล', away:'สเปอร์ส', status:'live', homeScore:1, awayScore:1, kickoff:'HT' },
  { slug:'chelsea-v-liverpool', league:'พรีเมียร์ลีก', home:'เชลซี', away:'ลิเวอร์พูล', status:'live', homeScore:0, awayScore:0, kickoff:"LIVE 32'" },
  { slug:'man-city-v-west-ham', league:'พรีเมียร์ลีก', home:'แมนฯ ซิตี้', away:'เวสต์แฮม', status:'finished', homeScore:3, awayScore:1, kickoff:'FT' },
];
