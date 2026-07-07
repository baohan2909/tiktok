import { useEffect, useState } from "react";
import { TongQuan } from "./screens/TongQuan";
import { XepHang } from "./screens/XepHang";
import { ChiTietKenh } from "./screens/ChiTietKenh";
import { VideoExplorer } from "./screens/VideoExplorer";
import { CanhBao } from "./screens/CanhBao";
import { BaoCao } from "./screens/BaoCao";
import { PhanTich } from "./screens/PhanTich";
import { HeThong } from "./screens/HeThong";
import { Icon } from "./components/ui";
import { NutCapNhat } from "./components/NutCapNhat";
import { CommandPalette } from "./components/CommandPalette";
import { useSyncLog } from "./hooks/queries";
import { khiNao } from "./lib/format";

type Tab = "tong-quan" | "xep-hang" | "chi-tiet" | "video" | "phan-tich" | "canh-bao" | "bao-cao" | "he-thong";

const TABS = [
  { id: "tong-quan", ten: "Tổng quan", icon: "chart", mota: "Toàn cảnh chuỗi kênh" },
  { id: "xep-hang", ten: "Xếp hạng", icon: "users", mota: "Health Score & hạng tuần" },
  { id: "chi-tiet", ten: "Chi tiết kênh", icon: "grid", mota: "Hồ sơ từng kênh" },
  { id: "video", ten: "Video", icon: "video", mota: "Kho video toàn hệ thống" },
  { id: "phan-tich", ten: "Phân tích", icon: "bulb", mota: "Vì sao thắng — yếu tố & DNA" },
  { id: "canh-bao", ten: "Cảnh báo", icon: "bell", mota: "Bất thường cần xử lý" },
  { id: "bao-cao", ten: "Báo cáo", icon: "doc", mota: "Báo cáo tuần tự động" },
  { id: "he-thong", ten: "Hệ thống", icon: "link", mota: "Kết nối & vận hành" },
] as const;

// Nhóm menu sidebar (desktop) — bố cục admin console.
const NHOM: { ten: string; ids: Tab[] }[] = [
  { ten: "Theo dõi", ids: ["tong-quan", "xep-hang", "chi-tiet"] },
  { ten: "Phân tích", ids: ["video", "phan-tich", "bao-cao"] },
  { ten: "Vận hành", ids: ["canh-bao", "he-thong"] },
];

// Chip trạng thái dữ liệu: lần thu thập gần nhất. gon=true cho mobile (bỏ chữ "Dữ liệu:").
function ChipDuLieu({ gon = false }: { gon?: boolean }) {
  const log = useSyncLog(1);
  const cuoi = log.data?.[0]?.bat_dau ?? null;
  const phut = cuoi ? (Date.now() - new Date(cuoi).getTime()) / 60000 : Infinity;
  const tone = phut < 90 ? "ok" : phut < 24 * 60 ? "cham" : "cu";
  return (
    <span className={`chip-dulieu ${tone}`} title="Lần thu thập số liệu gần nhất">
      <span className="chip-dot" /> {gon ? khiNao(cuoi) : <>Dữ liệu: {khiNao(cuoi)}</>}
    </span>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("tong-quan");
  const [kenhId, setKenhId] = useState<number | undefined>(undefined);
  const [paletteMo, setPaletteMo] = useState(false);

  const chonKenh = (id: number) => {
    setKenhId(id);
    setTab("chi-tiet");
  };

  // Ctrl+K / Cmd+K mở bảng lệnh.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteMo((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const tabHienTai = TABS.find((t) => t.id === tab)!;

  const menuItem = (t: (typeof TABS)[number]) => (
    <button
      key={t.id}
      className={tab === t.id ? "side-item active" : "side-item"}
      onClick={() => setTab(t.id as Tab)}
    >
      <Icon name={t.icon} size={16} />
      <span>{t.ten}</span>
    </button>
  );

  return (
    <div className="app shell">
      {/* Sidebar (desktop) */}
      <aside className="side">
        <div className="side-brand">
          <span className="brand-mark">NS</span>
          <div>
            <div className="brand-t">Command Center</div>
            <div className="brand-s">Nón Sơn · TikTok</div>
          </div>
        </div>
        <nav className="side-nav">
          {NHOM.map((n) => (
            <div key={n.ten} className="side-group">
              <div className="side-h">{n.ten}</div>
              {n.ids.map((id) => menuItem(TABS.find((t) => t.id === id)!))}
            </div>
          ))}
        </nav>
        <div className="side-foot">
          <ChipDuLieu />
        </div>
      </aside>

      {/* Cột nội dung */}
      <div className="main-col">
        <header className="topbar">
          <div className="topbar-in">
            <div className="brand only-mobile">
              <span className="brand-mark sm">NS</span>
            </div>
            <div className="page-title">
              <h1>{tabHienTai.ten}</h1>
              <span className="page-sub">{tabHienTai.mota}</span>
            </div>
            <div className="topbar-act">
              <span className="only-mobile"><ChipDuLieu gon /></span>
              <button className="btn-ghost" onClick={() => setPaletteMo(true)} title="Tìm nhanh (Ctrl+K)">
                <Icon name="search" size={15} />
                <span className="btn-ghost-t">Tìm nhanh</span>
                <span className="kbd">Ctrl K</span>
              </button>
              <NutCapNhat />
            </div>
          </div>
          {/* Tabs cuộn ngang (mobile) */}
          <nav className="tabs only-mobile">
            {TABS.map((t) => (
              <button key={t.id} className={tab === t.id ? "tab active" : "tab"} onClick={() => setTab(t.id as Tab)}>
                <Icon name={t.icon} size={15} /> {t.ten}
              </button>
            ))}
          </nav>
        </header>

        <main className="content">
          {tab === "tong-quan" && <TongQuan onChonKenh={chonKenh} />}
          {tab === "xep-hang" && <XepHang onChonKenh={chonKenh} />}
          {tab === "chi-tiet" && <ChiTietKenh kenhId={kenhId} setKenhId={setKenhId} />}
          {tab === "video" && <VideoExplorer onChonKenh={chonKenh} />}
          {tab === "phan-tich" && <PhanTich />}
          {tab === "canh-bao" && <CanhBao onChonKenh={chonKenh} />}
          {tab === "bao-cao" && <BaoCao onChonKenh={chonKenh} />}
          {tab === "he-thong" && <HeThong />}
        </main>
      </div>

      <CommandPalette
        mo={paletteMo}
        dong={() => setPaletteMo(false)}
        tabs={TABS}
        onTab={(id) => setTab(id as Tab)}
        onChonKenh={chonKenh}
      />
    </div>
  );
}
