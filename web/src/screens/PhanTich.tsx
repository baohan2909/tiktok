import { useMemo } from "react";
import { usePtYeuTo, usePtDna, usePtMaTran } from "../hooks/queries";
import { SectionCard, EmptyState, Loading, HangBadge, Icon } from "../components/ui";
import { soGon, soVN, NHAN_TEN, THU_TEN, ngayGon } from "../lib/format";
import type { PtHang, PtMaTranCell } from "../lib/types";

const N_TOI_THIEU = 3; // dưới ngưỡng này không rút kết luận
const NHAN_THU_TU = ["REVIEW", "LIVE_CUT", "TREND", "BTS", "KHAC", "CHUA"];
const GIO_BUCKETS = [0, 3, 6, 9, 12, 15, 18, 21];

function nhanK(chieu: string, k: string | number): string {
  if (chieu === "nhan") return NHAN_TEN[String(k)] ?? String(k);
  if (chieu === "gio") return `${String(k).padStart(2, "0")}–${String(Number(k) + 3).padStart(2, "0")}h`;
  if (chieu === "thu") return THU_TEN[Number(k)] ?? String(k);
  return String(k); // độ dài đã là nhãn sẵn
}

function BangYeuTo({ chieu, tieuDe, rows }: { chieu: string; tieuDe: string; rows: PtHang[] }) {
  const sorted = rows.slice().sort((a, b) => b.med_view - a.med_view);
  const max = Math.max(1, ...sorted.map((r) => r.med_view));
  return (
    <div>
      <div className="catlop-h">{tieuDe}</div>
      {sorted.map((r) => (
        <div key={String(r.k)} className="catlop-row" title={`${r.n} video · ER ${r.er.toFixed(1)}%`}>
          <span className={`catlop-k pt-k ${r.n < N_TOI_THIEU ? "mut" : ""}`}>{nhanK(chieu, r.k)}</span>
          <div className="catlop-bar"><div className="catlop-fill" style={{ width: `${Math.max(3, (r.med_view / max) * 100)}%` }} /></div>
          <span className="catlop-v mono">{soGon(r.med_view)}</span>
          <span className="pt-n mut">{r.n}v</span>
        </div>
      ))}
    </div>
  );
}

export function PhanTich() {
  const yeuTo = usePtYeuTo(90);
  const dna = usePtDna();
  const maTran = usePtMaTran(90);

  // Gợi ý nhân rộng: đỉnh của mỗi chiều, chỉ nói khi n đủ lớn. Kèm "lift" so mặt bằng.
  const goiY = useMemo(() => {
    const y = yeuTo.data;
    if (!y) return [];
    const out: string[] = [];
    const base = y.med_view_all || 0;
    const dinh = (rows: PtHang[], chieu: string, ten: string) => {
      const du = rows.filter((r) => r.n >= N_TOI_THIEU);
      if (du.length < 2) return;
      const top = du.slice().sort((a, b) => b.med_view - a.med_view)[0];
      const lift = base > 0 ? top.med_view / base : 0;
      const liftTxt = lift >= 1.15 ? ` — gấp ${lift.toFixed(1)} lần mặt bằng` : "";
      out.push(`${ten} hiệu quả nhất: ${nhanK(chieu, top.k)} — view trung vị ${soGon(top.med_view)}${liftTxt} (${top.n} video, ER ${top.er.toFixed(1)}%).`);
    };
    dinh(y.theo_nhan, "nhan", "Nhãn nội dung");
    dinh(y.theo_gio, "gio", "Khung giờ đăng");
    dinh(y.theo_thu, "thu", "Ngày đăng");
    dinh(y.theo_dodai, "dodai", "Độ dài video");

    const nhoms = dna.data?.nhom ?? [];
    const a = nhoms.find((n) => n.nhom === "A");
    const day = nhoms.find((n) => n.nhom === "D");
    if (a && day && a.so_kenh > 0 && day.so_kenh > 0) {
      out.push(`Nhóm A đăng ${a.video_tuan} video/tuần và live ${a.live_gio_tuan} giờ/tuần — nhóm D chỉ ${day.video_tuan} video/tuần, ${day.live_gio_tuan} giờ live. Kỷ luật đăng + live là khác biệt lớn nhất.`);
    }

    // Ô tốt nhất của ma trận (đủ mẫu) — combo nội dung × giờ.
    const cells = (maTran.data ?? []).filter((c) => c.n >= N_TOI_THIEU);
    if (cells.length >= 2) {
      const best = cells.slice().sort((x, y2) => y2.med_view - x.med_view)[0];
      out.push(`Combo tốt nhất: ${NHAN_TEN[best.nhan] ?? best.nhan} đăng ${String(best.gio).padStart(2, "0")}–${String(best.gio + 3).padStart(2, "0")}h — view trung vị ${soGon(best.med_view)} (${best.n} video).`);
    }
    return out;
  }, [yeuTo.data, dna.data, maTran.data]);

  // Ma trận Nhãn × Khung giờ: map tra cứu + max để tô màu.
  const mt = useMemo(() => {
    const map = new Map<string, PtMaTranCell>();
    let max = 1;
    const nhanCo = new Set<string>();
    for (const c of maTran.data ?? []) {
      map.set(c.nhan + ":" + c.gio, c);
      if (c.med_view > max) max = c.med_view;
      nhanCo.add(c.nhan);
    }
    return { map, max, nhanRows: NHAN_THU_TU.filter((n) => nhanCo.has(n)) };
  }, [maTran.data]);

  if (yeuTo.isLoading) return <Loading />;

  if (yeuTo.error) {
    return (
      <div className="screen">
        <EmptyState icon="chart" title="Chưa bật Analytics Engine"
          hint="Chạy migration 008_phan_tich.sql trên Supabase SQL Editor để bật tab này (3 hàm pt_*)." />
      </div>
    );
  }

  const y = yeuTo.data;
  const itDuLieu = (y?.so_video ?? 0) < 20;
  const nhoms = dna.data?.nhom ?? [];

  return (
    <div className="screen">
      {/* Gợi ý nhân rộng */}
      <SectionCard title="Công thức nhân rộng" icon="bulb">
        {goiY.length === 0 ? (
          <EmptyState title="Chưa đủ dữ liệu để rút công thức"
            hint={`Cần mỗi nhóm ≥ ${N_TOI_THIEU} video để so sánh có ý nghĩa. Kết nối thêm kênh và tích lũy vài tuần.`} />
        ) : (
          <ul className="bc-bullets teal">
            {goiY.map((g, i) => (<li key={i}>{g}</li>))}
          </ul>
        )}
        {itDuLieu && goiY.length > 0 && (
          <div className="note-p1"><Icon name="chart" size={13} />
            Mới có {soVN(y?.so_video ?? 0)} video trong 90 ngày — kết luận sẽ vững hơn khi thêm kênh.
          </div>
        )}
      </SectionCard>

      {/* Yếu tố hiệu quả */}
      <SectionCard title={`Yếu tố hiệu quả — view trung vị theo từng chiều (90 ngày · ${soVN(y?.so_video ?? 0)} video)`} icon="chart">
        {(y?.so_video ?? 0) === 0 ? (
          <EmptyState title="Chưa có video có số liệu" hint="Chờ worker sync và tích lũy snapshot." />
        ) : (
          <div className="catlop">
            <BangYeuTo chieu="nhan" tieuDe="Theo nhãn nội dung" rows={y!.theo_nhan} />
            <BangYeuTo chieu="gio" tieuDe="Theo khung giờ đăng" rows={y!.theo_gio} />
            <BangYeuTo chieu="thu" tieuDe="Theo ngày trong tuần" rows={y!.theo_thu} />
            <BangYeuTo chieu="dodai" tieuDe="Theo độ dài video" rows={y!.theo_dodai} />
          </div>
        )}
      </SectionCard>

      {/* Ma trận Nhãn × Khung giờ */}
      <SectionCard title="Ma trận Nhãn × Khung giờ — view trung vị" icon="grid">
        {maTran.error ? (
          <EmptyState title="Chưa bật ma trận"
            hint="Chạy migration 008_phan_tich.sql bản mới (có hàm pt_ma_tran) trên Supabase." />
        ) : mt.nhanRows.length === 0 ? (
          <EmptyState title="Chưa đủ dữ liệu cho ma trận"
            hint="Cần video có nhãn (Claude phân loại) + snapshot để dựng ma trận nội dung × giờ." />
        ) : (
          <div className="mt-wrap">
            <table className="mt-tbl">
              <thead>
                <tr>
                  <th></th>
                  {GIO_BUCKETS.map((g) => (<th key={g}>{String(g).padStart(2, "0")}h</th>))}
                </tr>
              </thead>
              <tbody>
                {mt.nhanRows.map((n) => (
                  <tr key={n}>
                    <td className="mt-rk">{NHAN_TEN[n] ?? n}</td>
                    {GIO_BUCKETS.map((g) => {
                      const c = mt.map.get(n + ":" + g);
                      return (
                        <td
                          key={g}
                          className="mt-cell"
                          style={c ? { background: `rgba(63,182,168,${(0.06 + 0.5 * (c.med_view / mt.max)).toFixed(2)})` } : undefined}
                          title={c ? `${NHAN_TEN[n] ?? n} · ${String(g).padStart(2, "0")}–${String(g + 3).padStart(2, "0")}h: ${soGon(c.med_view)} view (${c.n} video)` : "chưa có video"}
                        >
                          {c ? soGon(c.med_view) : ""}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-note mut">Ô càng đậm = view trung vị càng cao. Rê chuột xem số video. Trả lời "đăng loại gì, vào giờ nào".</div>
      </SectionCard>

      {/* DNA nhóm hạng */}
      <SectionCard title={`DNA nhóm hạng${dna.data?.tuan ? ` — tuần ${ngayGon(dna.data.tuan)}` : ""}`} icon="users">
        {dna.isLoading ? (
          <Loading />
        ) : nhoms.length === 0 ? (
          <EmptyState title="Chưa có nhóm hạng để so sánh"
            hint="Cần Health Score của nhiều kênh (cron chấm 02:15 hàng đêm) để thấy nhóm A làm gì khác nhóm D." />
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Chỉ số</th>
                  {nhoms.map((n) => (
                    <th key={n.nhom} className="r"><HangBadge d={n.nhom === "A" ? 90 : n.nhom === "B" ? 70 : n.nhom === "C" ? 55 : 40} /></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr><td className="mut">Số kênh</td>{nhoms.map((n) => <td key={n.nhom} className="r">{n.so_kenh}</td>)}</tr>
                <tr><td className="mut">Video / tuần</td>{nhoms.map((n) => <td key={n.nhom} className="r">{n.video_tuan}</td>)}</tr>
                <tr><td className="mut">View trung vị</td>{nhoms.map((n) => <td key={n.nhom} className="r">{soGon(n.med_view)}</td>)}</tr>
                <tr><td className="mut">ER</td>{nhoms.map((n) => <td key={n.nhom} className="r">{n.er.toFixed(1)}%</td>)}</tr>
                <tr><td className="mut">Giờ live / tuần</td>{nhoms.map((n) => <td key={n.nhom} className="r">{n.live_gio_tuan}</td>)}</tr>
                <tr><td className="mut">Δ follower (28 ngày)</td>{nhoms.map((n) => <td key={n.nhom} className="r">{n.tang_follower_pct != null ? n.tang_follower_pct + "%" : "—"}</td>)}</tr>
                <tr>
                  <td className="mut">Nội dung chủ đạo</td>
                  {nhoms.map((n) => {
                    const top = Object.entries(n.nhan_mix).sort((a, b) => b[1] - a[1])[0];
                    return <td key={n.nhom} className="r">{top ? `${NHAN_TEN[top[0]] ?? top[0]} (${top[1]})` : "—"}</td>;
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <div className="note-p1">
        <Icon name="bulb" size={14} />
        So sánh nội bộ toàn chuỗi: view trung vị (chống nhiễu video bùng nổ), ER có trọng số chia sẻ ×3. Nhóm dưới {N_TOI_THIEU} video hiển thị mờ — chưa đủ để kết luận.
      </div>
    </div>
  );
}
