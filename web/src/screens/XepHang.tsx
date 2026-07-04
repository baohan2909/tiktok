import { useMemo, useState } from "react";
import { useKenhs, useDiemTuan, useSnapshotsKenh } from "../hooks/queries";
import { SectionCard, EmptyState, Loading, HangBadge, Sparkline, Icon } from "../components/ui";
import { soVN, capHang } from "../lib/format";
import type { DiemTuan } from "../lib/types";

export function XepHang({ onChonKenh }: { onChonKenh: (id: number) => void }) {
  const kenhs = useKenhs();
  const diem = useDiemTuan(8);
  const snaps = useSnapshotsKenh(84);

  const [loKhuVuc, setLoKhuVuc] = useState("");
  const [loHang, setLoHang] = useState("");

  // Health Score mới nhất + tuần trước (mỗi kênh)
  const { latest, prev } = useMemo(() => {
    const byKenh = new Map<number, DiemTuan[]>();
    for (const d of diem.data ?? []) {
      const arr = byKenh.get(d.kenh_id) ?? [];
      arr.push(d);
      byKenh.set(d.kenh_id, arr);
    }
    const latest = new Map<number, DiemTuan>();
    const prev = new Map<number, DiemTuan>();
    for (const [id, arr] of byKenh) {
      arr.sort((a, b) => (a.tuan < b.tuan ? 1 : -1)); // mới -> cũ
      latest.set(id, arr[0]);
      if (arr[1]) prev.set(id, arr[1]);
    }
    return { latest, prev };
  }, [diem.data]);

  // follower series 8 tuần (mỗi kênh) cho sparkline
  const folByKenh = useMemo(() => {
    const m = new Map<number, { ngay: string; f: number }[]>();
    for (const s of snaps.data ?? []) {
      if (s.follower == null) continue;
      const arr = m.get(s.kenh_id) ?? [];
      arr.push({ ngay: s.ngay, f: s.follower });
      m.set(s.kenh_id, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => (a.ngay < b.ngay ? -1 : 1));
    return m;
  }, [snaps.data]);

  const khuVucs = useMemo(
    () => [...new Set((kenhs.data ?? []).map((k) => k.khu_vuc).filter(Boolean))] as string[],
    [kenhs.data],
  );

  const rows = useMemo(() => {
    return (kenhs.data ?? [])
      .map((k) => ({ k, d: latest.get(k.id), p: prev.get(k.id) }))
      .filter((r) => !loKhuVuc || r.k.khu_vuc === loKhuVuc)
      .filter((r) => !loHang || capHang(r.d?.d_tong) === loHang)
      .sort((a, b) => (b.d?.d_tong ?? -1) - (a.d?.d_tong ?? -1));
  }, [kenhs.data, latest, prev, loKhuVuc, loHang]);

  if (kenhs.isLoading || diem.isLoading) return <Loading />;

  const coDiem = (diem.data ?? []).length > 0;

  return (
    <div className="screen">
      <SectionCard
        title="Xếp hạng kênh"
        icon="chart"
        right={
          <div className="filters">
            <select className="select sm" value={loKhuVuc} onChange={(e) => setLoKhuVuc(e.target.value)}>
              <option value="">Mọi khu vực</option>
              {khuVucs.map((kv) => (<option key={kv} value={kv}>{kv}</option>))}
            </select>
            <select className="select sm" value={loHang} onChange={(e) => setLoHang(e.target.value)}>
              <option value="">Mọi hạng</option>
              {["A", "B", "C", "D"].map((h) => (<option key={h} value={h}>Hạng {h}</option>))}
            </select>
          </div>
        }
      >
        {!coDiem ? (
          <EmptyState
            icon="chart"
            title="Chưa có Health Score"
            hint="Chạy migration 006_metrics.sql và chờ cron 02:15 (hoặc nhiều kênh + vài ngày dữ liệu) để có điểm xếp hạng."
          />
        ) : rows.length === 0 ? (
          <EmptyState title="Không có kênh khớp bộ lọc" />
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Kênh</th>
                  <th>Khu vực</th>
                  <th className="r">Điểm</th>
                  <th>Hạng</th>
                  <th>Follower 8t</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ k, d, p }, i) => {
                  const bienDong = d?.hang != null && p?.hang != null ? p.hang - d.hang : 0;
                  return (
                    <tr key={k.id} className="clickable" onClick={() => onChonKenh(k.id)}>
                      <td className="mut nowrap">
                        {i + 1}
                        {bienDong > 0 && <span className="d-up"> ▲{bienDong}</span>}
                        {bienDong < 0 && <span className="d-down"> ▼{-bienDong}</span>}
                      </td>
                      <td className="v-title">
                        <span className="v-txt">{k.username ? "@" + k.username : k.ma_ch}</span>
                      </td>
                      <td className="mut nowrap">{k.khu_vuc ?? "—"}</td>
                      <td className="r">{d?.d_tong != null ? Number(d.d_tong).toFixed(0) : "—"}</td>
                      <td><HangBadge d={d?.d_tong} /></td>
                      <td><Sparkline data={(folByKenh.get(k.id) ?? []).map((x) => x.f)} color="#CBA45A" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <div className="note-p1">
        <Icon name="users" size={14} />
        Điểm thấp/đồng đều khi ít kênh (percentile nội bộ cần nhiều kênh để phân biệt). Tổng {soVN(rows.length)} kênh.
      </div>
    </div>
  );
}
