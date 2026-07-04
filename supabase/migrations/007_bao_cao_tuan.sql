-- ============================================================
-- NS TIKTOK COMMAND CENTER — 007_bao_cao_tuan.sql
-- Báo cáo tuần tự động (Phase 2, mục 9 ROADMAP).
-- SQL nắm SỐ LIỆU (RPC tk_tao_bao_cao_tuan -> JSONB du_lieu),
-- worker report.mjs nắm CÂU CHỮ (Claude điền tom_tat), dashboard chỉ đọc.
-- Chạy sau 006_metrics.sql. An toàn chạy lại (idempotent).
-- ============================================================

-- ------------------------------------------------------------
-- Bảng lưu báo cáo tuần: 1 dòng/tuần.
--  du_lieu  : digest số liệu do SQL tính (không phụ thuộc worker).
--  tom_tat  : nhận định điều hành do Claude viết (worker điền, có thể null).
-- ------------------------------------------------------------
create table if not exists tk_bao_cao_tuan (
  tuan        date primary key,          -- thứ 2 đầu tuần được báo cáo
  du_lieu     jsonb not null,
  tom_tat     jsonb,
  tao_luc     timestamptz default now(),
  tom_tat_luc timestamptz
);

alter table tk_bao_cao_tuan enable row level security;
grant select on tk_bao_cao_tuan to anon;
drop policy if exists anon_read_baocao on tk_bao_cao_tuan;
create policy anon_read_baocao on tk_bao_cao_tuan for select to anon using (true);

-- ------------------------------------------------------------
-- RPC: tổng hợp số liệu tuần chứa p_ngay -> upsert tk_bao_cao_tuan.du_lieu.
-- KHÔNG đụng tom_tat (worker giữ). Trả về ngày thứ 2 của tuần báo cáo.
-- Mặc định p_ngay = HÔM QUA (VN) để chạy đầu tuần chốt tuần vừa kết thúc.
-- ------------------------------------------------------------
create or replace function tk_tao_bao_cao_tuan(
  -- Mặc định: CHỦ NHẬT tuần trước = tuần VỪA KẾT THÚC. Chạy tay giữa tuần (không nhập ngày)
  -- vẫn ra tuần đã chốt, KHÔNG đè tuần đang diễn ra bằng dữ liệu dở dang.
  p_ngay date default ((date_trunc('week', (now() at time zone 'Asia/Ho_Chi_Minh')::date)::date) - 1)
)
returns date
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tuan  date := date_trunc('week', p_ngay)::date;   -- thứ 2 tuần báo cáo
  v_het   date := v_tuan + 6;                          -- chủ nhật cuối tuần
  v_truoc date := v_tuan - 7;                          -- thứ 2 tuần trước (so sánh)
  v_du    jsonb;
begin
  -- Chốt lại điểm tuần với ĐỦ dữ liệu tới hết chủ nhật: cron 006 tính điểm mỗi ngày cho
  -- TUẦN HIỆN TẠI, nên lần ghi cuối cho tuần này là CN 02:15 VN (chỉ thấy tới hết thứ 7).
  -- Tính lại ở đây để xếp hạng phủ cùng phạm vi thứ 2–CN như KPI. Chỉ áp cho tuần vừa kết
  -- thúc (v_het trong ~3 ngày) để không tính lại tuần CŨ bằng snapshot hiện tại (sai lịch sử).
  if v_het >= (((now() at time zone 'Asia/Ho_Chi_Minh')::date) - 3) then
    perform tk_tinh_diem_tuan(v_het);
  end if;

  v_du := jsonb_build_object(
    'ky', jsonb_build_object(
      'tuan', v_tuan, 'tu', v_tuan, 'den', v_het, 'tuan_truoc', v_truoc
    ),

    -- KPI hệ thống. tong_follower là metric MỨC: tổng follower hiện có = snapshot mới nhất
    -- mỗi kênh (kênh im lặng/TOKEN_LOI vẫn giữ follower đã biết — đúng cho "cơ sở follower").
    -- Các delta bên dưới mới là hoạt động RIÊNG trong tuần (chặn between v_tuan..v_het).
    'he_thong', jsonb_build_object(
      'tong_follower', coalesce((
        select sum(f.follower) from (
          select distinct on (s.kenh_id) s.follower
          from tk_snapshot_kenh s
          join tk_kenh k on k.id = s.kenh_id and k.trang_thai in ('HOAT_DONG','TOKEN_LOI')
          where s.ngay <= v_het
          order by s.kenh_id, s.ngay desc
        ) f
      ), 0),
      'follower_tang',       coalesce((select sum(follower_tang) from tk_metric_ngay where ngay between v_tuan and v_het), 0),
      'follower_tang_truoc', coalesce((select sum(follower_tang) from tk_metric_ngay where ngay between v_truoc and v_tuan - 1), 0),
      'video_moi',           coalesce((select sum(video_moi)     from tk_metric_ngay where ngay between v_tuan and v_het), 0),
      'video_moi_truoc',     coalesce((select sum(video_moi)     from tk_metric_ngay where ngay between v_truoc and v_tuan - 1), 0),
      'view_tang',           coalesce((select sum(xem_tang)      from tk_metric_ngay where ngay between v_tuan and v_het), 0),
      'view_tang_truoc',     coalesce((select sum(xem_tang)      from tk_metric_ngay where ngay between v_truoc and v_tuan - 1), 0),
      'thich_tang',          coalesce((select sum(thich_tang)    from tk_metric_ngay where ngay between v_tuan and v_het), 0),
      'chiase_tang',         coalesce((select sum(chiase_tang)   from tk_metric_ngay where ngay between v_tuan and v_het), 0),
      'so_kenh_hoat_dong',   (select count(*) from tk_kenh where trang_thai = 'HOAT_DONG')
    ),

    -- Phân bố hạng A/B/C/D của tuần báo cáo. 'tong' = số kênh CÓ điểm (d_tong not null)
    -- = A+B+C+D (mỗi d_tong not null rơi đúng 1 bucket) -> frontend hiển thị khớp badge.
    'phan_hang', (
      select jsonb_build_object(
        'A', count(*) filter (where d_tong >= 80),
        'B', count(*) filter (where d_tong >= 65 and d_tong < 80),
        'C', count(*) filter (where d_tong >= 50 and d_tong < 65),
        'D', count(*) filter (where d_tong < 50),
        'tong', count(*) filter (where d_tong is not null)
      ) from tk_diem_tuan where tuan = v_tuan
    ),

    -- Top 5 kênh theo điểm + biến động hạng so tuần trước.
    'top_kenh', coalesce((
      select jsonb_agg(x) from (
        select jsonb_build_object(
          'kenh_id', d.kenh_id,
          'ten', coalesce('@' || k.username, k.ma_ch),
          'khu_vuc', k.khu_vuc,
          'd_tong', d.d_tong,
          'hang', d.hang,
          'hang_truoc', p.hang
        ) as x
        from tk_diem_tuan d
        join tk_kenh k on k.id = d.kenh_id
        left join tk_diem_tuan p on p.kenh_id = d.kenh_id and p.tuan = v_truoc
        where d.tuan = v_tuan
        order by d.d_tong desc nulls last
        limit 5
      ) t
    ), '[]'::jsonb),

    -- Bứt phá: tăng hạng nhiều nhất so tuần trước.
    'but_pha', coalesce((
      select jsonb_agg(x) from (
        select jsonb_build_object(
          'kenh_id', d.kenh_id,
          'ten', coalesce('@' || k.username, k.ma_ch),
          'hang', d.hang, 'hang_truoc', p.hang,
          'tang', (p.hang - d.hang)
        ) as x
        from tk_diem_tuan d
        join tk_diem_tuan p on p.kenh_id = d.kenh_id and p.tuan = v_truoc
        join tk_kenh k on k.id = d.kenh_id
        where d.tuan = v_tuan and (p.hang - d.hang) > 0
        order by (p.hang - d.hang) desc
        limit 3
      ) t
    ), '[]'::jsonb),

    -- Video nổi bật: tăng view nhiều nhất trong tuần (mới hoặc cũ còn nóng).
    'video_noi_bat', coalesce((
      select jsonb_agg(x) from (
        select jsonb_build_object(
          'video_id', v.video_id,
          'kenh_id', v.kenh_id,
          'ten_kenh', coalesce('@' || k.username, k.ma_ch),
          'tieu_de', left(coalesce(nullif(v.tieu_de, ''), v.mo_ta, ''), 120),
          'nhan', v.nhan,
          'share_url', v.share_url,
          'view_tang', g.view_tang
        ) as x
        from tk_video v
        join tk_kenh k on k.id = v.kenh_id
        join lateral (
          select greatest(
            coalesce((select s.luot_xem from tk_snapshot_video s
                      where s.video_id = v.video_id and s.ngay <= v_het
                      order by s.ngay desc limit 1), 0)
            - coalesce((select s.luot_xem from tk_snapshot_video s
                        where s.video_id = v.video_id and s.ngay <= v_tuan - 1
                        order by s.ngay desc limit 1), 0),
            0) as view_tang
        ) g on true
        where (v.dang_luc at time zone 'Asia/Ho_Chi_Minh')::date >= v_tuan - 120  -- tiền lọc: chỉ video còn trong cửa sổ theo dõi
          and exists (
            select 1 from tk_snapshot_video s
            where s.video_id = v.video_id and s.ngay between v_tuan and v_het
          )
        order by g.view_tang desc
        limit 5
      ) t
    ), '[]'::jsonb),

    -- Kênh ngừng đăng (cảnh báo NGUNG_DANG phát trong tuần), 1 dòng/kênh.
    'ngung_dang', coalesce((
      select jsonb_agg(x) from (
        select distinct on (c.kenh_id)
          jsonb_build_object(
            'kenh_id', c.kenh_id,
            'ten', coalesce('@' || k.username, k.ma_ch),
            'noi_dung', c.noi_dung
          ) as x, c.kenh_id
        from tk_canh_bao c
        join tk_kenh k on k.id = c.kenh_id
        where c.loai = 'NGUNG_DANG'
          and (c.phat_hien_luc at time zone 'Asia/Ho_Chi_Minh')::date between v_tuan and v_het
        order by c.kenh_id, c.phat_hien_luc desc
      ) t
    ), '[]'::jsonb),

    -- Đếm cảnh báo phát sinh trong tuần theo mức độ.
    'canh_bao', (
      select jsonb_build_object(
        'moi',       count(*) filter (where trang_thai = 'MOI'),
        'khan',      count(*) filter (where muc_do = 'KHAN'),
        'chu_y',     count(*) filter (where muc_do = 'CHU_Y'),
        'thong_tin', count(*) filter (where muc_do = 'THONG_TIN')
      ) from tk_canh_bao
      where (phat_hien_luc at time zone 'Asia/Ho_Chi_Minh')::date between v_tuan and v_het
    ),

    -- Video đăng trong tuần theo nhãn nội dung.
    'theo_nhan', coalesce((
      select jsonb_object_agg(nhan_k, cnt) from (
        select coalesce(nhan, 'CHUA') as nhan_k, count(*) as cnt
        from tk_video
        where (dang_luc at time zone 'Asia/Ho_Chi_Minh')::date between v_tuan and v_het
        group by coalesce(nhan, 'CHUA')
      ) t
    ), '{}'::jsonb),

    -- Tổng hợp theo khu vực: số kênh, follower, điểm trung bình.
    'theo_khu_vuc', coalesce((
      select jsonb_agg(x order by (x->>'follower')::numeric desc) from (
        select jsonb_build_object(
          'khu_vuc', coalesce(k.khu_vuc, 'Khác'),
          'so_kenh', count(distinct k.id),
          'follower', coalesce(sum(lf.follower), 0),
          'diem_tb', round(avg(d.d_tong)::numeric, 1)
        ) as x
        from tk_kenh k
        left join lateral (
          select s.follower from tk_snapshot_kenh s
          where s.kenh_id = k.id and s.ngay <= v_het
          order by s.ngay desc limit 1
        ) lf on true
        left join tk_diem_tuan d on d.kenh_id = k.id and d.tuan = v_tuan
        where k.trang_thai in ('HOAT_DONG','TOKEN_LOI')
        group by coalesce(k.khu_vuc, 'Khác')
      ) t
    ), '[]'::jsonb)
  );

  insert into tk_bao_cao_tuan (tuan, du_lieu, tao_luc)
  values (v_tuan, v_du, now())
  on conflict (tuan) do update
    set du_lieu = excluded.du_lieu, tao_luc = excluded.tao_luc;

  return v_tuan;
end;
$$;
revoke all on function tk_tao_bao_cao_tuan(date) from public, anon;
grant execute on function tk_tao_bao_cao_tuan(date) to service_role;

-- ------------------------------------------------------------
-- Lịch pg_cron: chủ nhật 22:30 UTC = thứ 2 05:30 VN.
-- Gọi không tham số -> dùng mặc định (CN tuần trước = tuần vừa kết thúc).
-- Chạy trước worker (thứ 2 06:00 VN) để digest sẵn sàng cho Claude.
-- ------------------------------------------------------------
select cron.unschedule('tk_bao_cao_tuan')
  where exists (select 1 from cron.job where jobname = 'tk_bao_cao_tuan');

select cron.schedule('tk_bao_cao_tuan', '30 22 * * 0',
  $$ select tk_tao_bao_cao_tuan(); $$);
