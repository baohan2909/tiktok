-- ============================================================
-- NS TIKTOK COMMAND CENTER — 002_rls.sql
-- RLS: dashboard đọc qua anon key; token & state chỉ service_role.
-- service_role (worker + edge functions) tự động bỏ qua RLS — không cần policy.
-- Chạy sau 001_schema.sql.
-- ============================================================

-- ---- Bật RLS trên MỌI bảng ----
alter table tk_kenh           enable row level security;
alter table tk_token          enable row level security;
alter table tk_oauth_state    enable row level security;
alter table tk_snapshot_kenh  enable row level security;
alter table tk_video          enable row level security;
alter table tk_snapshot_video enable row level security;
alter table tk_phien_live     enable row level security;
alter table tk_metric_ngay    enable row level security;
alter table tk_diem_tuan      enable row level security;
alter table tk_canh_bao       enable row level security;
alter table tk_sync_log       enable row level security;

-- ---- Quyền GRANT ở cấp bảng cho anon ----
grant select on
  tk_kenh, tk_snapshot_kenh, tk_video, tk_snapshot_video,
  tk_phien_live, tk_metric_ngay, tk_diem_tuan, tk_canh_bao, tk_sync_log
  to anon;
grant insert on tk_phien_live   to anon;
grant insert on tk_oauth_state  to anon;   -- trang connect tạo state trước khi qua TikTok
grant update (trang_thai) on tk_canh_bao to anon;

-- tk_token: KHÔNG cấp quyền nào cho anon (thêm lớp chặn ngoài RLS)
revoke all on tk_token from anon;

-- ---- Policy đọc công khai (anon) ----
create policy anon_read_kenh      on tk_kenh           for select to anon using (true);
create policy anon_read_snap_kenh on tk_snapshot_kenh  for select to anon using (true);
create policy anon_read_video     on tk_video          for select to anon using (true);
create policy anon_read_snap_vid  on tk_snapshot_video for select to anon using (true);
create policy anon_read_metric    on tk_metric_ngay    for select to anon using (true);
create policy anon_read_diem      on tk_diem_tuan      for select to anon using (true);
create policy anon_read_synclog   on tk_sync_log       for select to anon using (true);

-- ---- tk_phien_live: đọc + tự khai ----
create policy anon_read_live   on tk_phien_live for select to anon using (true);
create policy anon_insert_live on tk_phien_live for insert to anon with check (true);

-- ---- tk_canh_bao: đọc + gạt trạng thái đã xem/đã xử lý ----
create policy anon_read_canhbao   on tk_canh_bao for select to anon using (true);
create policy anon_update_canhbao on tk_canh_bao for update to anon using (true) with check (true);

-- ---- tk_oauth_state: chỉ cho phép insert (không cho đọc/sửa/xóa từ anon) ----
create policy anon_insert_state on tk_oauth_state for insert to anon with check (true);

-- tk_token: KHÔNG có policy nào => anon bị chặn hoàn toàn (RLS bật + 0 policy).
