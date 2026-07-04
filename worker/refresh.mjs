// ============================================================
// NS TIKTOK COMMAND CENTER — worker/refresh.mjs
// Chỉ trigger Edge Function oauth-refresh (logic + Vault nằm trong Supabase).
// env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. Không cần dependency.
// ============================================================
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Thieu SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const res = await fetch(`${SUPABASE_URL}/functions/v1/oauth-refresh`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${SERVICE_ROLE}`,
    "Content-Type": "application/json",
  },
});

const text = await res.text();
console.log("oauth-refresh HTTP", res.status, text);

if (!res.ok) process.exit(1);
