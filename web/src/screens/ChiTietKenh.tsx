import { useEffect, useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import {
  useKenhs, useKenhSnapshots, useKenhVideos, useVideoSnapshots, useCanhBao, useDiemTuan,
} from "../hooks/queries";
import { EChart, CHART, AXIS_TEXT } from "../components/EChart";
import {
  SectionCard, EmptyState, Loading, DeltaText, MucDoBadge, TrangThaiKenh, HangBadge, Sparkline, Icon,
} from "../components/ui";
import { NhatKyLive } from "../components/NhatKyLive";
import { GiaiPhauVideo, type VideoMo } from "../components/GiaiPhauVideo";
import { soVN, soGon, ngayGon, ngayDay, ngayISO_VN, isoNgayTruoc, tinhER } from "../lib/format";
import type { SnapshotVideo, DiemTuan } from "../lib/types";

const THANG_VN = ["Th1", "Th2", "Th3", "Th4", "Th5", "Th6", "Th7", "Th8", "Th9", "Th10", "Th11", "Th12"];

function barW(v: number, arr: { m: number }[]): string {
  const max = Math.max(1, ...arr.map((x) => x.m));
  return `${Math.max(3, (v / max) * 100)}%`;
}
const TRU = [
  { key: "d_chuyencan", ten: "Chuyên cần", max: 25 },
  { key: "d_noidung", ten: "Nội dung", max: 25 },
  { key: "d_tangtruong", ten: "Tăng trưởng", max: 20 },
  { key: "d_hitrate", ten: "Hit-rate", max: 15 },
  { key: "d_live", ten: "Live", max: 15 },
] as const;

export function ChiTietKenh({ kenhId, setKenhId }: { kenhId?: number; setKenhId: (id: number) => void }) {
  const kenhs = useKenhs();
  const list = kenhs.data ?? [];
  const kenh = list.find((k) => k.id === kenhId);

  const snaps = useKenhSnapshots(kenhId, 84);
  const videos = useKenhVideos(kenhId);
  const videoIds = (videos.data ?? []).map((v) => v.video_id);
  const vsnaps = useVideoSnapshots(videoIds);
  const canhBao = useCanhBao(kenhId);
  const diem = useDiemTuan(8);
  const [selVideo, setSelVideo] = useState<VideoMo | null>(null);

  // Tự chọn kênh đầu tiên nếu chưa chọn
  useEffect(() => {
    if (kenhId == null && list.length > 0) setKenhId(list[0].id);
  }, [kenhId, list, setKenhId]);

  // Gộp snapshot theo video
  const perVideo = useMemo(() => {
    const byVid = new Map<string, SnapshotVideo[]>();
    for (const s of vsnaps.data ?? []) {
      const arr = byVid.get(s.video_id) ?? [];
      arr.push(s);
      byVid.set(s.video_id, arr);
    }
    return (videos.data ?? [])
      .map((v) => {
        const ss = (byVid.get(v.video_id) ?? []).slice().sort((a, b) => (a.ngay < b.ngay ? -1 : 1));
        const last = ss[ss.length - 1];
        return {
          v,
          last,
          er: tinhER(last?.luot_xem ?? null, last?.luot_thich ?? null, last?.binh_luan ?? null, last?.chia_se ?? null),
          series: ss.map((x) => x.luot_xem ?? 0),
        };
      })
      .sort((a, b) => (b.last?.luot_xem ?? 0) - (a.last?.luot_xem ?? 0));
  }, [videos.data, vsnaps.data]);

  // Chuỗi thời gian follower + view
  const ts = useMemo(() => {
    const fol = new Map<string, number>();
    for (const s of snaps.data ?? []) if (s.follower != null) fol.set(s.ngay, s.follower);
    const view = new Map<string, number>();
    for (const s of vsnaps.data ?? []) view.set(s.ngay, (view.get(s.ngay) ?? 0) + Number(s.luot_xem ?? 0));
    const dates = [...new Set([...fol.keys(), ...view.keys()])].sort();
    return {
      dates,
      follower: dates.map((d) => fol.get(d) ?? null),
      view: dates.map((d) => view.get(d) ?? null),
    };
  }, [snaps.data, vsnaps.data]);

  // Heatmap lịch đăng (view theo ngày đăng)
  const heat = useMemo(() => {
    const m = new Map<string, number>();
    for (const pv of perVideo) {
      const d = ngayISO_VN(pv.v.dang_luc); // ngày đăng theo giờ VN (khớp range heatmap)
      m.set(d, (m.get(d) ?? 0) + Number(pv.last?.luot_xem ?? 0));
    }
    return [...m.entries()].map(([d, v]) => [d, v] as [string, number]);
  }, [perVideo]);

  // Radar 5 trụ: kênh này vs trung bình hệ thống (từ Health Score tuần mới nhất)
  const radar = useMemo(() => {
    const latest = new Map<number, DiemTuan>();
    for (const d of diem.data ?? []) {
      const cur = latest.get(d.kenh_id);
      if (!cur || d.tuan > cur.tuan) latest.set(d.kenh_id, d);
    }
    const all = [...latest.values()];
    const me = kenhId != null ? latest.get(kenhId) : undefined;
    const avg = (key: string) =>
      all.length ? all.reduce((a, d) => a + Number((d as unknown as Record<string, number>)[key] ?? 0), 0) / all.length : 0;
    return {
      co: !!me,
      d_tong: me?.d_tong ?? null,
      me: TRU.map((t) => Number((me as unknown as Record<string, number>)?.[t.key] ?? 0)),
      sys: TRU.map((t) => Math.round(avg(t.key) * 10) / 10),
    };
  }, [diem.data, kenhId]);

  // Phân tích cắt lớp: view trung vị theo nhãn / khung giờ đăng (giờ VN)
  const catLop = useMemo(() => {
    const push = (m: Map<string | number, number[]>, k: string | number, v: number) => {
      const a = m.get(k);
      if (a) a.push(v); else m.set(k, [v]);
    };
    const byNhan = new Map<string, number[]>();
    const byGio = new Map<number, number[]>();
    for (const pv of perVideo) {
      const view = pv.last?.luot_xem;
      if (view == null) continue;
      push(byNhan as Map<string | number, number[]>, pv.v.nhan ?? "KHAC", view);
      const h = parseInt(new Date(pv.v.dang_luc).toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", hour12: false }), 10);
      push(byGio as Map<string | number, number[]>, Number.isFinite(h) ? h : 0, view);
    }
    const med = (arr: number[]) => {
      const s = arr.slice().sort((a, b) => a - b);
      return s.length ? s[Math.floor(s.length / 2)] : 0;
    };
    return {
      nhan: [...byNhan.entries()].map(([k, v]) => ({ k, m: med(v), n: v.length })).sort((a, b) => b.m - a.m),
      gio: [...byGio.entries()].map(([k, v]) => ({ k, m: med(v), n: v.length })).sort((a, b) => b.m - a.m).slice(0, 6),
    };
  }, [perVideo]);

  // Header stats
  const arr = snaps.data ?? [];
  const latestSnap = arr[arr.length - 1];
  const follower = latestSnap?.follower ?? null;
  const soVideo = latestSnap?.so_video ?? null;
  const d7 = useMemo(() => {
    if (arr.length < 2) return null;
    const last = arr[arr.length - 1];
    const cutoff = new Date(new Date(last.ngay).getTime() - 7 * 86400000).toISOString().slice(0, 10);
    let base = arr[0];
    for (const s of arr) {
      if (s.ngay <= cutoff) base = s;
      else break;
    }
    return (last.follower ?? 0) - (base.follower ?? 0);
  }, [arr]);

  const canhBaoKenh = (canhBao.data ?? []).filter((c) => c.trang_thai !== "DA_XU_LY");

  // ----- Options chart -----
  const tsOption: EChartsOption = {
    grid: { left: 6, right: 6, top: 30, bottom: 6, containLabel: true },
    legend: { data: ["Người theo dõi", "Lượt xem"], textStyle: { color: CHART.mut, fontSize: 11 }, top: 0, icon: "roundRect" },
    tooltip: { trigger: "axis", backgroundColor: "#0E1626", borderColor: CHART.line, textStyle: { color: CHART.ink }, valueFormatter: (v) => soVN(v as number) },
    xAxis: {
      type: "category", data: ts.dates.map(ngayGon), boundaryGap: false,
      axisLabel: { ...AXIS_TEXT }, axisLine: { lineStyle: { color: CHART.line } }, axisTick: { show: false },
    },
    yAxis: [
      { type: "value", name: "Follower", nameTextStyle: { color: CHART.mut, fontSize: 10 }, axisLabel: { ...AXIS_TEXT, formatter: (v: number) => soGon(v) }, splitLine: { lineStyle: { color: CHART.grid } } },
      { type: "value", name: "View", nameTextStyle: { color: CHART.mut, fontSize: 10 }, axisLabel: { ...AXIS_TEXT, formatter: (v: number) => soGon(v) }, splitLine: { show: false } },
    ],
    series: [
      { name: "Người theo dõi", type: "line", yAxisIndex: 0, data: ts.follower, smooth: true, showSymbol: false, connectNulls: true, lineStyle: { color: CHART.gold, width: 2.2 } },
      { name: "Lượt xem", type: "line", yAxisIndex: 1, data: ts.view, smooth: true, showSymbol: false, connectNulls: true, lineStyle: { color: CHART.teal, width: 2.2 } },
    ],
  };

  const maxHeat = Math.max(1, ...heat.map((h) => h[1]));
  const heatOption: EChartsOption = {
    tooltip: {
      backgroundColor: "#0E1626", borderColor: CHART.line, textStyle: { color: CHART.ink },
      formatter: (p: unknown) => {
        const v = (p as { value: [string, number] }).value;
        return `${ngayDay(v[0])}: ${soGon(v[1])} view`;
      },
    },
    visualMap: {
      min: 0, max: maxHeat, calculable: false, orient: "horizontal", left: "center", bottom: 0,
      inRange: { color: ["#152036", CHART.teal, CHART.gold] }, textStyle: { color: CHART.mut, fontSize: 10 },
    },
    calendar: {
      top: 14, left: 24, right: 12, bottom: 40, cellSize: ["auto", 13],
      range: [isoNgayTruoc(90), isoNgayTruoc(0)],
      itemStyle: { color: "#0E1626", borderColor: CHART.line, borderWidth: 1 },
      splitLine: { show: false }, yearLabel: { show: false },
      dayLabel: { color: CHART.mut, fontSize: 9, firstDay: 1, nameMap: ["CN", "T2", "T3", "T4", "T5", "T6", "T7"] },
      monthLabel: { color: CHART.mut, fontSize: 10, nameMap: THANG_VN },
    },
    series: [{ type: "heatmap", coordinateSystem: "calendar", data: heat }],
  };

  const radarOption: EChartsOption = {
    tooltip: { backgroundColor: "#0E1626", borderColor: CHART.line, textStyle: { color: CHART.ink } },
    legend: { data: ["Kênh này", "Trung bình hệ thống"], textStyle: { color: CHART.mut, fontSize: 11 }, bottom: 0 },
    radar: {
      indicator: TRU.map((t) => ({ name: t.ten, max: t.max })),
      axisName: { color: CHART.mut, fontSize: 11 },
      splitLine: { lineStyle: { color: CHART.grid } },
      splitArea: { areaStyle: { color: ["rgba(255,255,255,0.02)", "transparent"] } },
      axisLine: { lineStyle: { color: CHART.line } },
    },
    series: [{
      type: "radar",
      data: [
        { value: radar.me, name: "Kênh này", lineStyle: { color: CHART.gold, width: 2 }, itemStyle: { color: CHART.gold }, areaStyle: { color: "rgba(203,164,90,0.22)" } },
        { value: radar.sys, name: "Trung bình hệ thống", lineStyle: { color: CHART.teal, width: 2 }, itemStyle: { color: CHART.teal }, areaStyle: { color: "rgba(63,182,168,0.10)" } },
      ],
    }],
  };

  // ----- Render -----
  if (kenhs.isLoading) return <Loading />;
  if (list.length === 0) {
    return (
      <div className="screen">
        <EmptyState icon="link" title="Chưa có kênh nào kết nối"
          hint="Gửi link /connect?ch=MÃ_CH cho cửa hàng để kết nối kênh TikTok đầu tiên." />
      </div>
    );
  }

  return (
    <div className="screen">
      {/* Chọn kênh + header */}
      <SectionCard
        title="Kênh"
        icon="grid"
        right={
          <select className="select" value={kenhId ?? ""} onChange={(e) => setKenhId(Number(e.target.value))}>
            {list.map((k) => (
              <option key={k.id} value={k.id}>
                {k.username ? "@" + k.username : k.ma_ch} — {k.ma_ch}
              </option>
            ))}
          </select>
        }
      >
        {kenh && (
          <div className="kenh-head">
            <div className="kenh-id">
              <div className="kenh-handle">{kenh.username ? "@" + kenh.username : kenh.ma_ch}</div>
              <div className="kenh-meta">
                <span className="mono">{kenh.ma_ch}</span>
                {kenh.khu_vuc && <span> · {kenh.khu_vuc}</span>}
                <TrangThaiKenh tt={kenh.trang_thai} />
              </div>
            </div>
            <div className="kenh-stats">
              <div className="kstat">
                <div className="kstat-v">{soVN(follower)}</div>
                <div className="kstat-l">Người theo dõi <DeltaText n={d7} /></div>
              </div>
              <div className="kstat">
                <div className="kstat-v">{soVN(soVideo)}</div>
                <div className="kstat-l">Video</div>
              </div>
              <div className="kstat">
                <div className="kstat-v"><HangBadge d={radar.d_tong} /></div>
                <div className="kstat-l">Hạng tuần</div>
              </div>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Radar 5 trụ */}
      <SectionCard title="Radar 5 trụ (kênh vs trung bình hệ thống)" icon="grid">
        {!radar.co ? (
          <EmptyState title="Chưa có Health Score" hint="Chạy 006_metrics.sql và chờ cron 02:15 (cần nhiều kênh để so sánh)." />
        ) : (
          <EChart option={radarOption} height={300} />
        )}
      </SectionCard>

      {/* Chuỗi thời gian */}
      <SectionCard title="Follower & Lượt xem (12 tuần)" icon="chart">
        {snaps.isLoading || vsnaps.isLoading ? (
          <Loading />
        ) : ts.dates.length === 0 ? (
          <EmptyState title="Chưa có số liệu" hint="Chờ worker sync lần đầu cho kênh này." />
        ) : (
          <EChart option={tsOption} height={260} />
        )}
      </SectionCard>

      {/* Heatmap lịch đăng */}
      <SectionCard title="Lịch đăng (đậm theo lượt xem)" icon="grid">
        {heat.length === 0 ? (
          <EmptyState title="Chưa có video" />
        ) : (
          <EChart option={heatOption} height={200} />
        )}
      </SectionCard>

      {/* Bảng video */}
      <SectionCard title={`Video (${perVideo.length})`} icon="video">
        {videos.isLoading ? (
          <Loading />
        ) : perVideo.length === 0 ? (
          <EmptyState icon="video" title="Chưa có video" />
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Video</th>
                  <th>Đăng</th>
                  <th className="r">Xem</th>
                  <th className="r">ER</th>
                  <th>Vòng đời</th>
                </tr>
              </thead>
              <tbody>
                {perVideo.slice(0, 30).map((pv) => (
                  <tr key={pv.v.video_id} className="clickable" onClick={() => setSelVideo(pv.v)}>
                    <td className="v-title">
                      {pv.v.nhan && <span className="nhan">{pv.v.nhan}</span>}
                      <span className="v-txt">{pv.v.tieu_de || pv.v.mo_ta || pv.v.video_id}</span>
                    </td>
                    <td className="mut nowrap">{ngayDay(pv.v.dang_luc)}</td>
                    <td className="r">{soGon(pv.last?.luot_xem)}</td>
                    <td className="r">{pv.er == null ? "—" : pv.er.toFixed(1) + "%"}</td>
                    <td><Sparkline data={pv.series} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Phân tích cắt lớp */}
      {catLop.nhan.length > 0 && (
        <SectionCard title="Phân tích cắt lớp — view trung vị" icon="chart">
          <div className="catlop">
            <div>
              <div className="catlop-h">Theo nhãn nội dung</div>
              {catLop.nhan.map((r) => (
                <div key={r.k} className="catlop-row">
                  <span className="nhan">{r.k}</span>
                  <div className="catlop-bar"><div className="catlop-fill" style={{ width: barW(r.m, catLop.nhan) }} /></div>
                  <span className="catlop-v mono">{soGon(r.m)}</span>
                </div>
              ))}
            </div>
            <div>
              <div className="catlop-h">Khung giờ đăng hiệu quả nhất</div>
              {catLop.gio.map((r) => (
                <div key={r.k} className="catlop-row">
                  <span className="catlop-k mono">{String(r.k).padStart(2, "0")}h</span>
                  <div className="catlop-bar"><div className="catlop-fill teal" style={{ width: barW(r.m, catLop.gio) }} /></div>
                  <span className="catlop-v mono">{soGon(r.m)}</span>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      )}

      {/* Nhật ký Live (tự khai) — nuôi trụ Live */}
      <NhatKyLive kenhId={kenhId} trangThai={kenh?.trang_thai} />

      {/* Cảnh báo riêng kênh */}
      {canhBaoKenh.length > 0 && (
        <SectionCard title="Cảnh báo của kênh" icon="bell">
          <div className="alerts">
            {canhBaoKenh.slice(0, 8).map((c) => (
              <div key={c.id} className="alert-row static">
                <MucDoBadge mucDo={c.muc_do} />
                <span className="alert-noidung">{c.noi_dung ?? c.loai}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <div className="note-p1">
        <Icon name="grid" size={14} />
        Bấm một video để xem giải phẫu chi tiết. Nhãn do Claude phân loại; Nhật ký Live nuôi trụ Live.
      </div>

      {selVideo && (
        <GiaiPhauVideo video={selVideo} onClose={() => setSelVideo(null)} />
      )}
    </div>
  );
}
