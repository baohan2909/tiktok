// ============================================================
// NS TIKTOK COMMAND CENTER — Edge Function: oauth-callback
// TikTok redirect về đây (GET ?code&state). Deploy với Verify JWT = OFF.
// Xử lý logic rồi REDIRECT (302) về trang kết quả tĩnh trên GitHub Pages
// (Supabase ép text/plain trên *.supabase.co nên không render HTML tại đây).
// Secrets cần: TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET.
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

// Trang kết quả tĩnh (render HTML thật trên tên miền của mình)
const KET_QUA_URL = "https://baohan2909.github.io/tiktok/ket-noi.html";

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

function veTrangKetQua(params: Record<string, string>): Response {
  const u = new URL(KET_QUA_URL);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return Response.redirect(u.toString(), 302);
}

const thanhCong = (ch: string, handle: string) =>
  veTrangKetQua({ ok: "1", ch, handle });
const thatBai = (msg: string) => veTrangKetQua({ ok: "0", msg });

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oerr = url.searchParams.get("error");

  if (oerr) return thatBai(`TikTok tu choi: ${oerr}`);
  if (!code || !state) return thatBai("Thieu tham so code hoac state.");

  // 1) verify state (chống CSRF) rồi dùng một lần
  const { data: stateRow, error: stErr } = await sb
    .from("tk_oauth_state").select("ma_ch").eq("state", state).maybeSingle();
  if (stErr) return thatBai("Loi doc state: " + stErr.message);
  if (!stateRow) return thatBai("State khong hop le hoac da het han. Hay mo lai link ket noi.");
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
    return thatBai("Doi code lay token that bai: " + (tok?.error_description ?? tok?.error ?? "khong ro"));
  }

  // 3) lấy profile (username) để hiển thị + lưu handle
  let username: string | null = null;
  let displayName: string | null = null;
  try {
    const infoRes = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${tok.access_token}` } });
    const info = await infoRes.json();
    const u = info?.data?.user;
    if (u) { username = u.username ?? null; displayName = u.display_name ?? null; }
  } catch (_) { /* profile là phụ */ }

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
  if (rpcErr) return thatBai("Luu ket noi that bai: " + rpcErr.message);

  return thanhCong(maCh, username ?? displayName ?? "");
});
