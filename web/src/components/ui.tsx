import type { ReactNode } from "react";
import { soGon, delta, capHang } from "../lib/format";

// ---------- Sparkline SVG (nhẹ, không dùng canvas) ----------
export function Sparkline({ data, w = 88, h = 26, color = "#3FB6A8" }: { data: number[]; w?: number; h?: number; color?: string }) {
  const pts = data.filter((v) => v != null);
  if (pts.length < 2) return <span className="spark-empty">—</span>;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const rng = max - min || 1;
  const path = pts
    .map((v, i) => {
      const x = (i / (pts.length - 1)) * (w - 2) + 1;
      const y = h - 2 - ((v - min) / rng) * (h - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="spark" aria-hidden="true">
      <polyline points={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ---------- Phân hạng A/B/C/D ----------
export function HangBadge({ d }: { d: number | null | undefined }) {
  const h = capHang(d);
  const cls = h === "A" ? "ha" : h === "B" ? "hb" : h === "C" ? "hc" : h === "D" ? "hd" : "hn";
  return <span className={`hang ${cls}`} title={d == null ? "chưa chấm" : `${d} điểm`}>{h}</span>;
}

// ---------- Icon SVG stroke (không emoji) ----------
export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const p = ICONS[name];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {p}
    </svg>
  );
}
type IconName = keyof typeof ICONS;
const ICONS = {
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  video: <><rect x="2" y="5" width="14" height="14" rx="2" /><path d="m22 8-6 4 6 4V8z" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>,
  link: <><path d="M9 17H7A5 5 0 0 1 7 7h2" /><path d="M15 7h2a5 5 0 0 1 0 10h-2" /><path d="M8 12h8" /></>,
  bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>,
  chart: <><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></>,
  back: <><path d="m15 18-6-6 6-6" /></>,
  refresh: <><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /></>,
  doc: <><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" /><path d="M9 13h6" /><path d="M9 17h4" /></>,
  bulb: <><path d="M9 18h6" /><path d="M10 22h4" /><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.4 1 2.3h6c0-.9.4-1.8 1-2.3A7 7 0 0 0 12 2z" /></>,
  x: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>,
};

// Sao ghim kênh: đặc khi đang ghim (fill riêng nên không dùng Icon stroke chung).
export function PinStar({ on, size = 15 }: { on: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={on ? "currentColor" : "none"}
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 2.5 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.3l-5.8 3.1 1.1-6.5L2.6 9.3l6.5-.9L12 2.5z" />
    </svg>
  );
}

// Khối shimmer cho trạng thái tải (thay chấm nhấp nháy đơn điệu).
export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="skel-wrap" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skel" style={{ width: `${100 - i * 12}%` }} />
      ))}
    </div>
  );
}

// ---------- Trạng thái rỗng ----------
export function EmptyState({ icon = "chart", title, hint }: { icon?: IconName; title: string; hint?: string }) {
  return (
    <div className="empty">
      <div className="empty-ic"><Icon name={icon} size={26} /></div>
      <div className="empty-title">{title}</div>
      {hint && <div className="empty-hint">{hint}</div>}
    </div>
  );
}

export function Loading({ label = "Đang tải dữ liệu…" }: { label?: string }) {
  return (
    <div className="loading">
      <Skeleton rows={4} />
      <span className="loading-t"><span className="dot" /> {label}</span>
    </div>
  );
}

// ---------- Thẻ KPI ----------
export function KpiCard({
  icon, label, value, sub, tone = "teal",
}: { icon: IconName; label: string; value: ReactNode; sub?: ReactNode; tone?: "gold" | "teal" }) {
  return (
    <div className="kpi">
      <div className={`kpi-ic ${tone}`}><Icon name={icon} size={18} /></div>
      <div className="kpi-body">
        <div className="kpi-label">{label}</div>
        <div className="kpi-value">{value}</div>
        {sub != null && <div className="kpi-sub">{sub}</div>}
      </div>
    </div>
  );
}

// Δ có màu (xanh tăng / đỏ giảm) — dùng teal/gold, không tím.
export function DeltaText({ n, suffix = "" }: { n: number | null | undefined; suffix?: string }) {
  if (n == null || n === 0) return <span className="d-flat">±0{suffix}</span>;
  return <span className={n > 0 ? "d-up" : "d-down"}>{delta(n)}{suffix}</span>;
}

// ---------- Khung mục ----------
export function SectionCard({ title, icon, right, children }: { title: string; icon?: IconName; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="card">
      <div className="card-head">
        <h2>{icon && <Icon name={icon} size={16} />}{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

// ---------- Cảnh báo ----------
export function MucDoBadge({ mucDo }: { mucDo: string }) {
  const map: Record<string, { cls: string; txt: string }> = {
    KHAN: { cls: "khan", txt: "Khẩn" },
    CHU_Y: { cls: "chuy", txt: "Chú ý" },
    THONG_TIN: { cls: "info", txt: "Thông tin" },
  };
  const m = map[mucDo] ?? { cls: "info", txt: mucDo };
  return <span className={`badge ${m.cls}`}>{m.txt}</span>;
}

export function TrangThaiKenh({ tt }: { tt: string }) {
  const map: Record<string, { cls: string; txt: string }> = {
    HOAT_DONG: { cls: "ok", txt: "Hoạt động" },
    CHUA_KET_NOI: { cls: "mut", txt: "Chưa kết nối" },
    TOKEN_LOI: { cls: "khan", txt: "Lỗi token" },
    TAM_NGUNG: { cls: "mut", txt: "Tạm ngưng" },
  };
  const m = map[tt] ?? { cls: "mut", txt: tt };
  return <span className={`pill ${m.cls}`}>{m.txt}</span>;
}

export { soGon };
