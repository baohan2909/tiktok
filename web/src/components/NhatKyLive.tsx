import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useKenhLive, themPhienLive } from "../hooks/queries";
import { SectionCard, EmptyState, Loading } from "./ui";
import { soVN, ngayDay, isoNgayTruoc } from "../lib/format";

// Giờ HH:MM[:SS] -> HH:MM (bỏ giây cho gọn)
function gioGon(t: string | null): string {
  return t ? t.slice(0, 5) : "—";
}

export function NhatKyLive({ kenhId, trangThai }: { kenhId?: number; trangThai?: string }) {
  const qc = useQueryClient();
  const live = useKenhLive(kenhId);
  // 006_metrics chỉ chấm điểm kênh HOAT_DONG/TOKEN_LOI -> live kênh khác lưu nhưng chưa tính.
  const duocChamDiem = trangThai === "HOAT_DONG" || trangThai === "TOKEN_LOI";

  const [mo, setMo] = useState(false);
  const [ngay, setNgay] = useState("");
  const [gio, setGio] = useState("");
  const [phut, setPhut] = useState("");
  const [dinh, setDinh] = useState("");
  const [ghiChu, setGhiChu] = useState("");
  const [dangGui, setDangGui] = useState(false);
  const [loi, setLoi] = useState("");

  async function gui(e: FormEvent) {
    e.preventDefault();
    if (kenhId == null) return;
    if (!ngay) { setLoi("Chọn ngày live."); return; }
    // Cột int trong DB: ép số nguyên + chặn số âm (đừng dựa vào min= của HTML).
    const phutN = phut === "" ? null : Math.round(Number(phut));
    const dinhN = dinh === "" ? null : Math.round(Number(dinh));
    if (phutN != null && (!Number.isFinite(phutN) || phutN < 0)) {
      setLoi("Thời lượng phải là số nguyên ≥ 0 (phút)."); return;
    }
    if (dinhN != null && (!Number.isFinite(dinhN) || dinhN < 0)) {
      setLoi("Người xem đỉnh phải là số nguyên ≥ 0."); return;
    }
    setDangGui(true);
    setLoi("");
    try {
      await themPhienLive({
        kenh_id: kenhId,
        ngay,
        gio_bat_dau: gio || null,
        thoi_luong_phut: phutN,
        nguoi_xem_dinh: dinhN,
        ghi_chu: ghiChu.trim() || null,
      });
      await qc.invalidateQueries({ queryKey: ["kenh_live", kenhId] });
      setNgay(""); setGio(""); setPhut(""); setDinh(""); setGhiChu("");
      setMo(false);
    } catch (err) {
      setLoi("Không lưu được: " + String((err as Error).message));
    } finally {
      setDangGui(false);
    }
  }

  const rows = live.data ?? [];
  const soGio = (p: number) => Math.round((p / 60) * 10) / 10;
  const tongPhut = rows.reduce((a, r) => a + (r.thoi_luong_phut ?? 0), 0);
  const moc7 = isoNgayTruoc(7);
  const phut7 = rows.filter((r) => r.ngay >= moc7).reduce((a, r) => a + (r.thoi_luong_phut ?? 0), 0);

  return (
    <SectionCard
      title="Nhật ký Live"
      icon="video"
      right={
        <button className="btn-mini ok" onClick={() => setMo((v) => !v)} disabled={kenhId == null}>
          {mo ? "Đóng" : "+ Thêm phiên"}
        </button>
      }
    >
      {mo && (
        <form className="live-form" onSubmit={gui}>
          <div className="live-grid">
            <label className="live-field">
              <span>Ngày *</span>
              <input className="inp" type="date" value={ngay} onChange={(e) => setNgay(e.target.value)} required />
            </label>
            <label className="live-field">
              <span>Giờ bắt đầu</span>
              <input className="inp" type="time" value={gio} onChange={(e) => setGio(e.target.value)} />
            </label>
            <label className="live-field">
              <span>Thời lượng (phút)</span>
              <input className="inp" type="number" min={0} step={1} inputMode="numeric" value={phut}
                onChange={(e) => setPhut(e.target.value)} placeholder="vd 90" />
            </label>
            <label className="live-field">
              <span>Người xem đỉnh</span>
              <input className="inp" type="number" min={0} step={1} inputMode="numeric" value={dinh}
                onChange={(e) => setDinh(e.target.value)} placeholder="vd 350" />
            </label>
            <label className="live-field wide">
              <span>Ghi chú</span>
              <input className="inp" type="text" maxLength={200} value={ghiChu}
                onChange={(e) => setGhiChu(e.target.value)} placeholder="vd: bán mẫu MC249F, khuyến mãi..." />
            </label>
          </div>
          {!duocChamDiem && (
            <div className="live-luuy">Kênh chưa ở trạng thái Hoạt động — phiên vẫn lưu nhưng chưa tính vào điểm Live.</div>
          )}
          {loi && <div className="live-loi">{loi}</div>}
          <div className="live-actions">
            <button className="btn-mini ok" type="submit" disabled={dangGui}>
              {dangGui ? "Đang lưu..." : "Lưu phiên live"}
            </button>
            <span className="mut sm">Trụ Live chấm theo giờ live trong 7 ngày gần nhất (cron 02:15).</span>
          </div>
        </form>
      )}

      {live.isLoading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="video"
          title="Chưa có phiên live"
          hint="Bấm '+ Thêm phiên' để khai báo buổi live. Số liệu này nuôi trụ Live (15đ) của Health Score."
        />
      ) : (
        <>
          <div className="live-sum mut">
            {rows.length} phiên · tổng {soGio(tongPhut)} giờ · <strong>{soGio(phut7)} giờ trong 7 ngày</strong> (tính điểm)
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Giờ</th>
                  <th className="r">Phút</th>
                  <th className="r">Xem đỉnh</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="nowrap">{ngayDay(r.ngay + "T00:00:00+07:00")}</td>
                    <td className="mut nowrap">{gioGon(r.gio_bat_dau)}</td>
                    <td className="r">{r.thoi_luong_phut ?? "—"}</td>
                    <td className="r">{soVN(r.nguoi_xem_dinh)}</td>
                    <td className="v-title"><span className="v-txt">{r.ghi_chu ?? "—"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </SectionCard>
  );
}
