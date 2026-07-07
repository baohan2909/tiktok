import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { useBaoCaoTuan, useKenhs, useDiemTuan, useMetricsKhoang } from "../hooks/queries";
import { EChart, CHART, AXIS_TEXT } from "../components/EChart";
import { KpiCard, DeltaText, SectionCard, EmptyState, Loading, HangBadge, Icon } from "../components/ui";
import { soVN, soGon, ngayGon, NHAN_TEN, capHang } from "../lib/format";
import { taiCSV } from "../lib/csv";
import type { BaoCaoTuan, DiemTuan } from "../lib/types";

function kyTuan(bc: BaoCaoTuan): string {
  const { tu, den } = bc.du_lieu.ky;
  const nam = den.slice(0, 4);
  return `${ngayGon(tu)} – ${ngayGon(den)}/${nam}`;
}

type SortCot = "diem" | "follower" | "video" | "view" | "ten";

export function BaoCao({ onChonKenh }: { onChonKenh: (id: number) => void }) {
  const baoCao = useBaoCaoTuan(12);
  const [tuan, setTuan] = useState<string>("");

  const list = baoCao.data ?? [];
  const bc = useMemo(() => list.find((b) => b.tuan === tuan) ?? list[0], [list, tuan]);

  // Dữ liệu bảng chi tiết từng kênh của tuần đang xem.
  const kenhs = useKenhs();
  const diem = useDiemTuan(13);
  const metrics = useMetricsKhoang(bc?.du_lieu.ky.tu, bc?.du_lieu.ky.den);

  const [timKiem, setTimKiem] = useState("");
  const [loKhuVuc, setLoKhuVuc] = useState("");
  const [sortCot, setSortCot] = useState<SortCot>("diem");
  const [sortTang, setSortTang] = useState(false);

  // Gộp metric 7 ngày -> 1 dòng/kênh + ghép điểm tuần này/tuần trước.
  const kenhRows = useMemo(() => {
    if (!bc) return [];
    const gop = new Map<number, { fol: number; vid: number; view: number }>();
    for (const r of metrics.data ?? []) {
      const cur = gop.get(r.kenh_id) ?? { fol: 0, vid: 0, view: 0 };
      cur.fol += r.follower_tang ?? 0;
      cur.vid += Number(r.video_moi ?? 0);
      cur.view += Number(r.xem_tang ?? 0);
      gop.set(r.kenh_id, cur);
    }
    const dTuan = new Map<number, DiemTuan>();
    const dTruoc = new Map<number, DiemTuan>();
    for (const dd of diem.data ?? []) {
      if (dd.tuan === bc.tuan) dTuan.set(dd.kenh_id, dd);
      if (dd.tuan === bc.du_lieu.ky.tuan_truoc) dTruoc.set(dd.kenh_id, dd);
    }
    const q = timKiem.trim().toLowerCase();
    const chieu = sortTang ? 1 : -1;
    return (kenhs.data ?? [])
      .filter((k) => gop.has(k.id) || dTuan.has(k.id)) // chỉ kênh có hoạt động/điểm trong tuần
      .map((k) => {
        const g = gop.get(k.id) ?? { fol: 0, vid: 0, view: 0 };
        const dd = dTuan.get(k.id);
        const dp = dTruoc.get(k.id);
        return {
          k,
          ten: k.username ? "@" + k.username : k.ma_ch,
          ...g,
          d_tong: dd?.d_tong ?? null,
          hang: dd?.hang ?? null,
          bienDong: dd?.hang != null && dp?.hang != null ? dp.hang - dd.hang : 0,
        };
      })
      .filter((r) => !loKhuVuc || r.k.khu_vuc === loKhuVuc)
      .filter((r) => !q || `${r.ten} ${r.k.ma_ch} ${r.k.ten_ch}`.toLowerCase().includes(q))
      .sort((a, b) => {
        if (sortCot === "ten") return chieu * a.ten.localeCompare(b.ten);
        if (sortCot === "follower") return chieu * (a.fol - b.fol);
        if (sortCot === "video") return chieu * (a.vid - b.vid);
        if (sortCot === "view") return chieu * (a.view - b.view);
        return chieu * ((a.d_tong ?? -1) - (b.d_tong ?? -1));
      });
  }, [bc, metrics.data, diem.data, kenhs.data, timKiem, loKhuVuc, sortCot, sortTang]);

  function datSort(cot: SortCot) {
    if (sortCot === cot) setSortTang((v) => !v);
    else { setSortCot(cot); setSortTang(cot === "ten"); }
  }
  const muiTen = (cot: SortCot) => (sortCot === cot ? (sortTang ? " ▲" : " ▼") : "");

  function xuatCSV() {
    if (!bc) return;
    taiCSV(
      `bao-cao-tuan-${bc.tuan}.csv`,
      ["Kênh", "Mã CH", "Khu vực", "Follower tăng", "Video mới", "View tăng", "Điểm", "Hạng", "Thứ hạng"],
      kenhRows.map((r) => [
        r.ten, r.k.ma_ch, r.k.khu_vuc ?? "", r.fol, r.vid, r.view,
        r.d_tong != null ? Number(r.d_tong).toFixed(0) : "",
        capHang(r.d_tong), // chữ A/B/C/D — khớp cột Hạng trên màn hình
        r.hang ?? "",
      ]),
    );
  }

  // Xu hướng qua các tuần đã có báo cáo (cũ -> mới).
  const xuHuong = useMemo(() => {
    const arr = list.slice().reverse();
    return {
      nhan: arr.map((b) => ngayGon(b.tuan)),
      fol: arr.map((b) => b.du_lieu.he_thong.follower_tang),
      vid: arr.map((b) => b.du_lieu.he_thong.video_moi),
      view: arr.map((b) => b.du_lieu.he_thong.view_tang),
    };
  }, [list]);

  const xuHuongOption: EChartsOption = {
    grid: { left: 6, right: 6, top: 30, bottom: 6, containLabel: true },
    legend: { data: ["Follower tăng", "Video mới", "View tăng"], textStyle: { color: CHART.mut, fontSize: 11 }, top: 0, icon: "roundRect" },
    tooltip: { trigger: "axis", backgroundColor: "#0E1626", borderColor: CHART.line, textStyle: { color: CHART.ink }, valueFormatter: (v) => soVN(v as number) },
    xAxis: {
      type: "category", data: xuHuong.nhan, boundaryGap: true,
      axisLabel: { ...AXIS_TEXT }, axisLine: { lineStyle: { color: CHART.line } }, axisTick: { show: false },
    },
    yAxis: [
      { type: "value", axisLabel: { ...AXIS_TEXT, formatter: (v: number) => soGon(v) }, splitLine: { lineStyle: { color: CHART.grid } } },
      { type: "value", axisLabel: { ...AXIS_TEXT, formatter: (v: number) => soGon(v) }, splitLine: { show: false } },
    ],
    series: [
      { name: "Follower tăng", type: "bar", data: xuHuong.fol, itemStyle: { color: CHART.gold, borderRadius: [4, 4, 0, 0] }, barMaxWidth: 26 },
      { name: "Video mới", type: "bar", data: xuHuong.vid, itemStyle: { color: "#5C6E8A", borderRadius: [4, 4, 0, 0] }, barMaxWidth: 26 },
      { name: "View tăng", type: "line", yAxisIndex: 1, data: xuHuong.view, smooth: true, showSymbol: xuHuong.nhan.length < 10, lineStyle: { color: CHART.teal, width: 2.2 }, itemStyle: { color: CHART.teal } },
    ],
  };

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
      {/* Tiêu đề khi in / lưu PDF */}
      <div className="only-print print-head">
        <div className="print-t">BÁO CÁO TUẦN — NS TIKTOK COMMAND CENTER</div>
        <div className="print-s">Kỳ {kyTuan(bc)} · Nón Sơn · xuất lúc {new Date().toLocaleString("vi-VN")}</div>
      </div>

      {/* Chọn tuần + hành động */}
      <SectionCard
        title="Báo cáo tuần"
        icon="doc"
        right={
          <div className="filters">
            <select className="select sm" value={bc.tuan} onChange={(e) => setTuan(e.target.value)}>
              {list.map((b) => (
                <option key={b.tuan} value={b.tuan}>{kyTuan(b)}</option>
              ))}
            </select>
            <button className="btn-mini" onClick={() => window.print()} title="In hoặc lưu PDF để gửi">
              <Icon name="doc" size={13} /> In / PDF
            </button>
          </div>
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

      {/* Xu hướng qua các tuần */}
      {list.length >= 2 && (
        <SectionCard title={`Xu hướng ${list.length} tuần gần nhất`} icon="chart">
          <EChart option={xuHuongOption} height={240} />
        </SectionCard>
      )}

      {/* Bảng chi tiết từng kênh (tìm kiếm + sort + CSV) */}
      <SectionCard
        title={`Chi tiết từng kênh (${kenhRows.length})`}
        icon="users"
        right={
          <div className="filters">
            <input
              className="inp sm vx-search" type="search" placeholder="Tìm kênh / mã CH..."
              value={timKiem} onChange={(e) => setTimKiem(e.target.value)}
            />
            <select className="select sm" value={loKhuVuc} onChange={(e) => setLoKhuVuc(e.target.value)}>
              <option value="">Mọi khu vực</option>
              {[...new Set((kenhs.data ?? []).map((k) => k.khu_vuc).filter(Boolean))].map((kv) => (
                <option key={kv as string} value={kv as string}>{kv}</option>
              ))}
            </select>
            <button className="btn-mini" onClick={xuatCSV} title="Tải bảng này về Excel">
              <Icon name="download" size={13} /> CSV
            </button>
          </div>
        }
      >
        {metrics.error || diem.error || kenhs.error ? (
          <EmptyState title="Không tải được số liệu chi tiết"
            hint="Kiểm tra mạng rồi bấm Tải lại — đừng dùng bảng/CSV này khi đang lỗi (số sẽ thiếu)." />
        ) : metrics.isLoading ? (
          <Loading />
        ) : kenhRows.length === 0 ? (
          <EmptyState title="Không có kênh khớp" hint="Tuần này chưa có hoạt động, hoặc đổi từ khóa/bộ lọc." />
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="th-sort" onClick={() => datSort("ten")}>Kênh{muiTen("ten")}</th>
                  <th>Khu vực</th>
                  <th className="r th-sort" onClick={() => datSort("follower")}>Δ Follower{muiTen("follower")}</th>
                  <th className="r th-sort" onClick={() => datSort("video")}>Video{muiTen("video")}</th>
                  <th className="r th-sort" onClick={() => datSort("view")}>Δ View{muiTen("view")}</th>
                  <th className="r th-sort" onClick={() => datSort("diem")}>Điểm{muiTen("diem")}</th>
                  <th>Hạng</th>
                </tr>
              </thead>
              <tbody>
                {kenhRows.map((r) => (
                  <tr key={r.k.id} className="clickable" onClick={() => onChonKenh(r.k.id)}>
                    <td className="v-title">
                      <span className="v-txt">{r.ten}</span>
                      {r.bienDong > 0 && <span className="d-up sm"> ▲{r.bienDong}</span>}
                      {r.bienDong < 0 && <span className="d-down sm"> ▼{-r.bienDong}</span>}
                    </td>
                    <td className="mut nowrap">{r.k.khu_vuc ?? "—"}</td>
                    <td className="r"><DeltaText n={r.fol} /></td>
                    <td className="r">{soVN(r.vid)}</td>
                    <td className="r">{r.view > 0 ? "+" + soGon(r.view) : soGon(r.view)}</td>
                    <td className="r">{r.d_tong != null ? Number(r.d_tong).toFixed(0) : "—"}</td>
                    <td><HangBadge d={r.d_tong} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

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
        Báo cáo dựng tự động mỗi thứ 2 từ số liệu tuần (thứ 2 – chủ nhật). Bấm "In / PDF" để lưu bản gửi đi; bảng chi tiết xuất được CSV.
      </div>
    </div>
  );
}
