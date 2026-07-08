import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./ui";

// Modal "Thêm kênh mới": nhập mã cửa hàng -> hai cách kết nối.
// 1) "Mở luôn": mở tab kết nối trên máy này (dùng khi tài khoản TikTok đang đăng nhập là kênh cửa hàng).
// 2) "Sao chép link": để gửi cho cửa hàng (Zalo/SMS), họ bấm trên điện thoại đang có TikTok của họ.
export function ThemKenhModal({ mo, dong }: { mo: boolean; dong: () => void }) {
  const [maCH, setMaCH] = useState("");
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mo) {
      setMaCH("");
      setCopied(false);
      window.setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [mo]);

  // Esc đóng
  useEffect(() => {
    if (!mo) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") dong(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mo, dong]);

  if (!mo) return null;

  // Sanitize mã CH: chỉ chữ/số/underscore/dash, chữ HOA.
  const clean = maCH.trim().replace(/[^A-Za-z0-9_-]/g, "").toUpperCase().slice(0, 40);
  const url = clean ? `${window.location.origin}/tiktok/connect.html?ch=${encodeURIComponent(clean)}` : "";

  async function chepLink() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Trình duyệt cũ: chọn text để user Ctrl+C
      const el = document.getElementById("themkenh-url") as HTMLInputElement | null;
      el?.select();
    }
  }

  return createPortal(
    <div className="modal-ovl" onClick={dong}>
      <div className="modal tk-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">
            <div className="tk-tieude">Thêm kênh mới</div>
            <div className="mut sm">Liên kết TikTok của một cửa hàng vào hệ thống theo dõi.</div>
          </div>
          <button className="modal-x" onClick={dong} aria-label="Đóng"><Icon name="x" size={16} /></button>
        </div>

        <div className="tk-body">
          <label className="live-field">
            <span>Mã cửa hàng (chỉ chữ, số, dấu _ hoặc -)</span>
            <input
              ref={inputRef}
              className="inp" type="text" maxLength={40}
              placeholder="vd: NS_CH_03 hoặc NS_QUAN1"
              value={maCH}
              onChange={(e) => setMaCH(e.target.value)}
            />
            <span className="mut sm">Mã này định danh cửa hàng trong hệ thống — đặt sao cho dễ nhớ, không trùng.</span>
          </label>

          {clean && (
            <>
              <div className="tk-sub">Đường dẫn kết nối cho cửa hàng</div>
              <div className="tk-url-row">
                <input id="themkenh-url" className="inp mono" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
                <button className="btn-mini ok" onClick={chepLink}>
                  {copied ? "Đã chép ✓" : "Sao chép"}
                </button>
              </div>

              <div className="tk-cach">
                <div className="tk-cach-item">
                  <div className="tk-num">1</div>
                  <div>
                    <div className="tk-cach-t">Gửi cho cửa hàng qua Zalo</div>
                    <div className="mut sm">Sao chép đường dẫn trên, gửi Zalo cho nhân viên cửa hàng. Họ mở link trên điện thoại đang đăng nhập TikTok của kênh đó, bấm "Kết nối TikTok" → Đồng ý. Xong.</div>
                  </div>
                </div>
                <div className="tk-cach-item">
                  <div className="tk-num">2</div>
                  <div>
                    <div className="tk-cach-t">Kết nối ngay trên máy này</div>
                    <div className="mut sm">Chỉ dùng khi trình duyệt này đang đăng nhập <strong>đúng tài khoản TikTok của cửa hàng</strong>. Sẽ mở tab mới sang trang kết nối.</div>
                    <a className="btn-mini tk-open" href={url} target="_blank" rel="noreferrer">
                      Mở trang kết nối
                    </a>
                  </div>
                </div>
              </div>

              <div className="tk-note">
                <Icon name="bulb" size={13} />
                <span>Đang ở giai đoạn <strong>Sandbox</strong>: chỉ tài khoản TikTok đã được thêm vào <em>Target Users</em> ở TikTok Developer mới đăng nhập được. Sau khi TikTok duyệt (App Review) là dùng cho mọi cửa hàng.</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
