// ============================================================
// NS TIKTOK COMMAND CENTER — cấu hình công khai (an toàn để nhúng web).
// SUPABASE_ANON_KEY & TIKTOK_CLIENT_KEY là khóa công khai; RLS bảo vệ dữ liệu.
// Ưu tiên biến môi trường VITE_* khi build; nếu không có thì dùng hằng dưới đây.
// ============================================================
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? "https://dosfidaqatczisbjtpls.supabase.co";

// Khóa publishable (sb_publishable_...) hoặc anon (eyJ...) của project.
export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? "PASTE_ANON_OR_PUBLISHABLE_KEY";

// Client key của TikTok app (ID công khai).
export const TIKTOK_CLIENT_KEY =
  import.meta.env.VITE_TIKTOK_CLIENT_KEY ?? "PASTE_TIKTOK_CLIENT_KEY";

// Redirect URI đã đăng ký với TikTok (Edge Function oauth-callback).
export const OAUTH_REDIRECT_URI = `${SUPABASE_URL}/functions/v1/oauth-callback`;

// Scopes xin quyền (chỉ đọc số liệu công khai).
export const TIKTOK_SCOPES = "user.info.basic,user.info.profile,user.info.stats,video.list";

// Endpoint consent của TikTok.
export const TIKTOK_AUTHORIZE_URL = "https://www.tiktok.com/v2/auth/authorize/";
