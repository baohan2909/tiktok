import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { kichHoatSync, laySyncLogMoiNhat } from "../hooks/queries";
import { Icon } from "./ui";

type TT = "idle" | "dang" | "cho" | "xong" | "loi";

// Nút "Cập nhật" trên thanh tiêu đề: bấm 1 phát -> kéo số mới từ TikTok ->
// tự chờ sync xong (poll nhật ký) -> tự tải lại toàn bộ dashboard. Không đụng GitHub.
export function NutCapNhat() {
  const qc = useQueryClient();
  const [tt, setTt] = useState<TT>("idle");
  const [msg, setMsg] = useState("");
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  function xongSau(giay: number) {
    window.setTimeout(() => { setTt("idle"); setMsg(""); }, giay * 1000);
  }

  async function capNhat() {
    if (tt === "dang" || tt === "cho") return;
    setTt("dang");
    setMsg("");
    const truoc = await laySyncLogMoiNhat();
    const kq = await kichHoatSync();

    if (kq.ok) {
      // Đã kích hoạt -> chờ có bản ghi sync MỚI hoàn tất rồi tự tải lại.
      setTt("cho");
      setMsg("Đang lấy số liệu mới nhất… (khoảng 1–2 phút)");
      let lan = 0;
      timer.current = window.setInterval(async () => {
        lan++;
        const moi = await laySyncLogMoiNhat();
        const xong = moi && moi.ket_thuc && (!truoc || moi.id > truoc.id);
        if (xong) {
          if (timer.current) clearInterval(timer.current);
          timer.current = null;
          await qc.invalidateQueries();
          setTt("xong");
          setMsg(`Đã cập nhật xong (${moi.so_kenh_ok ?? 0} kênh).`);
          xongSau(6);
        } else if (lan >= 18) { // ~3 phút vẫn chưa thấy -> tải lại cho chắc rồi thôi
          if (timer.current) clearInterval(timer.current);
          timer.current = null;
          await qc.invalidateQueries();
          setTt("idle");
          setMsg("");
        }
      }, 10000);
    } else if (kq.ly_do === "cooldown") {
      // Vừa cập nhật gần đây -> chỉ cần làm mới số liệu đang có.
      await qc.invalidateQueries();
      setTt("xong");
      setMsg("Đã làm mới số liệu (vừa cập nhật gần đây).");
      xongSau(5);
    } else {
      setTt("loi");
      setMsg("Chưa cập nhật được: " + (kq.ly_do ?? "lỗi không rõ"));
      xongSau(8);
    }
  }

  const dangChay = tt === "dang" || tt === "cho";
  const nhan = dangChay ? "Đang cập nhật…" : tt === "xong" ? "Đã cập nhật" : tt === "loi" ? "Thử lại" : "Cập nhật";

  return (
    <>
      <button className={`btn-capnhat ${tt}`} onClick={capNhat} disabled={dangChay} title="Kéo số liệu mới nhất từ TikTok">
        <span className={dangChay ? "spin" : ""}><Icon name="refresh" size={15} /></span>
        <span className="btn-capnhat-t">{nhan}</span>
      </button>
      {/* Portal ra body: topbar có backdrop-filter sẽ "nhốt" position:fixed của con */}
      {msg && createPortal(<div className={`cn-toast ${tt}`}>{msg}</div>, document.body)}
    </>
  );
}
