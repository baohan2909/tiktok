import { useMemo, useState } from "react";
import { usePtVideoExplorer } from "../hooks/queries";
import { SectionCard, EmptyState, Loading, Icon } from "../components/ui";
import { soGon, ngayDay, NHAN_TEN } from "../lib/format";
import { taiCSV } from "../lib/csv";
import { GiaiPhauVideo, type VideoMo } from "../components/GiaiPhauVideo";

type SortKey = "xem" | "er" | "moi" | "tocdo";

export function VideoExplorer({ onChonKenh }: { onChonKenh: (id: number) => void }) {
  const [khungNgay, setKhungNgay] = useState(30);
  const vids = usePtVideoExplorer(khungNgay, 400);

  const [timKiem, setTimKiem] = useState("");
  const [loKhuVuc, setLoKhuVuc] = useState("");
  const [loNhan, setLoNhan] = useState("");
  const [minView, setMinView] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("xem");
  const [selVideo, setSelVideo] = useState<VideoMo | null>(null);

  const khuVucs = useMemo(
    () => [...new Set((vids.data ?? []).map((v) => v.khu_vuc).filter(Boolean))] as string[],
    [vids.data],
  );
  const nhans = useMemo(
    () => [...new Set((vids.data ?? []).map((v) => v.nhan).filter(Boolean))] as string[],
    [vids.data],
  );

  const rows = useMemo(() => {
    const q = timKiem.trim().toLowerCase();
    const now = Date.now();
    const tocDo = (v: { xem: number | null; dang_luc: string }) => {
      const ngay = Math.max(1, (now - new Date(v.dang_luc).getTime()) / 86400000);
      return (v.xem ?? 0) / ngay;
    };
    return (vids.data ?? [])
      .filter((v) => !loKhuVuc || v.khu_vuc === loKhuVuc)
      .filter((v) => !loNhan || v.nhan === loNhan)
      .filter((v) => (v.xem ?? 0) >= minView)
      .filter((v) => {
        if (!q) return true;
        const hay = `${v.tieu_de ?? ""} ${v.mo_ta ?? ""} ${v.username ?? ""} ${v.ma_ch ?? ""}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        if (sortKey === "er") return (b.er ?? -1) - (a.er ?? -1);
        if (sortKey === "moi") return a.dang_luc < b.dang_luc ? 1 : -1;
        if (sortKey === "tocdo") return tocDo(b) - tocDo(a);
        return (b.xem ?? 0) - (a.xem ?? 0);
      })
      .slice(0, 100);
  }, [vids.data, loKhuVuc, loNhan, minView, timKiem, sortKey]);

  function xuatCSV() {
    taiCSV(
      `video-${khungNgay}ngay-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Kênh", "Mã CH", "Khu vực", "Tiêu đề", "Nhãn", "Đăng lúc", "Xem", "ER %", "Link"],
      rows.map((v) => [
        v.username ? "@" + v.username : String(v.kenh_id),
        v.ma_ch, v.khu_vuc ?? "",
        (v.tieu_de || v.mo_ta || "").slice(0, 150),
        v.nhan ? (NHAN_TEN[v.nhan] ?? v.nhan) : "",
        ngayDay(v.dang_luc), v.xem ?? "", v.er ?? "", v.share_url ?? "",
      ]),
    );
  }

  if (vids.isLoading) return <Loading />;
  if (vids.error) {
    return (
      <div className="screen">
        <EmptyState icon="video" title="Chưa bật kho video nâng cấp"
          hint="Chạy migration 008_phan_tich.sql trên Supabase để bật Video Explorer sắp xếp theo lượt xem toàn hệ thống." />
      </div>
    );
  }

  return (
    <div className="screen">
      <SectionCard
        title={`Video Explorer (${khungNgay} ngày)`}
        icon="video"
        right={
          <div className="filters">
            <select className="select sm" value={khungNgay} onChange={(e) => setKhungNgay(Number(e.target.value))}>
              <option value={7}>7 ngày</option>
              <option value={30}>30 ngày</option>
              <option value={90}>90 ngày</option>
            </select>
            <select className="select sm" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
              <option value="xem">Xem nhiều nhất</option>
              <option value="tocdo">Tăng nhanh nhất (view/ngày)</option>
              <option value="er">ER cao nhất</option>
              <option value="moi">Mới nhất</option>
            </select>
          </div>
        }
      >
        <div className="filters vx-filters">
          <input
            className="inp sm vx-search" type="search" placeholder="Tìm tiêu đề / kênh / mã CH..."
            value={timKiem} onChange={(e) => setTimKiem(e.target.value)}
          />
          <select className="select sm" value={loKhuVuc} onChange={(e) => setLoKhuVuc(e.target.value)}>
            <option value="">Mọi khu vực</option>
            {khuVucs.map((kv) => (<option key={kv} value={kv}>{kv}</option>))}
          </select>
          <select className="select sm" value={loNhan} onChange={(e) => setLoNhan(e.target.value)}>
            <option value="">Mọi nhãn</option>
            {nhans.map((n) => (<option key={n} value={n}>{NHAN_TEN[n] ?? n}</option>))}
          </select>
          <select className="select sm" value={minView} onChange={(e) => setMinView(Number(e.target.value))}>
            <option value={0}>Mọi view</option>
            <option value={1000}>≥ 1N</option>
            <option value={10000}>≥ 10N</option>
            <option value={100000}>≥ 100N</option>
          </select>
          <button className="btn-mini" onClick={xuatCSV} title="Tải danh sách đang lọc về Excel">
            <Icon name="download" size={13} /> CSV
          </button>
        </div>

        {(vids.data ?? []).length === 0 ? (
          <EmptyState icon="video" title={`Chưa có video trong ${khungNgay} ngày`} hint="Sau khi kênh sync, video mới sẽ xuất hiện ở đây để tìm bài bùng nổ." />
        ) : rows.length === 0 ? (
          <EmptyState title="Không có video khớp bộ lọc" />
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Kênh</th><th>Video</th><th>Nhãn</th><th>Đăng</th><th className="r">Xem</th><th className="r">ER</th></tr>
              </thead>
              <tbody>
                {rows.map((v) => (
                  <tr key={v.video_id} className="clickable" onClick={() => setSelVideo(v)}>
                    <td className="nowrap">
                      <button className="link" onClick={(e) => { e.stopPropagation(); onChonKenh(v.kenh_id); }}>
                        {v.username ? "@" + v.username : "kênh " + v.kenh_id}
                      </button>
                    </td>
                    <td className="v-title"><span className="v-txt">{v.tieu_de || v.mo_ta || v.video_id}</span></td>
                    <td>{v.nhan ? <span className="nhan">{NHAN_TEN[v.nhan] ?? v.nhan}</span> : <span className="mut">—</span>}</td>
                    <td className="mut nowrap">{ngayDay(v.dang_luc)}</td>
                    <td className="r">{soGon(v.xem)}</td>
                    <td className="r">{v.er == null ? "—" : v.er.toFixed(1) + "%"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
      <div className="note-p1"><Icon name="video" size={14} /> Bấm một video để xem giải phẫu: vì sao thắng, so với kênh và toàn hệ thống. Kho xếp theo lượt xem trên cả cửa sổ thời gian.</div>

      {selVideo && (
        <GiaiPhauVideo video={selVideo} onClose={() => setSelVideo(null)} onChonKenh={onChonKenh} />
      )}
    </div>
  );
}
