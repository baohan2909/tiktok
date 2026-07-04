import { useState } from "react";
import { TongQuan } from "./screens/TongQuan";
import { XepHang } from "./screens/XepHang";
import { ChiTietKenh } from "./screens/ChiTietKenh";
import { VideoExplorer } from "./screens/VideoExplorer";
import { CanhBao } from "./screens/CanhBao";
import { BaoCao } from "./screens/BaoCao";
import { HeThong } from "./screens/HeThong";
import { Icon } from "./components/ui";

type Tab = "tong-quan" | "xep-hang" | "chi-tiet" | "video" | "canh-bao" | "bao-cao" | "he-thong";

const TABS = [
  { id: "tong-quan", ten: "Tổng quan", icon: "chart" },
  { id: "xep-hang", ten: "Xếp hạng", icon: "users" },
  { id: "chi-tiet", ten: "Chi tiết kênh", icon: "grid" },
  { id: "video", ten: "Video", icon: "video" },
  { id: "canh-bao", ten: "Cảnh báo", icon: "bell" },
  { id: "bao-cao", ten: "Báo cáo", icon: "doc" },
  { id: "he-thong", ten: "Hệ thống", icon: "link" },
] as const;

export default function App() {
  const [tab, setTab] = useState<Tab>("tong-quan");
  const [kenhId, setKenhId] = useState<number | undefined>(undefined);

  const chonKenh = (id: number) => {
    setKenhId(id);
    setTab("chi-tiet");
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">NS</span>
          <div>
            <div className="brand-t">TikTok Command Center</div>
            <div className="brand-s">Nón Sơn · Phase 1</div>
          </div>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "tab active" : "tab"} onClick={() => setTab(t.id)}>
            <Icon name={t.icon} size={15} /> {t.ten}
          </button>
        ))}
      </nav>

      <main className="content">
        {tab === "tong-quan" && <TongQuan onChonKenh={chonKenh} />}
        {tab === "xep-hang" && <XepHang onChonKenh={chonKenh} />}
        {tab === "chi-tiet" && <ChiTietKenh kenhId={kenhId} setKenhId={setKenhId} />}
        {tab === "video" && <VideoExplorer onChonKenh={chonKenh} />}
        {tab === "canh-bao" && <CanhBao onChonKenh={chonKenh} />}
        {tab === "bao-cao" && <BaoCao onChonKenh={chonKenh} />}
        {tab === "he-thong" && <HeThong />}
      </main>
    </div>
  );
}
