// ============================================================
// NS TIKTOK COMMAND CENTER — Edge Function: trigger-sync
// Dashboard bấm nút "Cập nhật dữ liệu ngay" -> gọi hàm này -> dispatch workflow
// `sync` trên GitHub Actions. Deploy với Verify JWT = OFF (được gọi từ trình duyệt).
// Bảo vệ: debounce phía server (RPC xin_trigger_sync) chống spam; CORS cho web.
// Secrets cần đặt trong Supabase: GH_DISPATCH_TOKEN (fine-grained PAT, quyền Actions:write
//   trên repo). Tuỳ chọn: GH_REPO (mặc định baohan2909/tiktok), GH_WORKFLOW (sync.yml).
// (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY được Supabase tự cấp.)
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GH_TOKEN = Deno.env.get("GH_DISPATCH_TOKEN");
const GH_REPO = Deno.env.get("GH_REPO") ?? "baohan2909/tiktok";
const GH_WORKFLOW = Deno.env.get("GH_WORKFLOW") ?? "sync.yml";
// Chỉ chấp nhận request từ dashboard (chống lạm dụng từ web khác). Đổi được qua env.
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "https://baohan2909.github.io")
  .split(",").map((s) => s.trim()).filter(Boolean);

function originOk(req: Request): boolean {
  const o = req.headers.get("origin") ?? "";
  if (!o) return false;                       // trình duyệt luôn gửi Origin khi POST khác origin
  if (o.startsWith("http://localhost")) return true;
  return ALLOWED_ORIGINS.includes(o);
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, ly_do: "method" }, 405);
  if (!originOk(req)) return json({ ok: false, ly_do: "origin khong hop le" }, 403);
  if (!GH_TOKEN) return json({ ok: false, ly_do: "GH_DISPATCH_TOKEN chua cau hinh" }, 500);

  // Debounce phía server: từ chối nếu vừa kích hoạt < 120s trước.
  const { data: allowed, error } = await sb.rpc("xin_trigger_sync", { p_cooldown_giay: 120 });
  if (error) return json({ ok: false, ly_do: error.message }, 500);
  if (!allowed) {
    return json({ ok: false, ly_do: "cooldown", thong_bao: "Vừa cập nhật gần đây, thử lại sau ~2 phút." }, 429);
  }

  // Dispatch workflow `sync` (GitHub trả 204 khi thành công).
  const res = await fetch(
    `https://api.github.com/repos/${GH_REPO}/actions/workflows/${GH_WORKFLOW}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GH_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "ns-tiktok-command-center",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: "main" }),
    },
  );

  if (res.status !== 204) {
    const t = (await res.text().catch(() => "")).slice(0, 300);
    return json({ ok: false, ly_do: `github ${res.status}: ${t}` }, 502);
  }
  return json({ ok: true, thong_bao: "Đã kích hoạt cập nhật. Dữ liệu về sau ~1–2 phút." });
});
