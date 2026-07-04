// ============================================================
// NS TIKTOK COMMAND CENTER — trang kết quả kết nối (oauth-callback redirect về đây)
// Đọc ?ok=1&ch=&handle=  hoặc  ?ok=0&msg=  và hiển thị an toàn (textContent).
// ============================================================
const p = new URLSearchParams(location.search);
const ok = p.get("ok") === "1";
const ch = (p.get("ch") ?? "").trim();
const handle = (p.get("handle") ?? "").trim();
const msg = (p.get("msg") ?? "").trim();

const badge = document.getElementById("badge") as HTMLElement;
const icOk = document.getElementById("ic-ok") as HTMLElement;
const icErr = document.getElementById("ic-err") as HTMLElement;
const title = document.getElementById("title") as HTMLElement;
const msgEl = document.getElementById("msg") as HTMLElement;
const handleEl = document.getElementById("handle") as HTMLElement;

function setTitle(before: string, gold: string): void {
  title.textContent = "";
  title.append(document.createTextNode(before + " "));
  const s = document.createElement("span");
  s.className = "gold";
  s.textContent = gold;
  title.append(s);
}

if (ok) {
  icOk.style.display = "";
  icErr.style.display = "none";
  badge.classList.remove("err");
  setTitle("Kết nối", "thành công");
  msgEl.textContent = ch
    ? `Cửa hàng ${ch} đã liên kết với hệ thống.`
    : "Đã liên kết với hệ thống.";
  if (handle) {
    handleEl.textContent = "@" + handle;
    handleEl.style.display = "";
  }
  const done = document.createElement("p");
  done.style.marginTop = "16px";
  done.textContent = "Bạn có thể đóng tab này.";
  msgEl.after(done);
} else {
  icOk.style.display = "none";
  icErr.style.display = "";
  badge.classList.add("err");
  setTitle("Kết nối", "chưa thành công");
  msgEl.textContent = msg || "Vui lòng thử lại link kết nối, hoặc liên hệ quản trị viên.";
}
