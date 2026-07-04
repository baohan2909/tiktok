// ============================================================
// NS TIKTOK COMMAND CENTER — worker/sync.mjs
// Chạy trên GitHub Actions (Node 22). Thu thập snapshot mỗi kênh HOAT_DONG.
// env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (service role, bỏ qua RLS).
// Không dùng TikTok client key — mỗi kênh dùng access_token riêng.
// ============================================================
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Thieu SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const USERINFO =
  "https://open.tiktokapis.com/v2/user/info/?fields=open_id,follower_count,following_count,likes_count,video_count";
const VIDEO_FIELDS =
  "id,create_time,title,video_description,duration,cover_image_url,share_url,view_count,like_count,comment_count,share_count";
const VIDEO_LIST = "https://open.tiktokapis.com/v2/video/list/?fields=" + VIDEO_FIELDS;

const MAX_PAGES = 10;       // trần an toàn ~200 video/kênh
const CUA_SO_NGAY = 35;     // theo dõi video đăng trong ~35 ngày gần nhất
const CONCURRENCY = 8;      // tôn trọng rate-limit TikTok

// Ngày theo giờ VN (YYYY-MM-DD)
function ngayVN() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
}

// Pool chạy song song có giới hạn
async function pool(items, size, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function run() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, run));
  return out;
}

const laLoiToken = (code) => typeof code === "string" && /token|auth|scope|login/i.test(code);

async function syncKenh(k, ngay) {
  const H = { Authorization: `Bearer ${k.access_token}` };

  // 1) user info -> snapshot kênh
  const uRes = await fetch(USERINFO, { headers: H });
  if (uRes.status === 401) throw { auth: true, msg: "user/info HTTP 401" };
  const uJson = await uRes.json().catch(() => ({}));
  const u = uJson?.data?.user;
  if (!u) {
    const code = uJson?.error?.code;
    if (laLoiToken(code)) throw { auth: true, msg: "user/info " + code };
    throw { auth: false, msg: "user/info: " + JSON.stringify(uJson?.error ?? uJson).slice(0, 200) };
  }
  // Thiếu scope user.info.stats: TikTok trả user chỉ có open_id, các *_count vắng.
  // Không ghi snapshot NULL im lặng -> coi là lỗi để có cảnh báo.
  if (u.follower_count == null) {
    throw { auth: false, msg: "user/info thieu scope stats (khong co follower_count)" };
  }
  const e0 = (await sb.from("tk_snapshot_kenh").upsert({
    kenh_id: k.kenh_id,
    ngay,
    follower: u.follower_count ?? null,
    following: u.following_count ?? null,
    tong_like: u.likes_count ?? null,
    so_video: u.video_count ?? null,
  }, { onConflict: "kenh_id,ngay" })).error;
  if (e0) throw { auth: false, msg: "upsert snapshot_kenh: " + e0.message };

  // 2) video list (phân trang cursor tới khi ra ngoài cửa sổ theo dõi)
  const videos = [];
  const gioiHanCreate = Math.floor(Date.now() / 1000) - CUA_SO_NGAY * 86400;
  let cursor, page = 0;
  while (page < MAX_PAGES) {
    const body = { max_count: 20 };
    if (cursor) body.cursor = cursor;
    const vRes = await fetch(VIDEO_LIST, {
      method: "POST",
      headers: { ...H, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (vRes.status === 401) throw { auth: true, msg: "video/list HTTP 401" };
    const vJson = await vRes.json().catch(() => ({}));
    const list = vJson?.data?.videos;
    if (!Array.isArray(list)) {
      const code = vJson?.error?.code;
      if (laLoiToken(code)) throw { auth: true, msg: "video/list " + code };
      // error.code khác 'ok' = lỗi tạm thời (rate_limit/internal...) -> tính là lỗi, không nuốt
      if (code && code !== "ok") throw { auth: false, msg: "video/list " + code };
      break; // thật sự không có video (data.videos = [])
    }
    videos.push(...list);
    cursor = vJson.data.cursor;
    page++;
    // dừng khi hết trang, hoặc video cũ nhất trang này đã ra ngoài cửa sổ theo dõi
    const minCreate = list.reduce((m, v) => Math.min(m, v.create_time ?? Infinity), Infinity);
    if (!vJson.data.has_more || minCreate < gioiHanCreate) break;
    if (page === MAX_PAGES) console.log(`  (kenh ${k.kenh_id}: cham tran ${MAX_PAGES} trang video)`);
  }

  // 3) upsert video + snapshot video
  if (videos.length) {
    const rowsV = videos.map((v) => ({
      video_id: String(v.id),
      kenh_id: k.kenh_id,
      dang_luc: new Date((v.create_time ?? 0) * 1000).toISOString(),
      tieu_de: v.title ?? null,
      mo_ta: v.video_description ?? null,
      thoi_luong_s: v.duration ?? null,
      cover_url: v.cover_image_url ?? null,
      share_url: v.share_url ?? null,
      // KHÔNG đụng nhan / nhan_nguon để giữ nhãn phân loại
    }));
    const e1 = (await sb.from("tk_video").upsert(rowsV, { onConflict: "video_id" })).error;
    if (e1) throw { auth: false, msg: "upsert video: " + e1.message };

    const rowsS = videos.map((v) => ({
      video_id: String(v.id),
      ngay,
      luot_xem: v.view_count ?? null,
      luot_thich: v.like_count ?? null,
      binh_luan: v.comment_count ?? null,
      chia_se: v.share_count ?? null,
    }));
    const e2 = (await sb.from("tk_snapshot_video").upsert(rowsS, { onConflict: "video_id,ngay" })).error;
    if (e2) throw { auth: false, msg: "upsert snapshot_video: " + e2.message };
  }

  return videos.length;
}

async function main() {
  const batDau = new Date().toISOString();
  const ngay = ngayVN();

  const { data: kenhs, error } = await sb.rpc("get_kenh_can_sync");
  if (error) {
    console.error("RPC get_kenh_can_sync loi:", error.message);
    process.exit(1);
  }
  if (!kenhs?.length) {
    console.log("Khong co kenh HOAT_DONG con token. Ket thuc.");
    await sb.from("tk_sync_log").insert({
      bat_dau: batDau, ket_thuc: new Date().toISOString(),
      so_kenh_ok: 0, so_kenh_loi: 0, chi_tiet_loi: [],
    });
    return;
  }

  console.log(`Bat dau sync ${kenhs.length} kenh, ngay ${ngay}`);
  const results = await pool(kenhs, CONCURRENCY, async (k) => {
    try {
      const n = await syncKenh(k, ngay);
      console.log(`  OK kenh ${k.kenh_id}: ${n} video`);
      return { kenh_id: k.kenh_id, ok: true };
    } catch (e) {
      const msg = (e?.msg ?? String(e)).slice(0, 300);
      console.error(`  LOI kenh ${k.kenh_id}: ${msg}`);
      if (e?.auth) {
        await sb.rpc("oauth_bao_loi_token", { p_kenh_id: k.kenh_id, p_loi: msg });
      }
      return { kenh_id: k.kenh_id, ok: false, loi: msg };
    }
  });

  const ok = results.filter((r) => r.ok).length;
  const loi = results.length - ok;
  const chiTiet = results.filter((r) => !r.ok).map((r) => ({ kenh_id: r.kenh_id, loi: r.loi }));

  await sb.from("tk_sync_log").insert({
    bat_dau: batDau,
    ket_thuc: new Date().toISOString(),
    so_kenh_ok: ok,
    so_kenh_loi: loi,
    chi_tiet_loi: chiTiet,
  });

  console.log(`Xong: ${ok} OK, ${loi} loi.`);
  if (loi > 0 && ok === 0) process.exit(1); // toàn bộ fail -> đỏ workflow
}

main().catch((e) => {
  console.error("Sync sup do:", e);
  process.exit(1);
});
