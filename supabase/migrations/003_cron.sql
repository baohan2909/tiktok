-- ============================================================
-- NS TIKTOK COMMAND CENTER — 003_cron.sql
-- pg_cron + RPC get_kenh_can_sync (worker) + tính delta ngày (tk_metric_ngay).
-- Health Score + quét bất thường thuộc Phase 1, chưa nằm ở đây.
-- Chạy sau 002_rls.sql.
-- ============================================================

create extension if not exists pg_cron;

-- ------------------------------------------------------------
-- RPC cho worker sync: danh sách kênh HOAT_DONG còn access_token hạn.
-- security definer để đọc được tk_token (bảng service_role-only).
-- ------------------------------------------------------------
create or replace function get_kenh_can_sync()
returns table (kenh_id bigint, open_id text, access_token text)
language sql
security definer
set search_path = public
as $$
  select k.id, k.open_id, t.access_token
  from tk_kenh k
  join tk_token t on t.kenh_id = k.id
  where k.trang_thai = 'HOAT_DONG'
    and t.access_token is not null
    and t.access_het_han > now();
$$;

revoke all on function get_kenh_can_sync() from public, anon;
grant execute on function get_kenh_can_sync() to service_role;

-- ------------------------------------------------------------
-- Tính delta ngày: so snapshot ngày p_ngay với snapshot gần nhất trước đó.
-- Kênh: follower_tang, video_moi từ tk_snapshot_kenh.
-- Video: xem/thich/binhluan/chiase_tang = tổng delta các video của kênh.
-- ------------------------------------------------------------
create or replace function tk_tinh_metric_ngay(
  p_ngay date default (now() at time zone 'Asia/Ho_Chi_Minh')::date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  so_dong integer;
begin
  delete from tk_metric_ngay where ngay = p_ngay;

  insert into tk_metric_ngay
    (kenh_id, ngay, follower_tang, video_moi, xem_tang, thich_tang, binhluan_tang, chiase_tang)
  select
    k.kenh_id,
    p_ngay,
    coalesce(k.follower  - kp.follower, 0),
    coalesce(k.so_video  - kp.so_video, 0),
    coalesce(v.xem_tang, 0),
    coalesce(v.thich_tang, 0),
    coalesce(v.binhluan_tang, 0),
    coalesce(v.chiase_tang, 0)
  from tk_snapshot_kenh k
  left join lateral (
    select kp0.follower, kp0.so_video
    from tk_snapshot_kenh kp0
    where kp0.kenh_id = k.kenh_id and kp0.ngay < p_ngay
    order by kp0.ngay desc
    limit 1
  ) kp on true
  left join (
    select vd.kenh_id,
           sum(coalesce(sv.luot_xem   - svp.luot_xem, 0))   as xem_tang,
           sum(coalesce(sv.luot_thich - svp.luot_thich, 0)) as thich_tang,
           sum(coalesce(sv.binh_luan  - svp.binh_luan, 0))  as binhluan_tang,
           sum(coalesce(sv.chia_se    - svp.chia_se, 0))    as chiase_tang
    from tk_snapshot_video sv
    join tk_video vd on vd.video_id = sv.video_id
    left join lateral (
      select svp0.luot_xem, svp0.luot_thich, svp0.binh_luan, svp0.chia_se
      from tk_snapshot_video svp0
      where svp0.video_id = sv.video_id and svp0.ngay < p_ngay
      order by svp0.ngay desc
      limit 1
    ) svp on true
    where sv.ngay = p_ngay
    group by vd.kenh_id
  ) v on v.kenh_id = k.kenh_id
  where k.ngay = p_ngay;

  get diagnostics so_dong = row_count;
  return so_dong;
end;
$$;

revoke all on function tk_tinh_metric_ngay(date) from public, anon;
grant execute on function tk_tinh_metric_ngay(date) to service_role;

-- ------------------------------------------------------------
-- Dọn state OAuth cũ (> 1 giờ) — chống rác bảng tk_oauth_state.
-- ------------------------------------------------------------
create or replace function tk_don_oauth_state()
returns void
language sql
security definer
set search_path = public
as $$
  delete from tk_oauth_state where tao_luc < now() - interval '1 hour';
$$;

-- ------------------------------------------------------------
-- Lịch pg_cron
--   02:00 VN (19:00 UTC): tính metric cho NGÀY VN vừa kết thúc (hôm qua VN).
--   02:30 VN (19:30 UTC): dọn state OAuth cũ.
-- unschedule trước để chạy lại file này không bị trùng job.
-- ------------------------------------------------------------
select cron.unschedule('tk_metric_hangngay')
  where exists (select 1 from cron.job where jobname = 'tk_metric_hangngay');
select cron.unschedule('tk_don_oauth_state')
  where exists (select 1 from cron.job where jobname = 'tk_don_oauth_state');

select cron.schedule(
  'tk_metric_hangngay', '0 19 * * *',
  $$ select tk_tinh_metric_ngay(((now() at time zone 'Asia/Ho_Chi_Minh')::date) - 1); $$
);
select cron.schedule(
  'tk_don_oauth_state', '30 19 * * *',
  $$ select tk_don_oauth_state(); $$
);
