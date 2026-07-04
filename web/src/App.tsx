import { useState } from "react";
import { TongQuan } from "./screens/TongQuan";
import { ChiTietKenh } from "./screens/ChiTietKenh";
import { Icon } from "./components/ui";

type Tab = "tong-quan" | "chi-tiet";

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
            <div className="brand-s">Nón Sơn · Phase 0</div>
          </div>
        </div>
      </header>

      <nav className="tabs">
        <button className={tab === "tong-quan" ? "tab active" : "tab"} onClick={() => setTab("tong-quan")}>
          <Icon name="chart" size={16} /> Tổng quan
        </button>
        <button className={tab === "chi-tiet" ? "tab active" : "tab"} onClick={() => setTab("chi-tiet")}>
          <Icon name="grid" size={16} /> Chi tiết kênh
        </button>
      </nav>

      <main className="content">
        {tab === "tong-quan" ? (
          <TongQuan onChonKenh={chonKenh} />
        ) : (
          <ChiTietKenh kenhId={kenhId} setKenhId={setKenhId} />
        )}
      </main>
    </div>
  );
}
