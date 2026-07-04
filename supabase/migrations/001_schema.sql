-- ============================================================
-- NS TIKTOK COMMAND CENTER — 001_schema.sql
-- Bảng thô + dẫn xuất + oauth_state. Chạy 1 lần trên Supabase SQL Editor.
-- Prefix tk_ cho mọi bảng để tách khỏi các schema khác trong project.
-- ============================================================

-- ==== DANH MỤC KÊNH ====
create table if not exists tk_kenh (
  id             bigint generated always as identity primary key,
  ma_ch          text not null,              -- mã cửa hàng, khớp hệ thống chấm công
  ten_ch         text not null,
  khu_vuc        text,                       -- Bắc/Trung/Nam/HCM... để lọc vùng
  username       text unique,                -- @handle
  open_id        text unique,                -- từ TikTok sau OAuth
  trang_thai     text not null default 'CHUA_KET_NOI',
    -- CHUA_KET_NOI | HOAT_DONG | TOKEN_LOI | TAM_NGUNG
  co_tiktok_shop boolean default false,      -- chừa sẵn cho Phase Shop/GMV
  ket_noi_luc    timestamptz,
  ghi_chu        text
);
create unique index if not exists tk_kenh_ma_ch_uidx on tk_kenh (ma_ch);

-- ==== TOKEN (CHỈ service_role đọc/ghi) ====
create table if not exists tk_token (
  kenh_id          bigint primary key references tk_kenh(id) on delete cascade,
  refresh_token_id uuid not null,            -- id secret trong Vault, KHÔNG lưu token thô
  access_token     text,                     -- sống 24h, cache tạm
  access_het_han   timestamptz,
  refresh_het_han  timestamptz,              -- 365 ngày, cảnh báo trước 30 ngày
  loi_gan_nhat     text
);

-- ==== CHỐNG CSRF CHO OAUTH ====
create table if not exists tk_oauth_state (
  state    text primary key,                 -- chuỗi ngẫu nhiên do trang connect sinh
  ma_ch    text not null,                    -- mã CH nhúng trong link
  tao_luc  timestamptz not null default now()
);

-- ==== DỮ LIỆU THÔ (snapshot) ====
create table if not exists tk_snapshot_kenh (
  kenh_id   bigint references tk_kenh(id) on delete cascade,
  ngay      date not null,
  follower  int, following int, tong_like bigint, so_video int,
  primary key (kenh_id, ngay)
);

create table if not exists tk_video (
  video_id     text primary key,             -- id TikTok
  kenh_id      bigint references tk_kenh(id) on delete cascade,
  dang_luc     timestamptz not null,
  tieu_de      text, mo_ta text,
  thoi_luong_s int,
  cover_url    text, share_url text,
  nhan         text,                          -- LIVE_CUT|REVIEW|TREND|BTS|KHAC
  nhan_nguon   text default 'AUTO'            -- AUTO (Claude phân loại) | TAY
);
create index if not exists tk_video_kenh_idx on tk_video (kenh_id);
create index if not exists tk_video_dang_luc_idx on tk_video (dang_luc);

create table if not exists tk_snapshot_video (
  video_id  text references tk_video(video_id) on delete cascade,
  ngay      date not null,
  luot_xem bigint, luot_thich int, binh_luan int, chia_se int,
  primary key (video_id, ngay)
);

-- ==== NGHIỆP VỤ BỔ SUNG ====
create table if not exists tk_phien_live (    -- v1: cửa hàng tự khai qua form
  id bigint generated always as identity primary key,
  kenh_id bigint references tk_kenh(id) on delete cascade,
  ngay date not null, gio_bat_dau time, thoi_luong_phut int,
  nguoi_xem_dinh int, ghi_chu text,
  nguon text default 'TU_KHAI'                -- chừa chỗ cho nguồn tự động sau này
);

-- ==== DẪN XUẤT (pg_cron ghi, dashboard đọc) ====
create table if not exists tk_metric_ngay (   -- delta hàng ngày mỗi kênh
  kenh_id bigint references tk_kenh(id) on delete cascade,
  ngay date,
  follower_tang int, video_moi int,
  xem_tang bigint, thich_tang int, binhluan_tang int, chiase_tang int,
  primary key (kenh_id, ngay)
);

create table if not exists tk_diem_tuan (     -- Health Score (Phase 1)
  kenh_id bigint references tk_kenh(id) on delete cascade,
  tuan date,                                  -- thứ 2 đầu tuần
  d_chuyencan numeric, d_noidung numeric, d_tangtruong numeric,
  d_hitrate numeric, d_live numeric,
  d_tong numeric,                             -- 0–100
  hang int, hang_khuvuc int,
  primary key (kenh_id, tuan)
);

create table if not exists tk_canh_bao (
  id bigint generated always as identity primary key,
  kenh_id bigint references tk_kenh(id) on delete cascade,
  video_id text,
  loai text not null,
    -- NGUNG_DANG | FOLLOWER_KHUNG | ER_GIAM | TOKEN_SAP_HET | TOKEN_LOI
    -- VIDEO_BUNG_NO | SYNC_FAIL
  muc_do text not null,                       -- THONG_TIN | CHU_Y | KHAN
  noi_dung text, phat_hien_luc timestamptz default now(),
  trang_thai text default 'MOI'               -- MOI | DA_XEM | DA_XU_LY
);
create index if not exists tk_canh_bao_trangthai_idx on tk_canh_bao (trang_thai, phat_hien_luc desc);

create table if not exists tk_sync_log (      -- observability
  id bigint generated always as identity primary key,
  bat_dau timestamptz, ket_thuc timestamptz,
  so_kenh_ok int, so_kenh_loi int, chi_tiet_loi jsonb
);
