// ============================================================
// NS TIKTOK COMMAND CENTER — worker/refresh.mjs
// Chỉ trigger Edge Function oauth-refresh (logic + Vault nằm trong Supabase).
// env: SUPABASE_URL, REFRESH_SECRET. Không cần dependency.
// ============================================================
const SUPABASE_URL = process.env.SUPABASE_URL;
const REFRESH_SECRET = process.env.REFRESH_SECRET;
if (!SUPABASE_URL || !REFRESH_SECRET) {
  console.error("Thieu SUPABASE_URL / REFRESH_SECRET");
  process.exit(1);
}

const res = await fetch(`${SUPABASE_URL}/functions/v1/oauth-refresh`, {
  method: "POST",
  headers: {
    "x-refresh-secret": REFRESH_SECRET,
    "Content-Type": "application/json",
  },
});

const text = await res.text();
console.log("oauth-refresh HTTP", res.status, text);

if (!res.ok) process.exit(1);
