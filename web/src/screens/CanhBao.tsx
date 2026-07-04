import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCanhBao, useKenhs, datTrangThaiCanhBao } from "../hooks/queries";
import { SectionCard, EmptyState, Loading, MucDoBadge, Icon } from "../components/ui";
import { ngayDay } from "../lib/format";

const LOAI_TEN: Record<string, string> = {
  NGUNG_DANG: "Ngừng đăng", FOLLOWER_KHUNG: "Follower bất thường", ER_GIAM: "ER giảm",
  VIDEO_BUNG_NO: "Video bùng nổ", TOKEN_SAP_HET: "Token sắp hết", TOKEN_LOI: "Lỗi token",
  SYNC_FAIL: "Sync lỗi",
};

export function CanhBao({ onChonKenh }: { onChonKenh: (id: number) => void }) {
  const qc = useQueryClient();
  const canhBao = useCanhBao();
  const kenhs = useKenhs();
  const [loc, setLoc] = useState<"TAT_CA" | "MOI" | "KHAN">("MOI");

  const tenKenh = useMemo(() => {
    const m = new Map<number, string>();
    for (const k of kenhs.data ?? []) m.set(k.id, k.username ? "@" + k.username : k.ma_ch);
    return m;
  }, [kenhs.data]);

  const ds = useMemo(() => {
    let list = canhBao.data ?? [];
    if (loc === "MOI") list = list.filter((c) => c.trang_thai === "MOI");
    if (loc === "KHAN") list = list.filter((c) => c.muc_do === "KHAN" && c.trang_thai !== "DA_XU_LY");
    return list;
  }, [canhBao.data, loc]);

  async function dat(id: number, tt: string) {
    await datTrangThaiCanhBao(id, tt);
    await qc.invalidateQueries({ queryKey: ["canh_bao"] });
  }

  if (canhBao.isLoading) return <Loading />;

  const dem = {
    moi: (canhBao.data ?? []).filter((c) => c.trang_thai === "MOI").length,
    khan: (canhBao.data ?? []).filter((c) => c.muc_do === "KHAN" && c.trang_thai !== "DA_XU_LY").length,
  };

  return (
    <div className="screen">
      <SectionCard
        title="Hộp cảnh báo"
        icon="bell"
        right={
          <div className="filters">
            {([["MOI", `Mới (${dem.moi})`], ["KHAN", `Khẩn (${dem.khan})`], ["TAT_CA", "Tất cả"]] as const).map(
              ([v, t]) => (
                <button key={v} className={loc === v ? "chip active" : "chip"} onClick={() => setLoc(v)}>{t}</button>
              ),
            )}
          </div>
        }
      >
        {ds.length === 0 ? (
          <EmptyState icon="bell" title="Không có cảnh báo" hint="Cron quét bất thường mỗi đêm sẽ đưa cảnh báo vào đây." />
        ) : (
          <div className="alerts">
            {ds.map((c) => (
              <div key={c.id} className={`alert-card ${c.trang_thai === "DA_XU_LY" ? "done" : ""}`}>
                <div className="alert-top">
                  <MucDoBadge mucDo={c.muc_do} />
                  <span className="alert-loai">{LOAI_TEN[c.loai] ?? c.loai}</span>
                  {c.kenh_id && (
                    <button className="alert-kenh link" onClick={() => onChonKenh(c.kenh_id!)}>
                      {tenKenh.get(c.kenh_id) ?? "kênh " + c.kenh_id}
                    </button>
                  )}
                  <span className="alert-time mut">{ngayDay(c.phat_hien_luc)}</span>
                </div>
                <div className="alert-body">{c.noi_dung ?? c.loai}</div>
                <div className="alert-actions">
                  {c.trang_thai === "MOI" && (
                    <button className="btn-mini" onClick={() => dat(c.id, "DA_XEM")}>Đã xem</button>
                  )}
                  {c.trang_thai !== "DA_XU_LY" && (
                    <button className="btn-mini ok" onClick={() => dat(c.id, "DA_XU_LY")}>Đã xử lý</button>
                  )}
                  {c.trang_thai === "DA_XU_LY" && <span className="mut sm"><Icon name="chart" size={12} /> Đã xử lý</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
