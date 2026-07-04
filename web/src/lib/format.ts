// Định dạng số/ngày kiểu VN.
const nfVN = new Intl.NumberFormat("vi-VN");

export function soVN(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return nfVN.format(Math.round(n));
}

export function soGon(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + " tỷ";
  if (a >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "tr";
  if (a >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "N";
  return String(Math.round(n));
}

export function delta(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n) || n === 0) return "±0";
  return (n > 0 ? "+" : "−") + soGon(Math.abs(n));
}

// YYYY-MM-DD -> DD/MM
export function ngayGon(d: string): string {
  const p = d.split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}` : d;
}

// ISO -> YYYY-MM-DD theo giờ VN (dùng cho key ngày, heatmap)
export function ngayISO_VN(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
}

// ISO -> DD/MM/YYYY theo giờ VN (không lệ thuộc múi giờ máy khách)
export function ngayDay(iso: string): string {
  const p = ngayISO_VN(iso).split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
}

// YYYY-MM-DD của N ngày trước (giờ VN).
export function isoNgayTruoc(days: number): string {
  const now = new Date(Date.now() - days * 86400000);
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
}

// Engagement rate: (thích + 2·bình luận + 3·chia sẻ) / xem. Trả % (0–100).
export function tinhER(
  xem: number | null,
  thich: number | null,
  binhluan: number | null,
  chiase: number | null,
): number | null {
  if (!xem || xem <= 0) return null;
  const tuongtac = (thich ?? 0) + 2 * (binhluan ?? 0) + 3 * (chiase ?? 0);
  return (tuongtac / xem) * 100;
}
