// ============================================================
// NS TIKTOK COMMAND CENTER — Edge Function: oauth-refresh
// GitHub Actions (refresh-tokens.yml) gọi mỗi 01h VN.
// Deploy với Verify JWT = OFF; tự kiểm tra header x-refresh-secret == REFRESH_SECRET.
// Refresh mọi access_token đang hoạt động; cập nhật Vault nếu có refresh_token mới.
// Secrets cần đặt trong Supabase: TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, REFRESH_SECRET.
// (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY được Supabase tự cấp.)
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLIENT_KEY = Deno.env.get("TIKTOK_CLIENT_KEY")!;
const CLIENT_SECRET = Deno.env.get("TIKTOK_CLIENT_SECRET")!;
const REFRESH_SECRET = Deno.env.get("REFRESH_SECRET");
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  // Chỉ chấp nhận request mang đúng REFRESH_SECRET (GitHub Actions gửi kèm header).
  if (!REFRESH_SECRET) return json({ error: "REFRESH_SECRET chua duoc cau hinh" }, 500);
  const provided = req.headers.get("x-refresh-secret") ?? "";
  if (provided !== REFRESH_SECRET) return json({ error: "unauthorized" }, 401);

  const { data: ds, error } = await sb.rpc("oauth_ds_can_refresh");
  if (error) return json({ error: error.message }, 500);

  let ok = 0;
  let loi = 0;
  const chi_tiet: Array<{ kenh_id: number; loi: string }> = [];

  for (const row of (ds ?? []) as Array<{ kenh_id: number; refresh_token: string }>) {
    try {
      const res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_key: CLIENT_KEY,
          client_secret: CLIENT_SECRET,
          grant_type: "refresh_token",
          refresh_token: row.refresh_token,
        }),
      });
      const tok = await res.json().catch(() => ({}));

      if (!tok?.access_token) {
        const m = String(tok?.error_description ?? tok?.error ?? "no_access_token").slice(0, 300);
        await sb.rpc("oauth_bao_loi_token", { p_kenh_id: row.kenh_id, p_loi: m });
        loi++; chi_tiet.push({ kenh_id: row.kenh_id, loi: m });
        continue;
      }

      await sb.rpc("oauth_cap_nhat_token", {
        p_kenh_id: row.kenh_id,
        p_access_token: tok.access_token,
        p_access_expires_in: tok.expires_in ?? 86400,
        p_refresh_token: tok.refresh_token ?? null,
        p_refresh_expires_in: tok.refresh_expires_in ?? null,
      });
      ok++;
    } catch (e) {
      const m = String(e).slice(0, 300);
      await sb.rpc("oauth_bao_loi_token", { p_kenh_id: row.kenh_id, p_loi: m });
      loi++; chi_tiet.push({ kenh_id: row.kenh_id, loi: m });
    }
  }

  // Quét cảnh báo refresh_token sắp hết hạn (<30 ngày)
  await sb.rpc("oauth_canh_bao_token_sap_het");

  return json({ ok, loi, tong: (ds ?? []).length, chi_tiet });
});
