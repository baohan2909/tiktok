-- ============================================================
-- NS TIKTOK COMMAND CENTER — 006_metrics.sql
-- Metrics Engine (mục 6 BLUEPRINT): chỉ số nền + Health Score + xếp hạng
-- + quét bất thường. Chạy trong Postgres qua pg_cron 02:15 VN.
-- Chạy sau 005_fixes.sql. An toàn chạy lại.
--
-- Ghi chú đơn giản hóa v1 (đúng tinh thần, gọn về SQL):
--  - follower_growth: %Δ follower trung bình/tuần trên cửa sổ 28 ngày (EWMA để Phase sau).
--  - live_do_deu: bỏ qua (chưa có dữ liệu live tự khai); live_score = số giờ live/tuần.
-- ============================================================

-- ------------------------------------------------------------
-- HEALTH SCORE tuần: ghi tk_diem_tuan cho mọi kênh HOAT_DONG/TOKEN_LOI.
-- percent_rank() nội bộ toàn hệ thống cho 5 trụ; hạng theo d_tong.
-- ------------------------------------------------------------
create or replace function tk_tinh_diem_tuan(
  p_ngay date default (now() at time zone 'Asia/Ho_Chi_Minh')::date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tuan date := date_trunc('week', p_ngay)::date;   -- thứ 2 đầu tuần
  v_28   date := p_ngay - 28;
  v_7    date := p_ngay - 7;
  so_dong integer;
begin
  delete from tk_diem_tuan where tuan = v_tuan;

  with
  -- snapshot mới nhất mỗi video đăng trong 28 ngày
  vid_latest as (
    select v.video_id, v.kenh_id, v.dang_luc,
           sv.luot_xem, sv.luot_thich, sv.binh_luan, sv.chia_se
    from tk_video v
    join lateral (
      select s.luot_xem, s.luot_thich, s.binh_luan, s.chia_se
      from tk_snapshot_video s
      where s.video_id = v.video_id
      order by s.ngay desc
      limit 1
    ) sv on true
    where v.dang_luc >= (v_28::timestamptz)
  ),
  sys as (
    select percentile_cont(0.75) within group (order by luot_xem) as p75_view
    from vid_latest
  ),
  base as (
    select
      k.id as kenh_id,
      k.khu_vuc,
      -- chuyên cần
      (select count(*) from tk_video v where v.kenh_id = k.id and v.dang_luc >= (v_28::timestamptz))::numeric / 4.0
        as video_per_tuan,
      coalesce((
        select case when count(*) >= 2 then 1.0 / (1.0 + coalesce(stddev_samp(gap), 0)) else 0 end
        from (
          select (d - lag(d) over (order by d))::numeric as gap
          from (
            select distinct ((v2.dang_luc at time zone 'Asia/Ho_Chi_Minh')::date) as d
            from tk_video v2
            where v2.kenh_id = k.id and v2.dang_luc >= (v_28::timestamptz)
          ) dd
        ) g
        where gap is not null
      ), 0) as do_deu,
      -- nội dung
      coalesce((select percentile_cont(0.5) within group (order by vl.luot_xem)
                from vid_latest vl where vl.kenh_id = k.id), 0) as median_view,
      coalesce((select case when sum(vl.luot_xem) > 0
                     then sum(vl.luot_thich + 2 * vl.binh_luan + 3 * vl.chia_se)::numeric / sum(vl.luot_xem) * 100
                     else 0 end
                from vid_latest vl where vl.kenh_id = k.id), 0) as er,
      -- tăng trưởng: %Δ follower trung bình/tuần trên 28 ngày
      coalesce((
        select case when f0.follower > 0
                    then (f1.follower - f0.follower)::numeric / f0.follower / 4.0 * 100 else 0 end
        from (select follower from tk_snapshot_kenh where kenh_id = k.id and ngay <= v_28 order by ngay desc limit 1) f0,
             (select follower from tk_snapshot_kenh where kenh_id = k.id order by ngay desc limit 1) f1
      ), 0) as follower_growth,
      -- hit rate + viral
      coalesce((select avg(case when vl.luot_xem > (select p75_view from sys) then 1.0 else 0 end)
                from vid_latest vl where vl.kenh_id = k.id), 0) as hit_rate,
      coalesce((
        select bool_or(vl.luot_xem > 10 * nullif(
          (select percentile_cont(0.5) within group (order by x.luot_xem) from vid_latest x where x.kenh_id = k.id), 0))
        from vid_latest vl where vl.kenh_id = k.id
      ), false) as viral_flag,
      -- live (tự khai, 7 ngày)
      coalesce((select sum(thoi_luong_phut)::numeric / 60.0
                from tk_phien_live pl where pl.kenh_id = k.id and pl.ngay >= v_7), 0) as live_gio_tuan
    from tk_kenh k
    where k.trang_thai in ('HOAT_DONG', 'TOKEN_LOI')
  ),
  ranked as (
    select b.*,
      percent_rank() over (order by video_per_tuan * do_deu) as pr_chuyencan,
      percent_rank() over (order by median_view)             as pr_medview,
      percent_rank() over (order by er)                       as pr_er,
      percent_rank() over (order by follower_growth)          as pr_growth,
      percent_rank() over (order by live_gio_tuan)            as pr_live
    from base b
  ),
  scored as (
    select kenh_id, khu_vuc,
      round((25 * pr_chuyencan)::numeric, 1)                                              as d_chuyencan,
      round((25 * (0.5 * pr_medview + 0.5 * pr_er))::numeric, 1)                          as d_noidung,
      round((20 * pr_growth)::numeric, 1)                                                 as d_tangtruong,
      round((15 * least(1.0, hit_rate + case when viral_flag then 0.1 else 0 end))::numeric, 1) as d_hitrate,
      round((15 * pr_live)::numeric, 1)                                                   as d_live
    from ranked
  ),
  tong as (
    select s.*, (d_chuyencan + d_noidung + d_tangtruong + d_hitrate + d_live) as d_tong
    from scored s
  )
  insert into tk_diem_tuan
    (kenh_id, tuan, d_chuyencan, d_noidung, d_tangtruong, d_hitrate, d_live, d_tong, hang, hang_khuvuc)
  select
    kenh_id, v_tuan, d_chuyencan, d_noidung, d_tangtruong, d_hitrate, d_live, d_tong,
    rank() over (order by d_tong desc),
    rank() over (partition by khu_vuc order by d_tong desc)
  from tong;

  get diagnostics so_dong = row_count;
  return so_dong;
end;
$$;
revoke all on function tk_tinh_diem_tuan(date) from public, anon;
grant execute on function tk_tinh_diem_tuan(date) to service_role;

-- ------------------------------------------------------------
-- QUÉT BẤT THƯỜNG: ghi tk_canh_bao (không trùng cảnh báo MOI cùng loại/kênh).
-- v1: NGUNG_DANG, VIDEO_BUNG_NO, FOLLOWER_KHUNG (đơn giản).
-- ER_GIAM cần chuỗi ER tuần -> để Phase sau.
-- ------------------------------------------------------------
create or replace function tk_quet_bat_thuong(
  p_ngay date default (now() at time zone 'Asia/Ho_Chi_Minh')::date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 1) NGUNG_DANG: 0 video >=5 ngày trong khi TB 8 tuần >=3 video/tuần.
  --    Đã đăng đều trước đó nhưng gần đây im.
  insert into tk_canh_bao (kenh_id, loai, muc_do, noi_dung)
  select k.id, 'NGUNG_DANG',
         case when (p_ngay - last_post.d) >= 10 then 'KHAN' else 'CHU_Y' end,
         'Kenh chua dang video ' || (p_ngay - last_post.d) || ' ngay (truoc do dang deu)'
  from tk_kenh k
  join lateral (
    select max((v.dang_luc at time zone 'Asia/Ho_Chi_Minh')::date) as d
    from tk_video v where v.kenh_id = k.id
  ) last_post on true
  where k.trang_thai = 'HOAT_DONG'
    and last_post.d is not null
    and (p_ngay - last_post.d) >= 5
    and (
      select count(*) from tk_video v
      where v.kenh_id = k.id and v.dang_luc >= (p_ngay - 56)::timestamptz
    )::numeric / 8.0 >= 3
    and not exists (
      select 1 from tk_canh_bao c
      where c.kenh_id = k.id and c.loai = 'NGUNG_DANG' and c.trang_thai = 'MOI'
    );

  -- 2) VIDEO_BUNG_NO: tốc độ view ngày đầu > P95 hệ thống (video đăng trong 3 ngày).
  with dau as (
    -- view của snapshot ĐẦU TIÊN mỗi video (xấp xỉ view 24h đầu)
    select v.video_id, v.kenh_id, v.dang_luc,
           (select s.luot_xem from tk_snapshot_video s
            where s.video_id = v.video_id order by s.ngay asc limit 1) as view_dau
    from tk_video v
    where v.dang_luc >= (p_ngay - 90)::timestamptz
  ),
  p95 as (select percentile_cont(0.95) within group (order by view_dau) as v from dau where view_dau is not null)
  insert into tk_canh_bao (kenh_id, video_id, loai, muc_do, noi_dung)
  select d.kenh_id, d.video_id, 'VIDEO_BUNG_NO', 'THONG_TIN',
         'Video bung no: view ngay dau ' || d.view_dau || ' vuot P95 he thong'
  from dau d, p95
  where d.dang_luc >= (p_ngay - 3)::timestamptz
    and d.view_dau is not null and p95.v is not null
    and d.view_dau > p95.v
    and not exists (
      select 1 from tk_canh_bao c
      where c.video_id = d.video_id and c.loai = 'VIDEO_BUNG_NO'
    );

  -- 3) FOLLOWER_KHUNG (đơn giản): follower giảm >2% trong 7 ngày.
  insert into tk_canh_bao (kenh_id, loai, muc_do, noi_dung)
  select k.id, 'FOLLOWER_KHUNG', 'CHU_Y',
         'Follower giam ' || round((f0.follower - f1.follower)::numeric / nullif(f0.follower,0) * 100, 1) || '% trong 7 ngay'
  from tk_kenh k
  join lateral (select follower from tk_snapshot_kenh where kenh_id = k.id and ngay <= (p_ngay - 7) order by ngay desc limit 1) f0 on true
  join lateral (select follower from tk_snapshot_kenh where kenh_id = k.id order by ngay desc limit 1) f1 on true
  where k.trang_thai = 'HOAT_DONG'
    and f0.follower > 0
    and (f0.follower - f1.follower)::numeric / f0.follower > 0.02
    and not exists (
      select 1 from tk_canh_bao c
      where c.kenh_id = k.id and c.loai = 'FOLLOWER_KHUNG' and c.trang_thai = 'MOI'
    );
end;
$$;
revoke all on function tk_quet_bat_thuong(date) from public, anon;
grant execute on function tk_quet_bat_thuong(date) to service_role;

-- ------------------------------------------------------------
-- Lịch pg_cron: 02:15 VN (19:15 UTC) — sau khi tk_metric_hangngay (02:00) xong.
-- ------------------------------------------------------------
select cron.unschedule('tk_diem_tuan')
  where exists (select 1 from cron.job where jobname = 'tk_diem_tuan');
select cron.unschedule('tk_quet_bat_thuong')
  where exists (select 1 from cron.job where jobname = 'tk_quet_bat_thuong');

select cron.schedule('tk_diem_tuan', '15 19 * * *',
  $$ select tk_tinh_diem_tuan((now() at time zone 'Asia/Ho_Chi_Minh')::date); $$);
select cron.schedule('tk_quet_bat_thuong', '20 19 * * *',
  $$ select tk_quet_bat_thuong((now() at time zone 'Asia/Ho_Chi_Minh')::date); $$);
