import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { usePtVideo, useVideoSnapshots } from "../hooks/queries";
import { EChart, CHART, AXIS_TEXT } from "./EChart";
import { EmptyState, Loading, Icon } from "./ui";
import { soVN, soGon, ngayGon, ngayDay, NHAN_TEN, THU_TEN } from "../lib/format";

export interface VideoMo {
  video_id: string;
  tieu_de?: string | null;
  mo_ta?: string | null;
  dang_luc: string;
  share_url?: string | null;
}

// Hệ số "gấp mấy lần" so với mốc; null khi thiếu dữ liệu.
function lan(x: number | null | undefined, moc: number | null | undefined): number | null {
  if (x == null || moc == null || moc <= 0) return null;
  return Math.round((x / moc) * 10) / 10;
}

export function GiaiPhauVideo({ video, onClose, onChonKenh }: {
  video: VideoMo;
  onClose: () => void;
  onChonKenh?: (id: number) => void;
}) {
  const pt = usePtVideo(video.video_id);
  const snaps = useVideoSnapshots(useMemo(() => [video.video_id], [video.video_id]));

  const d = pt.data;
  const series = useMemo(
    () => (snaps.data ?? []).slice().sort((a, b) => (a.ngay < b.ngay ? -1 : 1)),
    [snaps.data],
  );

  // Kết luận "vì sao" — luật đọc được, chỉ nói khi đủ dữ liệu so sánh.
  const ketLuan = useMemo(() => {
    if (!d) return [];
    const out: { tone: "up" | "down" | "flat"; text: string }[] = [];
    const duSoSanh = (d.so_video_sosanh ?? 0) >= 10;

    if (d.pct_view != null && duSoSanh) {
      const top = Math.round((1 - d.pct_view) * 100);
      if (d.pct_view >= 0.9) out.push({ tone: "up", text: `Thuộc top ${Math.max(top, 1)}% lượt xem toàn hệ thống (${soVN(d.so_video_sosanh)} video 90 ngày).` });
      else if (d.pct_view <= 0.25) out.push({ tone: "down", text: `Nằm ở nhóm 25% lượt xem thấp nhất hệ thống — xem lại chủ đề/khung giờ.` });
    }
    const vsKenh = lan(d.xem, d.kenh_med_view);
    if (vsKenh != null && vsKenh >= 3) out.push({ tone: "up", text: `Gấp ${vsKenh} lần video trung vị của chính kênh — chủ đề này vượt hẳn mặt bằng kênh, nên làm tiếp.` });
    if (d.view_ngay_dau != null && d.p95_ngay_dau != null && d.view_ngay_dau > d.p95_ngay_dau) {
      out.push({ tone: "up", text: `Bùng nổ ngay 24h đầu (${soGon(d.view_ngay_dau)} > P95 hệ thống ${soGon(d.p95_ngay_dau)}) — thuật toán đẩy mạnh từ sớm.` });
    }
    if (d.er != null && d.er_sys != null && d.er_sys > 0) {
      if (d.er >= d.er_sys * 1.5) out.push({ tone: "up", text: `Tương tác ${d.er.toFixed(1)}% — gấp ${(d.er / d.er_sys).toFixed(1)} lần mặt bằng hệ thống (${d.er_sys.toFixed(1)}%).` });
      else if (d.er < d.er_sys * 0.5) out.push({ tone: "down", text: `Tương tác ${d.er.toFixed(1)}% thấp hơn hẳn mặt bằng ${d.er_sys.toFixed(1)}% — xem nhiều nhưng không giữ được người xem.` });
    }
    if (d.xem != null && d.xem > 0 && d.chia_se != null && d.thich != null && d.thich > 0 && d.chia_se * 10 >= d.thich) {
      out.push({ tone: "up", text: `Tỷ lệ chia sẻ cao bất thường (${soVN(d.chia_se)} chia sẻ) — tín hiệu lan truyền mạnh nhất với thuật toán.` });
    }
    if (out.length === 0) {
      out.push({ tone: "flat", text: duSoSanh ? "Video ở mức trung bình — chưa có tín hiệu nổi bật so với kênh và hệ thống." : "Chưa đủ video trong hệ thống để so sánh có ý nghĩa (cần thêm kênh/dữ liệu)." });
    }
    return out;
  }, [d]);

  const lifecycleOption: EChartsOption = {
    grid: { left: 6, right: 12, top: 14, bottom: 4, containLabel: true },
    tooltip: {
      trigger: "axis", backgroundColor: "#0E1626", borderColor: CHART.line,
      textStyle: { color: CHART.ink }, valueFormatter: (v) => soVN(v as number),
    },
    xAxis: {
      type: "category", data: series.map((s) => ngayGon(s.ngay)), boundaryGap: false,
      axisLabel: { ...AXIS_TEXT }, axisLine: { lineStyle: { color: CHART.line } }, axisTick: { show: false },
    },
    yAxis: { type: "value", axisLabel: { ...AXIS_TEXT, formatter: (v: number) => soGon(v) }, splitLine: { lineStyle: { color: CHART.grid } } },
    series: [{
      type: "line", data: series.map((s) => s.luot_xem ?? 0), smooth: true, showSymbol: series.length < 15,
      lineStyle: { color: CHART.gold, width: 2.2 },
      areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [
        { offset: 0, color: "rgba(203,164,90,0.25)" }, { offset: 1, color: "rgba(203,164,90,0.02)" },
      ] } },
    }],
  };

  const tieuDe = video.tieu_de || video.mo_ta || video.video_id;

  return (
    <div className="modal-ovl" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">
            <div className="gp-tieude">{tieuDe}</div>
            <div className="gp-meta">
              {d?.ten_kenh && (
                onChonKenh && d.kenh_id
                  ? <button className="link" onClick={() => { onClose(); onChonKenh(d.kenh_id); }}>{d.ten_kenh}</button>
                  : <span>{d.ten_kenh}</span>
              )}
              <span className="mut"> · {ngayDay(video.dang_luc)}</span>
              {d?.nhan && <span className="nhan">{NHAN_TEN[d.nhan] ?? d.nhan}</span>}
              {d && <span className="mut">{THU_TEN[d.thu_dang] ?? ""} · {String(d.gio_dang).padStart(2, "0")}h{d.thoi_luong_s != null ? ` · ${d.thoi_luong_s}s` : ""}</span>}
              {video.share_url && <a className="link" href={video.share_url} target="_blank" rel="noreferrer">Mở TikTok</a>}
            </div>
          </div>
          <button className="modal-x" onClick={onClose} aria-label="Đóng"><Icon name="x" size={16} /></button>
        </div>

        {pt.isLoading ? (
          <Loading />
        ) : pt.error ? (
          <EmptyState icon="chart" title="Chưa chạy được phân tích"
            hint="Cần chạy migration 008_phan_tich.sql trên Supabase để bật Giải phẫu video." />
        ) : !d ? (
          <EmptyState title="Không tìm thấy video" />
        ) : (
          <>
            {/* Kết luận vì sao */}
            <div className="gp-ketluan">
              {ketLuan.map((k, i) => (
                <div key={i} className={`gp-kl ${k.tone}`}>{k.text}</div>
              ))}
            </div>

            {/* Số liệu so sánh */}
            <div className="gp-grid">
              <div className="gp-stat"><div className="gp-v">{soGon(d.xem)}</div><div className="gp-l">Lượt xem</div></div>
              <div className="gp-stat">
                <div className="gp-v">{lan(d.xem, d.kenh_med_view) != null ? "×" + lan(d.xem, d.kenh_med_view) : "—"}</div>
                <div className="gp-l">vs trung vị kênh ({soGon(d.kenh_med_view)})</div>
              </div>
              <div className="gp-stat">
                <div className="gp-v">{lan(d.xem, d.sys_med_view) != null ? "×" + lan(d.xem, d.sys_med_view) : "—"}</div>
                <div className="gp-l">vs trung vị hệ thống ({soGon(d.sys_med_view)})</div>
              </div>
              <div className="gp-stat">
                <div className="gp-v">{d.pct_view != null && d.so_video_sosanh >= 10 ? "Top " + Math.max(1, Math.round((1 - d.pct_view) * 100)) + "%" : "—"}</div>
                <div className="gp-l">hạng view hệ thống{d.so_video_sosanh < 10 ? " (cần ≥10 video)" : ""}</div>
              </div>
              <div className="gp-stat"><div className="gp-v">{d.er != null ? d.er.toFixed(1) + "%" : "—"}</div><div className="gp-l">ER (kênh {d.er_kenh != null ? d.er_kenh.toFixed(1) + "%" : "—"} · hệ thống {d.er_sys != null ? d.er_sys.toFixed(1) + "%" : "—"})</div></div>
              <div className="gp-stat"><div className="gp-v">{soGon(d.view_ngay_dau)}</div><div className="gp-l">view 24h đầu (P95: {soGon(d.p95_ngay_dau)})</div></div>
            </div>

            {/* Phân rã tương tác */}
            <div className="gp-tt">
              <span><Icon name="eye" size={13} /> {soVN(d.xem)}</span>
              <span>Thích {soVN(d.thich)}</span>
              <span>Bình luận {soVN(d.binh_luan)}</span>
              <span>Chia sẻ {soVN(d.chia_se)}</span>
            </div>

            {/* Vòng đời view */}
            {series.length >= 2 ? (
              <EChart option={lifecycleOption} height={180} />
            ) : (
              <div className="mut sm">Vòng đời view sẽ hiện khi có từ 2 ngày snapshot.</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
