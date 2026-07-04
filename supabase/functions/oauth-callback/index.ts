// ============================================================
// NS TIKTOK COMMAND CENTER — Edge Function: oauth-callback
// TikTok redirect về đây (GET ?code&state). Deploy với Verify JWT = OFF.
// Bảo mật bằng verify state (chống CSRF). Vault + ghi DB qua RPC.
// Secrets cần đặt trong Supabase: TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET.
// (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY được Supabase tự cấp.)
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLIENT_KEY = Deno.env.get("TIKTOK_CLIENT_KEY")!;
const CLIENT_SECRET = Deno.env.get("TIKTOK_CLIENT_SECRET")!;
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/oauth-callback`;
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const USERINFO_URL =
  "https://open.tiktokapis.com/v2/user/info/?fields=open_id,avatar_url,display_name,username";

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

// ---------- Giao diện Nón Sơn (không emoji, icon SVG stroke) ----------
function trang(inner: string, status = 200): Response {
  const doc = `<!DOCTYPE html><html lang="vi"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Non Son Analytics — Ket noi TikTok</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#0B1220;--card:#111A2E;--line:#1E2A44;--gold:#CBA45A;--teal:#3FB6A8;--ink:#E6EBF2;--mut:#8FA3BF;--red:#E5635B}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:var(--bg);color:var(--ink);
  font-family:'Be Vietnam Pro',-apple-system,Segoe UI,sans-serif;
  display:flex;align-items:center;justify-content:center;padding:24px}
.card{width:100%;max-width:420px;background:var(--card);border:1px solid var(--line);
  border-radius:18px;padding:36px 28px;text-align:center}
.badge{width:72px;height:72px;border-radius:50%;margin:0 auto 20px;display:flex;
  align-items:center;justify-content:center;border:2px solid var(--teal)}
.badge.err{border-color:var(--red)}
h1{font-family:'Space Grotesk',sans-serif;font-size:1.35rem;letter-spacing:.3px;margin:0 0 6px}
.gold{color:var(--gold)}
p{color:var(--mut);font-size:.95rem;line-height:1.6;margin:6px 0}
.handle{display:inline-block;margin-top:14px;padding:8px 16px;border:1px solid var(--line);
  border-radius:999px;color:var(--teal);font-weight:600}
.avatar{width:64px;height:64px;border-radius:50%;object-fit:cover;margin:0 auto 14px;display:block;border:1px solid var(--line)}
.foot{margin-top:22px;color:#5C6E8A;font-size:.8rem}
code{font-family:'JetBrains Mono',ui-monospace,monospace;color:var(--gold)}
</style></head><body><div class="card">${inner}
<p class="foot">Non Son Analytics</p></div></body></html>`;
  return new Response(doc, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

const ICON_OK = `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#3FB6A8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
const ICON_ERR = `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#E5635B" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`;

function pageThanhCong(maCh: string, handle: string, avatar: string | null): Response {
  // Chỉ nhận avatar là URL https và escape trước khi nhét vào src (chống XSS attribute-injection)
  const safeAvatar = avatar && /^https:\/\//i.test(avatar) ? avatar : null;
  const av = safeAvatar ? `<img class="avatar" src="${escapeHtml(safeAvatar)}" alt="">` : "";
  const hd = handle ? `<div class="handle">@${escapeHtml(handle)}</div>` : "";
  return trang(`
    <div class="badge">${ICON_OK}</div>
    ${av}
    <h1>Ket noi <span class="gold">thanh cong</span></h1>
    <p>Cua hang <code>${escapeHtml(maCh)}</code> da lien ket voi he thong.</p>
    ${hd}
    <p style="margin-top:16px">Ban co the dong tab nay.</p>`);
}

function pageLoi(msg: string, status = 400): Response {
  return trang(`
    <div class="badge err">${ICON_ERR}</div>
    <h1>Ket noi <span class="gold">chua thanh cong</span></h1>
    <p>${escapeHtml(msg)}</p>
    <p style="margin-top:16px">Vui long thu lai link ket noi, hoac lien he quan tri vien.</p>`, status);
}

function escapeHtml(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

// ---------- Handler ----------
Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oerr = url.searchParams.get("error");

  if (oerr) return pageLoi(`TikTok tu choi: ${oerr}`);
  if (!code || !state) return pageLoi("Thieu tham so code hoac state.");

  // 1) verify state (chong CSRF) rồi dùng một lần
  const { data: stateRow, error: stErr } = await sb
    .from("tk_oauth_state").select("ma_ch").eq("state", state).maybeSingle();
  if (stErr) return pageLoi("Loi doc state: " + stErr.message, 500);
  if (!stateRow) return pageLoi("State khong hop le hoac da het han. Hay mo lai link ket noi.");
  await sb.from("tk_oauth_state").delete().eq("state", state);
  const maCh: string = stateRow.ma_ch;

  // 2) đổi code -> token
  const tokRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: CLIENT_KEY,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
    }),
  });
  const tok = await tokRes.json().catch(() => ({}));
  if (!tok?.access_token) {
    return pageLoi("Doi code lay token that bai: " + (tok?.error_description ?? tok?.error ?? "khong ro"));
  }

  // 3) lấy profile (username/avatar) để hiển thị + lưu handle
  let username: string | null = null;
  let displayName: string | null = null;
  let avatar: string | null = null;
  try {
    const infoRes = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    });
    const info = await infoRes.json();
    const u = info?.data?.user;
    if (u) { username = u.username ?? null; displayName = u.display_name ?? null; avatar = u.avatar_url ?? null; }
  } catch (_) { /* profile là phụ, bỏ qua nếu lỗi */ }

  // 4) lưu kênh + Vault + token qua RPC
  const { error: rpcErr } = await sb.rpc("oauth_luu_ket_noi", {
    p_ma_ch: maCh,
    p_open_id: tok.open_id ?? null,
    p_username: username,
    p_access_token: tok.access_token,
    p_access_expires_in: tok.expires_in ?? 86400,
    p_refresh_token: tok.refresh_token ?? "",
    p_refresh_expires_in: tok.refresh_expires_in ?? 31536000,
  });
  if (rpcErr) return pageLoi("Luu ket noi that bai: " + rpcErr.message, 500);

  return pageThanhCong(maCh, username ?? displayName ?? "", avatar);
});
