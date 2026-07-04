import { useMemo, useState } from "react";
import { useBaoCaoTuan } from "../hooks/queries";
import { KpiCard, DeltaText, SectionCard, EmptyState, Loading, HangBadge, Icon } from "../components/ui";
import { soVN, soGon, ngayGon } from "../lib/format";
import type { BaoCaoTuan } from "../lib/types";

const NHAN_TEN: Record<string, string> = {
  LIVE_CUT: "Cắt live", REVIEW: "Review", TREND: "Trend", BTS: "Hậu trường", KHAC: "Khác", CHUA: "Chưa gán",
};

function kyTuan(bc: BaoCaoTuan): string {
  const { tu, den } = bc.du_lieu.ky;
  const nam = den.slice(0, 4);
  return `${ngayGon(tu)} – ${ngayGon(den)}/${nam}`;
}

export function BaoCao({ onChonKenh }: { onChonKenh: (id: number) => void }) {
  const baoCao = useBaoCaoTuan(12);
  const [tuan, setTuan] = useState<string>("");

  const list = baoCao.data ?? [];
  const bc = useMemo(() => list.find((b) => b.tuan === tuan) ?? list[0], [list, tuan]);

  if (baoCao.isLoading) return <Loading />;
  if (baoCao.error) {
    return <EmptyState icon="doc" title="Không tải được báo cáo" hint={String((baoCao.error as Error).message)} />;
  }
  if (!bc) {
    return (
      <div className="screen">
        <EmptyState
          icon="doc"
          title="Chưa có báo cáo tuần"
          hint="Báo cáo tự động chạy sáng thứ 2 hàng tuần. Có thể chạy tay workflow 'bao-cao-tuan' để tạo ngay."
        />
      </div>
    );
  }

  const d = bc.du_lieu;
  const h = d.he_thong;
  const tt = bc.tom_tat;

  return (
    <div className="screen">
      {/* Chọn tuần */}
      <SectionCard
        title="Báo cáo tuần"
        icon="doc"
        right={
          <select className="select sm" value={bc.tuan} onChange={(e) => setTuan(e.target.value)}>
            {list.map((b) => (
              <option key={b.tuan} value={b.tuan}>{kyTuan(b)}</option>
            ))}
          </select>
        }
      >
        <div className="bc-ky">Kỳ báo cáo: <strong>{kyTuan(bc)}</strong></div>

        {/* Nhận định điều hành (Claude) */}
        {tt ? (
          <div className="bc-tomtat">
            <div className="bc-tieude">{tt.tieu_de}</div>
            {tt.diem_nhan?.length > 0 && (
              <ul className="bc-bullets">
                {tt.diem_nhan.map((x, i) => (<li key={i}>{x}</li>))}
              </ul>
            )}
            {tt.nhan_dinh && <p className="bc-nhandinh">{tt.nhan_dinh}</p>}
            {tt.khuyen_nghi?.length > 0 && (
              <>
                <div className="bc-sub-h">Khuyến nghị tuần tới</div>
                <ul className="bc-bullets teal">
                  {tt.khuyen_nghi.map((x, i) => (<li key={i}>{x}</li>))}
                </ul>
              </>
            )}
          </div>
        ) : (
          <div className="note-p1">
            <Icon name="doc" size={14} />
            Nhận định đang được tạo (worker Claude chạy sáng thứ 2). Số liệu bên dưới đã sẵn sàng.
          </div>
        )}
      </SectionCard>

      {/* KPI hệ thống + so tuần trước */}
      <div className="kpi-grid">
        <KpiCard
          icon="users" tone="gold" label="Người theo dõi tăng"
          value={soVN(h.follower_tang)}
          sub={<><DeltaText n={h.follower_tang - h.follower_tang_truoc} /> <span className="muted">so tuần trước</span></>}
        />
        <KpiCard
          icon="video" label="Video mới"
          value={soVN(h.video_moi)}
          sub={<><DeltaText n={h.video_moi - h.video_moi_truoc} /> <span className="muted">so tuần trước</span></>}
        />
        <KpiCard
          icon="eye" label="Lượt xem tăng"
          value={soGon(h.view_tang)}
          sub={<><DeltaText n={h.view_tang - h.view_tang_truoc} /> <span className="muted">so tuần trước</span></>}
        />
        <KpiCard
          icon="bell" tone="gold" label="Cảnh báo mới"
          value={soVN(d.canh_bao?.moi ?? 0)}
          sub={<span className="muted">{d.canh_bao?.khan ?? 0} khẩn · {d.canh_bao?.chu_y ?? 0} chú ý</span>}
        />
      </div>

      {/* Phân bố hạng */}
      <SectionCard title="Phân bố hạng" icon="chart">
        <div className="bc-hangs">
          {(["A", "B", "C", "D"] as const).map((k) => (
            <div key={k} className="bc-hang">
              <HangBadge d={k === "A" ? 90 : k === "B" ? 70 : k === "C" ? 55 : 40} />
              <span className="bc-hang-n">{d.phan_hang?.[k] ?? 0}</span>
            </div>
          ))}
          <span className="muted bc-hang-note">{d.phan_hang?.tong ?? 0} kênh xếp hạng</span>
        </div>
      </SectionCard>

      {/* Top kênh */}
      {d.top_kenh?.length > 0 && (
        <SectionCard title="Top kênh trong tuần" icon="users">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th>#</th><th>Kênh</th><th>Khu vực</th><th className="r">Điểm</th><th>Hạng</th></tr>
              </thead>
              <tbody>
                {d.top_kenh.map((k, i) => {
                  const bd = k.hang != null && k.hang_truoc != null ? k.hang_truoc - k.hang : 0;
                  return (
                    <tr key={k.kenh_id} className="clickable" onClick={() => onChonKenh(k.kenh_id)}>
                      <td className="mut nowrap">
                        {i + 1}
                        {bd > 0 && <span className="d-up"> ▲{bd}</span>}
                        {bd < 0 && <span className="d-down"> ▼{-bd}</span>}
                      </td>
                      <td className="v-title"><span className="v-txt">{k.ten}</span></td>
                      <td className="mut nowrap">{k.khu_vuc ?? "—"}</td>
                      <td className="r">{k.d_tong != null ? Number(k.d_tong).toFixed(0) : "—"}</td>
                      <td><HangBadge d={k.d_tong} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* Bứt phá */}
      {d.but_pha?.length > 0 && (
        <SectionCard title="Bứt phá hạng" icon="chart">
          <div className="alerts">
            {d.but_pha.map((b) => (
              <button key={b.kenh_id} className="alert-row" onClick={() => onChonKenh(b.kenh_id)}>
                <span className="d-up nowrap">▲{b.tang}</span>
                <span className="alert-kenh">{b.ten}</span>
                <span className="alert-noidung">hạng {b.hang_truoc} → {b.hang}</span>
              </button>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Video nổi bật */}
      {d.video_noi_bat?.length > 0 && (
        <SectionCard title="Video nổi bật (nhân rộng)" icon="video">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Kênh</th><th>Video</th><th className="r">View tuần</th></tr>
              </thead>
              <tbody>
                {d.video_noi_bat.map((v) => (
                  <tr key={v.video_id}>
                    <td className="nowrap">
                      <button className="link" onClick={() => onChonKenh(v.kenh_id)}>{v.ten_kenh}</button>
                    </td>
                    <td className="v-title">
                      {v.nhan && <span className="nhan">{NHAN_TEN[v.nhan] ?? v.nhan}</span>}
                      {v.share_url ? (
                        <a className="v-txt link" href={v.share_url} target="_blank" rel="noreferrer">{v.tieu_de || "(không tiêu đề)"}</a>
                      ) : (
                        <span className="v-txt">{v.tieu_de || "(không tiêu đề)"}</span>
                      )}
                    </td>
                    <td className="r d-up">+{soGon(v.view_tang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* Kênh ngừng đăng */}
      {d.ngung_dang?.length > 0 && (
        <SectionCard title={`Cần nhắc đăng bài (${d.ngung_dang.length})`} icon="bell">
          <div className="alerts">
            {d.ngung_dang.map((k) => (
              <button key={k.kenh_id} className="alert-row" onClick={() => onChonKenh(k.kenh_id)}>
                <span className="alert-kenh">{k.ten}</span>
                <span className="alert-noidung">{k.noi_dung ?? "ngừng đăng"}</span>
              </button>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Theo khu vực */}
      {d.theo_khu_vuc?.length > 0 && (
        <SectionCard title="Theo khu vực" icon="grid">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Khu vực</th><th className="r">Kênh</th><th className="r">Follower</th><th className="r">Điểm TB</th></tr>
              </thead>
              <tbody>
                {d.theo_khu_vuc.map((r) => (
                  <tr key={r.khu_vuc}>
                    <td>{r.khu_vuc}</td>
                    <td className="r">{r.so_kenh}</td>
                    <td className="r">{soGon(r.follower)}</td>
                    <td className="r">{r.diem_tb != null ? Number(r.diem_tb).toFixed(0) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* Nội dung theo nhãn */}
      {d.theo_nhan && Object.keys(d.theo_nhan).length > 0 && (
        <SectionCard title="Video theo nhãn nội dung" icon="video">
          <div className="bc-nhans">
            {Object.entries(d.theo_nhan)
              .sort((a, b) => b[1] - a[1])
              .map(([k, n]) => (
                <div key={k} className="bc-nhan">
                  <span className="nhan">{NHAN_TEN[k] ?? k}</span>
                  <span className="bc-nhan-n">{n}</span>
                </div>
              ))}
          </div>
        </SectionCard>
      )}

      <div className="note-p1">
        <Icon name="doc" size={14} />
        Báo cáo dựng tự động mỗi thứ 2 từ số liệu tuần (thứ 2 – chủ nhật). Số liệu do Postgres tính, nhận định do Claude viết.
      </div>
    </div>
  );
}
