// ============================================================
// NS TIKTOK COMMAND CENTER — trang connect (onboarding OAuth)
// Đọc ?ch= -> sinh state ngẫu nhiên -> ghi tk_oauth_state (anon)
// -> chuyển sang màn hình đồng ý của TikTok.
// ============================================================
import "./styles/tokens.css";
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  TIKTOK_CLIENT_KEY,
  OAUTH_REDIRECT_URI,
  TIKTOK_SCOPES,
  TIKTOK_AUTHORIZE_URL,
} from "./lib/config";

const maCh = (new URLSearchParams(location.search).get("ch") ?? "").trim();

const btn = document.getElementById("btn-connect") as HTMLButtonElement;
const chLabel = document.getElementById("ch-label") as HTMLElement;
const errBox = document.getElementById("err") as HTMLElement;

function showErr(msg: string): void {
  errBox.textContent = msg;
  errBox.style.display = "block";
}

function randomState(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Hiển thị mã cửa hàng / chặn nếu thiếu
if (maCh) {
  chLabel.textContent = maCh;
} else {
  chLabel.textContent = "(thiếu mã)";
  btn.disabled = true;
  showErr("Link thiếu mã cửa hàng (?ch=...). Vui lòng dùng đúng link quản trị viên gửi.");
}

btn.addEventListener("click", async () => {
  if (!maCh) return;
  btn.disabled = true;
  btn.textContent = "Đang chuyển tới TikTok...";
  errBox.style.display = "none";

  try {
    const state = randomState();

    // Ghi state để oauth-callback verify (chống CSRF)
    const res = await fetch(`${SUPABASE_URL}/rest/v1/tk_oauth_state`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ state, ma_ch: maCh }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Không tạo được phiên kết nối (${res.status}). ${t}`.trim());
    }

    // Chuyển sang màn hình đồng ý của TikTok
    const url = new URL(TIKTOK_AUTHORIZE_URL);
    url.searchParams.set("client_key", TIKTOK_CLIENT_KEY);
    url.searchParams.set("scope", TIKTOK_SCOPES);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", OAUTH_REDIRECT_URI);
    url.searchParams.set("state", state);
    location.href = url.toString();
  } catch (e) {
    btn.disabled = false;
    btn.textContent = "Kết nối TikTok";
    showErr(e instanceof Error ? e.message : String(e));
  }
});
