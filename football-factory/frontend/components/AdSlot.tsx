export function AdSlot({ label = 'พื้นที่โฆษณา / Sponsor' }: { label?: string }) {
  return (
    <aside className="adSlot" aria-label={label}>
      <span>AD</span>
      <strong>{label}</strong>
      <small>เตรียมไว้สำหรับ AdSense / Direct Banner โดยไม่ทำให้ layout กระโดด</small>
    </aside>
  );
}
