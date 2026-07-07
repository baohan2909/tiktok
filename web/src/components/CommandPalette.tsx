import { useEffect, useMemo, useRef, useState } from "react";
import { useKenhs } from "../hooks/queries";
import { Icon, TrangThaiKenh } from "./ui";

export interface LenhTab { id: string; ten: string }

// Bảng lệnh Ctrl+K: gõ để tìm kênh (nhảy thẳng hồ sơ) hoặc chuyển màn hình.
export function CommandPalette({ mo, dong, tabs, onTab, onChonKenh }: {
  mo: boolean;
  dong: () => void;
  tabs: readonly LenhTab[];
  onTab: (id: string) => void;
  onChonKenh: (id: number) => void;
}) {
  const kenhs = useKenhs();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mo) {
      setQ("");
      setSel(0);
      window.setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [mo]);

  // Esc đóng được cả khi focus rời khỏi ô nhập (bấm vào nền panel...).
  useEffect(() => {
    if (!mo) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") dong(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mo, dong]);

  // Danh sách kết quả: kênh khớp trước, rồi tới màn hình.
  // So khớp bỏ khoảng trắng để "vo van" vẫn tìm ra "vovanngan".
  const items = useMemo(() => {
    const qq = q.trim().toLowerCase().replace(/\s+/g, "");
    const ketQua: { loai: "kenh" | "tab"; id: number | string; ten: string; phu?: string; tt?: string }[] = [];
    const list = kenhs.data ?? [];
    const kenhKhop = (qq
      ? list.filter((k) =>
          `${k.username ?? ""} ${k.ma_ch} ${k.ten_ch} ${k.khu_vuc ?? ""}`.toLowerCase().replace(/\s+/g, "").includes(qq))
      : list
    ).slice(0, 8);
    for (const k of kenhKhop) {
      ketQua.push({
        loai: "kenh", id: k.id,
        ten: k.username ? "@" + k.username : k.ma_ch,
        phu: `${k.ma_ch}${k.khu_vuc ? " · " + k.khu_vuc : ""}`,
        tt: k.trang_thai,
      });
    }
    for (const t of tabs) {
      if (!qq || t.ten.toLowerCase().replace(/\s+/g, "").includes(qq)) {
        ketQua.push({ loai: "tab", id: t.id, ten: t.ten, phu: "Chuyển màn hình" });
      }
    }
    return ketQua.slice(0, 12);
  }, [q, kenhs.data, tabs]);

  useEffect(() => { setSel(0); }, [q]);

  function chay(i: number) {
    const it = items[i];
    if (!it) return;
    if (it.loai === "kenh") onChonKenh(it.id as number);
    else onTab(it.id as string);
    dong();
  }

  if (!mo) return null;

  return (
    <div className="pal-ovl" onClick={dong}>
      <div className="pal" onClick={(e) => e.stopPropagation()}>
        <div className="pal-head">
          <Icon name="search" size={16} />
          <input
            ref={inputRef}
            className="pal-inp"
            placeholder="Tìm kênh, mã cửa hàng, màn hình…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, items.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
              else if (e.key === "Enter") { e.preventDefault(); chay(sel); }
              else if (e.key === "Escape") { e.preventDefault(); dong(); }
            }}
          />
          <span className="pal-kbd">Esc</span>
        </div>
        <div className="pal-list">
          {items.length === 0 ? (
            <div className="pal-empty">
              {kenhs.isLoading
                ? "Đang tải danh sách kênh…"
                : kenhs.error
                  ? "Không tải được danh sách kênh — kiểm tra mạng rồi thử lại."
                  : `Không có kết quả cho “${q}”.`}
            </div>
          ) : (
            items.map((it, i) => (
              <button
                key={it.loai + String(it.id)}
                className={`pal-item ${i === sel ? "on" : ""}`}
                onMouseEnter={() => setSel(i)}
                onClick={() => chay(i)}
              >
                <span className="pal-ic"><Icon name={it.loai === "kenh" ? "users" : "grid"} size={15} /></span>
                <span className="pal-ten">{it.ten}</span>
                {it.phu && <span className="pal-phu">{it.phu}</span>}
                {it.tt && <TrangThaiKenh tt={it.tt} />}
              </button>
            ))
          )}
        </div>
        <div className="pal-foot">↑↓ chọn · Enter mở · Ctrl+K bật/tắt</div>
      </div>
    </div>
  );
}
