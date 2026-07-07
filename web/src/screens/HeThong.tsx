import { useMemo } from "react";
import { useKenhs, useSyncLog } from "../hooks/queries";
import { KpiCard, SectionCard, EmptyState, Loading, TrangThaiKenh, Icon } from "../components/ui";
import { soVN, khiNao } from "../lib/format";

export function HeThong() {
  const kenhs = useKenhs();
  const syncLog = useSyncLog(15);

  const dem = useMemo(() => {
    const list = kenhs.data ?? [];
    const by = (tt: string) => list.filter((k) => k.trang_thai === tt).length;
    return {
      tong: list.length,
      hoatDong: by("HOAT_DONG"),
      chuaKetNoi: by("CHUA_KET_NOI"),
      tokenLoi: by("TOKEN_LOI"),
      tamNgung: by("TAM_NGUNG"),
    };
  }, [kenhs.data]);

  const theoKhuVuc = useMemo(() => {
    const m = new Map<string, { hoatDong: number; tong: number }>();
    for (const k of kenhs.data ?? []) {
      const kv = k.khu_vuc ?? "Chưa phân vùng";
      const cur = m.get(kv) ?? { hoatDong: 0, tong: 0 };
      cur.tong++;
      if (k.trang_thai === "HOAT_DONG") cur.hoatDong++;
      m.set(kv, cur);
    }
    return [...m.entries()].sort((a, b) => b[1].tong - a[1].tong);
  }, [kenhs.data]);

  const lanCuoi = syncLog.data?.[0] ?? null;

  if (kenhs.isLoading) return <Loading />;

  return (
    <div className="screen">
      <div className="kpi-grid">
        <KpiCard icon="link" tone="teal" label="Đã kết nối" value={`${dem.hoatDong}/${dem.tong}`} />
        <KpiCard icon="link" label="Chưa kết nối" value={soVN(dem.chuaKetNoi)} />
        <KpiCard icon="bell" tone="gold" label="Lỗi token" value={soVN(dem.tokenLoi)} />
        <KpiCard icon="refresh" label="Sync gần nhất" value={<span className="fs-sm">{khiNao(lanCuoi?.bat_dau ?? null)}</span>} />
      </div>

      {/* Tiến độ theo khu vực */}
      <SectionCard title="Tiến độ kết nối theo khu vực" icon="grid">
        {theoKhuVuc.length === 0 ? (
          <EmptyState icon="link" title="Chưa có kênh" />
        ) : (
          <div className="prog-list">
            {theoKhuVuc.map(([kv, s]) => (
              <div key={kv} className="prog-row">
                <span className="prog-name">{kv}</span>
                <div className="prog-bar"><div className="prog-fill" style={{ width: `${s.tong ? (s.hoatDong / s.tong) * 100 : 0}%` }} /></div>
                <span className="prog-num mono">{s.hoatDong}/{s.tong}</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Nhật ký sync */}
      <SectionCard title="Nhật ký thu thập (observability)" icon="refresh">
        {(syncLog.data ?? []).length === 0 ? (
          <EmptyState icon="refresh" title="Chưa có lần sync nào" />
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Bắt đầu</th><th className="r">OK</th><th className="r">Lỗi</th><th className="r">Thời lượng</th></tr>
              </thead>
              <tbody>
                {(syncLog.data ?? []).map((s) => {
                  const dur = s.bat_dau && s.ket_thuc
                    ? Math.round((new Date(s.ket_thuc).getTime() - new Date(s.bat_dau).getTime()) / 1000)
                    : null;
                  return (
                    <tr key={s.id}>
                      <td className="mut nowrap">{khiNao(s.bat_dau)}</td>
                      <td className="r">{soVN(s.so_kenh_ok)}</td>
                      <td className="r">{(s.so_kenh_loi ?? 0) > 0 ? <span className="d-down">{s.so_kenh_loi}</span> : "0"}</td>
                      <td className="r mut">{dur == null ? "—" : dur + "s"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <div className="note-p1">
        <Icon name="grid" size={14} />
        Danh sách kênh trạng thái: {dem.hoatDong} <TrangThaiKenh tt="HOAT_DONG" />, {dem.tokenLoi} <TrangThaiKenh tt="TOKEN_LOI" />.
      </div>
    </div>
  );
}
