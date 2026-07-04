import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { useKenhs, useSnapshotsKenh, useMetricsTuan, useCanhBao } from "../hooks/queries";
import { EChart, CHART, AXIS_TEXT } from "../components/EChart";
import {
  KpiCard, DeltaText, SectionCard, EmptyState, Loading, MucDoBadge, Icon,
} from "../components/ui";
import { soVN, soGon, ngayGon } from "../lib/format";
import type { SnapshotKenh } from "../lib/types";

export function TongQuan({ onChonKenh }: { onChonKenh: (id: number) => void }) {
  const kenhs = useKenhs();
  const snaps = useSnapshotsKenh(84);
  const metrics = useMetricsTuan(7);
  const canhBao = useCanhBao();

  const dat = useMemo(() => {
    const list = snaps.data ?? [];
    // Snapshot mới nhất mỗi kênh -> tổng follower
    const latest = new Map<number, SnapshotKenh>();
    for (const s of list) {
      const cur = latest.get(s.kenh_id);
      if (!cur || s.ngay > cur.ngay) latest.set(s.kenh_id, s);
    }
    const tongFollower = [...latest.values()].reduce((a, s) => a + (s.follower ?? 0), 0);

    // Tổng follower theo ngày (đường 12 tuần)
    const byDate = new Map<string, number>();
    for (const s of list) {
      if (s.follower == null) continue;
      byDate.set(s.ngay, (byDate.get(s.ngay) ?? 0) + s.follower);
    }
    const dates = [...byDate.keys()].sort();
    const values = dates.map((d) => byDate.get(d)!);

    const m = metrics.data ?? [];
    return {
      tongFollower,
      dFollower: m.reduce((a, x) => a + (x.follower_tang ?? 0), 0),
      videoTuan: m.reduce((a, x) => a + Number(x.video_moi ?? 0), 0),
      viewTuan: m.reduce((a, x) => a + Number(x.xem_tang ?? 0), 0),
      soKenhHoatDong: (kenhs.data ?? []).filter((k) => k.trang_thai === "HOAT_DONG").length,
      soKenh: (kenhs.data ?? []).length,
      dates,
      values,
    };
  }, [snaps.data, metrics.data, kenhs.data]);

  const canhBaoMoi = (canhBao.data ?? []).filter((c) => c.trang_thai === "MOI");
  const tenKenh = useMemo(() => {
    const map = new Map<number, string>();
    for (const k of kenhs.data ?? []) map.set(k.id, k.username ? "@" + k.username : k.ma_ch);
    return map;
  }, [kenhs.data]);

  const dangTai = kenhs.isLoading || snaps.isLoading;
  const loi = kenhs.error || snaps.error || metrics.error;

  const followerOption: EChartsOption = {
    grid: { left: 6, right: 14, top: 18, bottom: 6, containLabel: true },
    tooltip: {
      trigger: "axis",
      backgroundColor: "#0E1626",
      borderColor: CHART.line,
      textStyle: { color: CHART.ink },
      valueFormatter: (v) => soVN(v as number),
    },
    xAxis: {
      type: "category",
      data: dat.dates.map(ngayGon),
      boundaryGap: false,
      axisLabel: { ...AXIS_TEXT },
      axisLine: { lineStyle: { color: CHART.line } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: { ...AXIS_TEXT, formatter: (v: number) => soGon(v) },
      splitLine: { lineStyle: { color: CHART.grid } },
    },
    series: [
      {
        type: "line",
        data: dat.values,
        smooth: true,
        showSymbol: false,
        lineStyle: { color: CHART.teal, width: 2.4 },
        areaStyle: {
          color: {
            type: "linear", x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(63,182,168,0.28)" },
              { offset: 1, color: "rgba(63,182,168,0.02)" },
            ],
          },
        },
      },
    ],
  };

  if (loi) {
    return <EmptyState icon="chart" title="Không tải được dữ liệu" hint={String((loi as Error).message)} />;
  }

  return (
    <div className="screen">
      {/* Dải cảnh báo MOI */}
      {canhBaoMoi.length > 0 && (
        <SectionCard title={`Cảnh báo mới (${canhBaoMoi.length})`} icon="bell">
          <div className="alerts">
            {canhBaoMoi.slice(0, 6).map((c) => (
              <button
                key={c.id}
                className="alert-row"
                onClick={() => c.kenh_id && onChonKenh(c.kenh_id)}
              >
                <MucDoBadge mucDo={c.muc_do} />
                <span className="alert-kenh">{c.kenh_id ? tenKenh.get(c.kenh_id) ?? "—" : "Hệ thống"}</span>
                <span className="alert-noidung">{c.noi_dung ?? c.loai}</span>
              </button>
            ))}
          </div>
        </SectionCard>
      )}

      {/* 4 thẻ KPI */}
      <div className="kpi-grid">
        <KpiCard
          icon="users" tone="gold" label="Tổng người theo dõi"
          value={dangTai ? "…" : soVN(dat.tongFollower)}
          sub={<><DeltaText n={dat.dFollower} /> <span className="muted">/ tuần</span></>}
        />
        <KpiCard
          icon="video" label="Video mới (7 ngày)"
          value={dangTai ? "…" : soVN(dat.videoTuan)}
        />
        <KpiCard
          icon="eye" label="Lượt xem tăng (7 ngày)"
          value={dangTai ? "…" : soGon(dat.viewTuan)}
        />
        <KpiCard
          icon="link" tone="gold" label="Kênh hoạt động"
          value={dangTai ? "…" : `${dat.soKenhHoatDong}/${dat.soKenh}`}
        />
      </div>

      {/* Đường tăng follower toàn chuỗi */}
      <SectionCard title="Người theo dõi toàn chuỗi (12 tuần)" icon="chart">
        {dangTai ? (
          <Loading />
        ) : dat.dates.length === 0 ? (
          <EmptyState
            icon="chart"
            title="Chưa có số liệu"
            hint="Sau khi kết nối 1 kênh và worker chạy sync, đường này sẽ xuất hiện."
          />
        ) : (
          <EChart option={followerOption} height={260} />
        )}
      </SectionCard>

      {/* Ghi chú Phase 1 */}
      <div className="note-p1">
        <Icon name="grid" size={14} />
        Xếp hạng A/B/C/D, Health Score và phân bố theo khu vực sẽ có ở Phase 1.
      </div>
    </div>
  );
}
