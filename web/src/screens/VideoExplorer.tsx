import { useMemo, useState } from "react";
import { useVideoExplorer, useVideoSnapshots } from "../hooks/queries";
import { SectionCard, EmptyState, Loading, Icon } from "../components/ui";
import { soGon, ngayDay, tinhER } from "../lib/format";

export function VideoExplorer({ onChonKenh }: { onChonKenh: (id: number) => void }) {
  const vids = useVideoExplorer(30, 500);
  const videoIds = useMemo(() => (vids.data ?? []).map((v) => v.video_id), [vids.data]);
  const snaps = useVideoSnapshots(videoIds);

  const [loKhuVuc, setLoKhuVuc] = useState("");
  const [loNhan, setLoNhan] = useState("");
  const [minView, setMinView] = useState(0);

  const latest = useMemo(() => {
    const m = new Map<string, { xem: number | null; er: number | null }>();
    const byVid = new Map<string, typeof snaps.data>();
    for (const s of snaps.data ?? []) {
      const arr = byVid.get(s.video_id) ?? [];
      arr!.push(s);
      byVid.set(s.video_id, arr);
    }
    for (const [id, arr] of byVid) {
      const ss = (arr ?? []).slice().sort((a, b) => (a.ngay < b.ngay ? -1 : 1));
      const l = ss[ss.length - 1];
      m.set(id, { xem: l?.luot_xem ?? null, er: tinhER(l?.luot_xem ?? null, l?.luot_thich ?? null, l?.binh_luan ?? null, l?.chia_se ?? null) });
    }
    return m;
  }, [snaps.data]);

  const khuVucs = useMemo(
    () => [...new Set((vids.data ?? []).map((v) => v.tk_kenh?.khu_vuc).filter(Boolean))] as string[],
    [vids.data],
  );
  const nhans = useMemo(
    () => [...new Set((vids.data ?? []).map((v) => v.nhan).filter(Boolean))] as string[],
    [vids.data],
  );

  const rows = useMemo(() => {
    return (vids.data ?? [])
      .map((v) => ({ v, l: latest.get(v.video_id) }))
      .filter((r) => !loKhuVuc || r.v.tk_kenh?.khu_vuc === loKhuVuc)
      .filter((r) => !loNhan || r.v.nhan === loNhan)
      .filter((r) => (r.l?.xem ?? 0) >= minView)
      .sort((a, b) => (b.l?.xem ?? 0) - (a.l?.xem ?? 0))
      .slice(0, 100);
  }, [vids.data, latest, loKhuVuc, loNhan, minView]);

  if (vids.isLoading) return <Loading />;

  return (
    <div className="screen">
      <SectionCard
        title="Video Explorer (30 ngày)"
        icon="video"
        right={
          <div className="filters">
            <select className="select sm" value={loKhuVuc} onChange={(e) => setLoKhuVuc(e.target.value)}>
              <option value="">Mọi khu vực</option>
              {khuVucs.map((kv) => (<option key={kv} value={kv}>{kv}</option>))}
            </select>
            <select className="select sm" value={loNhan} onChange={(e) => setLoNhan(e.target.value)}>
              <option value="">Mọi nhãn</option>
              {nhans.map((n) => (<option key={n} value={n}>{n}</option>))}
            </select>
            <select className="select sm" value={minView} onChange={(e) => setMinView(Number(e.target.value))}>
              <option value={0}>Mọi view</option>
              <option value={1000}>≥ 1N</option>
              <option value={10000}>≥ 10N</option>
              <option value={100000}>≥ 100N</option>
            </select>
          </div>
        }
      >
        {(vids.data ?? []).length === 0 ? (
          <EmptyState icon="video" title="Chưa có video trong 30 ngày" hint="Sau khi kênh sync, video mới sẽ xuất hiện ở đây để tìm bài bùng nổ." />
        ) : rows.length === 0 ? (
          <EmptyState title="Không có video khớp bộ lọc" />
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Kênh</th><th>Video</th><th>Nhãn</th><th>Đăng</th><th className="r">Xem</th><th className="r">ER</th></tr>
              </thead>
              <tbody>
                {rows.map(({ v, l }) => (
                  <tr key={v.video_id}>
                    <td className="nowrap">
                      <button className="link" onClick={() => onChonKenh(v.kenh_id)}>
                        {v.tk_kenh?.username ? "@" + v.tk_kenh.username : "kênh " + v.kenh_id}
                      </button>
                    </td>
                    <td className="v-title"><span className="v-txt">{v.tieu_de || v.video_id}</span></td>
                    <td>{v.nhan ? <span className="nhan">{v.nhan}</span> : <span className="mut">—</span>}</td>
                    <td className="mut nowrap">{ngayDay(v.dang_luc)}</td>
                    <td className="r">{soGon(l?.xem)}</td>
                    <td className="r">{l?.er == null ? "—" : l.er.toFixed(1) + "%"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
      <div className="note-p1"><Icon name="video" size={14} /> Lọc để tìm "video bùng nổ tuần này" gửi các cửa hàng học theo.</div>
    </div>
  );
}
