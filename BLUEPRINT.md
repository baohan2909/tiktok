# NS TIKTOK COMMAND CENTER — BẢN THIẾT KẾ KIẾN TRÚC v1.0

> Hệ thống quản trị – phân tích – cảnh báo cho 200+ kênh TikTok của chuỗi Nón Sơn.
> Ràng buộc: chi phí vận hành 0đ (GitHub free + Supabase free). Người vận hành: 1 dev (Aroma), dùng chủ yếu trên iPhone.
> File này là PROJECT BRIEF chính thức. Mọi agent/dev đọc file này trước khi viết bất kỳ dòng code nào.

---

## 0. NGUYÊN TẮC THIẾT KẾ

1. **Snapshot-first**: TikTok API chỉ trả số liệu tại thời điểm gọi, không có webhook. Toàn bộ giá trị của hệ thống nằm ở việc chụp snapshot đều đặn → tính delta → dựng chuỗi thời gian. DB là nguồn sự thật, TikTok chỉ là nguồn thô.
2. **So sánh nội bộ**: 200 kênh cùng ngành, cùng sản phẩm → mọi đánh giá dùng percentile nội bộ (P25/P50/P75/P95 của chính hệ thống), không so với benchmark bên ngoài.
3. **Quan sát được (observability)**: chủ DN phải thấy được cả sức khỏe của chính hệ thống — lần sync cuối, kênh nào token hỏng, job nào fail. Không có "hộp đen".
4. **Free-tier discipline**: mọi thiết kế phải tính trước quota (500MB DB, 2000 phút Actions/tháng, 500K Edge invocations). Có kế hoạch rollup dữ liệu cũ ngay từ ngày 1.
5. **Quy tắc code Aroma**: tối giản, không abstraction thừa, sửa đâu đụng đó, `node --check` trước khi giao, không màu tím.

## 1. SƠ ĐỒ TỔNG THỂ

```
                    ┌───────────────────────────────┐
   Cửa hàng (200)   │  ONBOARD PAGE (GitHub Pages)  │
   bấm link OAuth ─▶│  /connect  → TikTok consent   │
                    └──────────────┬────────────────┘
                                   ▼
                    ┌───────────────────────────────┐
                    │  SUPABASE EDGE FUNCTIONS      │
                    │  · oauth-callback (đổi code   │
                    │    → token, lưu vault)        │
                    │  · oauth-refresh (nội bộ)     │
                    └──────────────┬────────────────┘
                                   ▼
┌──────────────────────────────────────────────────────────────┐
│  SUPABASE POSTGRES (free)                                    │
│  Bảng thô: kenh, token, snapshot_kenh, video, snapshot_video │
│  Bảng dẫn xuất: metric_ngay, diem_tuan, canh_bao             │
│  pg_cron 02:00 VN: tính delta, health score, quét bất thường │
│  RLS: dashboard đọc qua anon key; token chỉ service_role     │
└───────────────▲──────────────────────────────▲───────────────┘
                │ service_role (GitHub Secrets) │ anon + RLS
┌───────────────┴───────────────┐   ┌──────────┴───────────────┐
│  WORKER — GITHUB ACTIONS      │   │  DASHBOARD — GITHUB PAGES │
│  · sync.yml  06h/12h/18h/22h  │   │  PWA, mobile-first iPhone │
│  · refresh-tokens.yml  01h    │   │  Vite build → gh-pages    │
│  · Node 22, ESM, không deps   │   │                           │
│    ngoài supabase-js          │   │                           │
└───────────────────────────────┘   └───────────────────────────┘
```

Ba khối độc lập, hỏng khối nào biết khối đó:
- **Worker** (GitHub Actions) = trái tim thu thập. Thay thế hoàn toàn vai trò server 24/7.
- **Postgres + pg_cron** = bộ não phân tích. Toàn bộ công thức nằm trong SQL, dashboard chỉ đọc kết quả.
- **Dashboard** = mắt. Tĩnh 100%, không secret, deploy bằng push.

## 2. TECH STACK

| Lớp | Chọn | Lý do |
|---|---|---|
| Frontend | **Vite + React 19 + TypeScript** | Build tĩnh cho GitHub Pages; codebase nhiều màn hình cần component hóa, không nhét vừa 1 file như các PWA cũ. Claude Code làm multi-file rất tốt. |
| Chart | **Apache ECharts 6** | Sparkline, heatmap lịch đăng, radar 5 trụ, đường cong vòng đời video — 1 thư viện lo hết, canvas mượt trên iPhone. |
| State/Data | **TanStack Query 5 + supabase-js 2** | Cache, refetch, offline-tolerant — hợp PWA mobile. |
| Style | CSS variables thuần + design token Nón Sơn | Nền `#0B1220` obsidian/navy, accent gold `#CBA45A`, teal `#3FB6A8`, magenta thương hiệu `#D6006C` chỉ dùng cho logo/điểm nhấn. Font: Space Grotesk (số liệu/heading), Be Vietnam Pro (nội dung), JetBrains Mono (mã/ID). Icon SVG stroke. KHÔNG tím, KHÔNG emoji trong UI. |
| Worker | **Node 22 script thuần** trong `.github/workflows` | Không framework. Mỗi run: đọc danh sách kênh → gọi Display API → upsert. |
| Backend | **Supabase**: Postgres 15 + pg_cron + Vault + Edge Functions (Deno) | Vault mã hóa refresh_token at-rest. pg_cron chạy phân tích ngay trong DB — không cần compute ngoài. |
| PWA | manifest + service worker (cache shell) | Add to Home Screen trên iPhone, mở như app. |

Supabase project: tạo mới `ns-tiktok` (hoặc wipe project `gvyqjdrtptxmpxzztmyv` cũ để tái dùng slot — quyết định khi setup, không ảnh hưởng thiết kế).

## 3. DATA MODEL (DDL rút gọn — đủ để build)

```sql
-- ==== DANH MỤC ====
create table tk_kenh (
  id            bigint generated always as identity primary key,
  ma_ch         text not null,              -- mã cửa hàng, khớp hệ thống chấm công
  ten_ch        text not null,
  khu_vuc       text,                       -- Bắc/Trung/Nam/HCM... để lọc vùng
  username      text unique,                -- @handle
  open_id       text unique,                -- từ TikTok sau OAuth
  trang_thai    text not null default 'CHUA_KET_NOI',
    -- CHUA_KET_NOI | HOAT_DONG | TOKEN_LOI | TAM_NGUNG
  co_tiktok_shop boolean default false,     -- chừa sẵn cho Phase Shop/GMV
  ket_noi_luc   timestamptz,
  ghi_chu       text
);

create table tk_token (                      -- CHỈ service_role đọc/ghi
  kenh_id       bigint primary key references tk_kenh(id),
  refresh_token_id uuid not null,            -- id secret trong Vault, KHÔNG lưu token thô
  access_token  text,                        -- sống 24h, cache tạm
  access_het_han timestamptz,
  refresh_het_han timestamptz,               -- 365 ngày, cảnh báo trước 30 ngày
  loi_gan_nhat  text
);

-- ==== DỮ LIỆU THÔ (snapshot) ====
create table tk_snapshot_kenh (
  kenh_id       bigint references tk_kenh(id),
  ngay          date not null,
  follower      int, following int, tong_like bigint, so_video int,
  primary key (kenh_id, ngay)
);

create table tk_video (
  video_id      text primary key,            -- id TikTok
  kenh_id       bigint references tk_kenh(id),
  dang_luc      timestamptz not null,
  tieu_de       text, mo_ta text,
  thoi_luong_s  int,
  cover_url     text, share_url text,
  nhan          text,                        -- nhãn nội dung: LIVE_CUT|REVIEW|TREND|BTS|KHAC
  nhan_nguon    text default 'AUTO'          -- AUTO (Claude phân loại) | TAY
);

create table tk_snapshot_video (
  video_id      text references tk_video(video_id),
  ngay          date not null,
  luot_xem bigint, luot_thich int, binh_luan int, chia_se int,
  primary key (video_id, ngay)
);

-- ==== NGHIỆP VỤ BỔ SUNG ====
create table tk_phien_live (                 -- v1: cửa hàng tự khai qua form
  id bigint generated always as identity primary key,
  kenh_id bigint references tk_kenh(id),
  ngay date not null, gio_bat_dau time, thoi_luong_phut int,
  nguoi_xem_dinh int, ghi_chu text,
  nguon text default 'TU_KHAI'               -- chừa chỗ cho nguồn tự động sau này
);

-- ==== DẪN XUẤT (pg_cron ghi, dashboard đọc) ====
create table tk_metric_ngay (                -- delta hàng ngày mỗi kênh
  kenh_id bigint, ngay date,
  follower_tang int, video_moi int,
  xem_tang bigint, thich_tang int, binhluan_tang int, chiase_tang int,
  primary key (kenh_id, ngay)
);

create table tk_diem_tuan (                  -- Health Score
  kenh_id bigint, tuan date,                 -- thứ 2 đầu tuần
  d_chuyencan numeric, d_noidung numeric, d_tangtruong numeric,
  d_hitrate numeric, d_live numeric,
  d_tong numeric,                            -- 0–100
  hang int, hang_khuvuc int,
  primary key (kenh_id, tuan)
);

create table tk_canh_bao (
  id bigint generated always as identity primary key,
  kenh_id bigint references tk_kenh(id),
  video_id text,
  loai text not null,
    -- NGUNG_DANG | FOLLOWER_KHUNG | ER_GIAM | TOKEN_SAP_HET | TOKEN_LOI
    -- VIDEO_BUNG_NO (cảnh báo tích cực) | SYNC_FAIL
  muc_do text not null,                      -- THONG_TIN | CHU_Y | KHAN
  noi_dung text, phat_hien_luc timestamptz default now(),
  trang_thai text default 'MOI'              -- MOI | DA_XEM | DA_XU_LY
);

create table tk_sync_log (                   -- observability
  id bigint generated always as identity primary key,
  bat_dau timestamptz, ket_thuc timestamptz,
  so_kenh_ok int, so_kenh_loi int, chi_tiet_loi jsonb
);
```

**RLS**: bật trên mọi bảng. `anon` được `select` tất cả trừ `tk_token` (deny toàn bộ) và `insert` vào `tk_phien_live` + `update tk_canh_bao.trang_thai`. Ghi dữ liệu thô chỉ qua `service_role` (worker) — dashboard không bao giờ cầm service key.

**Dự toán dung lượng năm 1**: snapshot_kenh 73K dòng + snapshot_video ~1,1M dòng (theo dõi video dày trong 30 ngày đầu, sau đó 1 lần/tuần, ngừng hẳn sau 120 ngày nếu đứng yên) ≈ 90–120MB. pg_cron tháng chạy rollup: snapshot_video >180 ngày gộp về 1 dòng/tuần. An toàn dưới trần 500MB nhiều năm.

## 4. PIPELINE ĐỒNG BỘ (GitHub Actions)

### 4.1 `sync.yml` — cron `0 23,5,11,15 * * *` UTC (= 06/12/18/22h VN)
```
1. Lấy danh sách kênh HOAT_DONG + access_token còn hạn (RPC get_kenh_can_sync)
2. Với mỗi kênh (chạy song song 10 luồng, tôn trọng 600 req/phút/endpoint):
   a. GET /v2/user/info/  (fields: follower_count, likes_count, video_count...)
      → upsert tk_snapshot_kenh (ngày hôm nay, ghi đè = số mới nhất trong ngày)
   b. POST /v2/video/list/ phân trang cursor
      → video mới: insert tk_video
      → video trong cửa sổ theo dõi: upsert tk_snapshot_video
   c. Lỗi 401 → đánh dấu TOKEN_LOI + tạo canh_bao KHAN
3. Ghi tk_sync_log. Run ~3–4 phút / 200 kênh.
Ngân sách: 4 run/ngày × 4 phút × 30 = ~480 phút/tháng (<25% quota private repo).
```

### 4.2 `refresh-tokens.yml` — cron 01h VN hàng ngày
Gọi Edge Function `oauth-refresh` (giữ logic + Vault trong Supabase, worker chỉ trigger): refresh mọi access_token sắp hết hạn bằng refresh_token (sống 365 ngày, refresh không cần user đồng ý lại). Kênh có refresh_token < 30 ngày hạn → canh_bao `TOKEN_SAP_HET`.

### 4.3 `phan-loai-video.yml` — cron 03h VN (Phase 2)
Video mới chưa có nhãn → gọi Claude Haiku phân loại tiêu đề/mô tả thành LIVE_CUT / REVIEW / TREND / BTS / KHAC → update `tk_video.nhan`. Chi phí ~vài nghìn đồng/tháng, bật sau.

## 5. ONBOARDING OAUTH (trải nghiệm cửa hàng = 3 chạm)

1. Anh gửi link `https://<pages>/connect?ch=NS_Q7_01` (mã CH nhúng trong `state`).
2. Trang connect (giao diện Nón Sơn, hướng dẫn 3 bước có hình) → nút **Kết nối TikTok** → TikTok consent với scopes `user.info.basic, user.info.profile, user.info.stats, video.list`.
3. TikTok redirect về Edge Function `oauth-callback`: verify `state` (bảng tk_oauth_state chống CSRF) → đổi code lấy token → lưu refresh_token vào **Vault** → cập nhật tk_kenh (open_id, username, HOAT_DONG) → redirect về trang "Kết nối thành công ✓" hiển thị avatar + @handle.
4. Dashboard admin có tab **Kết nối**: lưới 200 CH theo khu vực, ai đã nối/chưa nối/token lỗi — anh nhìn 1 màn hình biết tiến độ onboard toàn chuỗi.

**Sandbox trước, audit sau**: pilot tối đa 50 tài khoản (5 sandbox × 10). Chuẩn bị hồ sơ audit song song ngay tuần 1: privacy policy (host luôn trên Pages), video demo flow OAuth, mô tả xử lý dữ liệu. Duyệt ~1–2 tuần → mở khóa 200 kênh.

## 6. METRICS ENGINE — công thức chốt

Chạy toàn bộ trong Postgres (pg_cron 02h VN), dashboard chỉ đọc.

### 6.1 Chỉ số nền (mỗi kênh, cửa sổ 7/28 ngày trượt)
- `video_per_tuan`, `do_deu` = 1/(1+stddev khoảng cách ngày đăng)
- `median_view` của video đăng trong 28 ngày
- `ER` = (thích+bình luận+chia sẻ)/xem, trọng số chia sẻ ×3, bình luận ×2 (chia sẻ là tín hiệu thuật toán mạnh nhất)
- `follower_growth` = %Δfollower/tuần, làm mượt EWMA α=0.3
- `hit_rate` = % video 28 ngày vượt P75 view toàn hệ thống
- `viral_flag` = có video view > 10× median của chính kênh
- `live_gio_tuan`, `live_do_deu` (từ tự khai)

### 6.2 Health Score 100 điểm — chấm theo percentile nội bộ
```
d_tong = 25·pct(chuyên cần: video_per_tuan·do_deu)
       + 25·pct(nội dung: 0.5·median_view + 0.5·ER)
       + 20·pct(tăng trưởng: follower_growth EWMA)
       + 15·(hit_rate chuẩn hóa, cộng thưởng viral_flag +10% trụ)
       + 15·pct(live: gio_tuan·do_deu)
pct() = percent_rank trong toàn hệ thống, 0→1
```
Phân hạng hiển thị: **A (≥80) · B (65–79) · C (50–64) · D (<50)**. Có cả `hang_khuvuc` để so trong vùng.

### 6.3 Quét bất thường (mỗi đêm, ghi tk_canh_bao)
| Luật | Điều kiện | Mức |
|---|---|---|
| NGUNG_DANG | 0 video ≥5 ngày trong khi trung bình 8 tuần ≥3 video/tuần | CHU_Y → KHAN sau 10 ngày |
| FOLLOWER_KHUNG | z-score tăng trưởng tuần < −2 so với đường nền EWMA của chính kênh | CHU_Y |
| ER_GIAM | ER giảm 3 tuần liên tiếp và < P25 hệ thống | CHU_Y |
| VIDEO_BUNG_NO | tốc độ view 24h đầu > P95 hệ thống | THONG_TIN (tích cực — báo để nhân rộng khi còn nóng) |
| TOKEN_LOI / SYNC_FAIL | kỹ thuật | KHAN |

## 7. DASHBOARD — KIẾN TRÚC MÀN HÌNH

**Tab 1 · Tổng quan**: 4 thẻ KPI hệ thống (tổng follower + Δtuần, video tuần này, tổng view tuần, số kênh hạng A/D) · đường tăng trưởng follower toàn chuỗi 12 tuần · phân bố hạng A/B/C/D theo khu vực (stacked bar) · dải cảnh báo MOI nổi lên đầu.

**Tab 2 · Xếp hạng**: bảng 200 kênh sort theo d_tong, cột: hạng(↑↓ so tuần trước) · kênh · khu vực · điểm · sparkline follower 8 tuần · mini radar. Lọc khu vực/hạng/trạng thái. Chạm dòng → Tab 3.

**Tab 3 · Chi tiết kênh** (trả lời "tại sao kênh này phát triển"):
- Header: avatar, @handle, CH, follower + Δ, hạng + biến động.
- **Radar 5 trụ** kênh vs trung vị hệ thống — nhìn 3 giây biết kênh mạnh/yếu ở đâu.
- Chuỗi thời gian follower/view/ER 12 tuần.
- **Heatmap lịch đăng** (ô lịch tô đậm theo view) — lộ ngay pattern "đăng đều thì lên, nghỉ thì khựng".
- Bảng video: mỗi dòng có **đường cong vòng đời view 30 ngày** thu nhỏ, nhãn nội dung, ER. Sort theo view/ER/ngày.
- Phân tích cắt lớp: view trung vị theo **nhãn nội dung / khung giờ đăng / độ dài video** → đây chính là chỗ chỉ ra "nội dung nào hiệu quả".
- Lịch sử live + cảnh báo của riêng kênh.

**Tab 4 · Video Explorer**: kho video toàn hệ thống, lọc nhãn/khu vực/khoảng view — tìm "video bùng nổ tuần này" để gửi các CH học theo.

**Tab 5 · Cảnh báo**: inbox theo mức độ, gạt DA_XEM/DA_XU_LY (pattern giống sự vụ bên chấm công).

**Tab 6 · Kết nối & Hệ thống**: tiến độ OAuth 200 CH, tk_sync_log, quota đã dùng.

## 8. CẤU TRÚC REPO

```
ns-tiktok/
├─ BLUEPRINT.md                ← file này
├─ web/                        ← Vite + React + TS
│  ├─ src/{screens,components,lib,styles}/
│  └─ vite.config.ts           (base '/ns-tiktok/')
├─ worker/
│  ├─ sync.mjs  refresh.mjs  classify.mjs
├─ supabase/
│  ├─ migrations/001_schema.sql  002_rls.sql  003_cron.sql
│  └─ functions/oauth-callback/  oauth-refresh/
├─ .github/workflows/sync.yml  refresh-tokens.yml  deploy-pages.yml
└─ docs/privacy-policy.html    ← cho hồ sơ audit TikTok
```

## 9. ROADMAP

- **Phase 0 (tuần 1–2)**: schema + Edge Functions + worker + connect page. OAuth 3–5 tài khoản test của anh. Dashboard v0.1: Tổng quan + Chi tiết kênh cơ bản. *Nghiệm thu: mở app trên iPhone thấy số liệu thật tự cập nhật 4 lần/ngày.*
- **Phase 1 (tuần 2–4, song song)**: nộp audit TikTok · Health Score + cảnh báo + đủ 6 tab · pilot 30–50 kênh sandbox.
- **Phase 2 (sau audit)**: onboard 200 kênh · phân loại nội dung bằng Claude · báo cáo tuần tự động.
- **Phase 3**: TikTok Shop API cho CH có shop (trụ điểm thứ 6: Chuyển đổi/GMV) · form live nâng cao hoặc nguồn live tự động nếu khả thi.

## 10. GIẢ ĐỊNH ĐÃ CHỐT
1. Mỗi CH giữ tài khoản riêng, OAuth qua link anh gửi. ✓ (anh xác nhận)
2. Livestream v1 = tự khai. Schema đã chừa `nguon` để thay nguồn sau.
3. GMV/Shop để Phase 3, schema đã chừa `co_tiktok_shop`.
