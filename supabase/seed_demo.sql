-- ============================================================
-- NS TIKTOK COMMAND CENTER — seed_demo.sql (TÙY CHỌN)
-- Tạo 4 kênh DEMO + 28 ngày snapshot + video + cảnh báo để XEM dashboard.
-- KHÔNG ảnh hưởng kênh thật (mọi thứ mang mã DEMO_...).
--
-- DỌN SẠCH sau khi xem (chạy 1 dòng này):
--   delete from tk_kenh where ma_ch like 'DEMO/_%' escape '/';
-- (cascade tự xóa snapshot, video, metric, cảnh báo của kênh demo)
-- ============================================================
do $$
declare
  v_ch    record;
  v_kid   bigint;
  v_day   int;
  v_elapsed int;
  v_base  int;
  v_fol   int;
  v_vid   int;
  v_vidid text;
  v_post  date;
  v_dd    int;
  v_view  bigint;
begin
  -- reset demo cũ (nếu chạy lại)
  delete from tk_kenh where ma_ch like 'DEMO/_%' escape '/';

  for v_ch in
    select * from (values
      ('DEMO_HN_01',  'NS Ha Noi 01', 'Bac',   'ns_hanoi01', 42000, 'HOAT_DONG'),
      ('DEMO_HCM_01', 'NS Quan 1',    'HCM',   'ns_q1',      88000, 'HOAT_DONG'),
      ('DEMO_DN_01',  'NS Da Nang',   'Trung', 'ns_danang',  15000, 'HOAT_DONG'),
      ('DEMO_CT_01',  'NS Can Tho',   'Nam',   'ns_cantho',   9000, 'TOKEN_LOI')
    ) as t(ma_ch, ten_ch, khu_vuc, username, base_fol, trang_thai)
  loop
    insert into tk_kenh (ma_ch, ten_ch, khu_vuc, username, open_id, trang_thai, ket_noi_luc)
    values (v_ch.ma_ch, v_ch.ten_ch, v_ch.khu_vuc, v_ch.username,
            'demo_' || v_ch.username, v_ch.trang_thai, now())
    returning id into v_kid;

    v_base := v_ch.base_fol;

    -- 28 ngay snapshot kenh (follower tang dan)
    for v_day in 0..27 loop
      v_elapsed := 27 - v_day;
      v_fol := v_base + v_elapsed * (v_base / 900) + ((v_day * 7) % 60);
      insert into tk_snapshot_kenh (kenh_id, ngay, follower, following, tong_like, so_video)
      values (v_kid, current_date - v_day, v_fol, 120 + v_elapsed, v_fol * 18, 40 + v_elapsed / 3);
    end loop;

    -- 6 video, moi video 10 ngay snapshot view (duong vong doi)
    for v_vid in 1..6 loop
      v_vidid := 'demo_' || v_kid || '_' || v_vid;
      v_post := current_date - (v_vid * 3);
      insert into tk_video (video_id, kenh_id, dang_luc, tieu_de, thoi_luong_s, nhan, nhan_nguon)
      values (v_vidid, v_kid, (v_post::timestamptz + interval '19 hours'),
              'Video demo ' || v_vid || ' - ' || v_ch.ten_ch, 25 + v_vid * 4,
              (array['LIVE_CUT','REVIEW','TREND','BTS','KHAC'])[1 + (v_vid % 5)], 'TAY');
      for v_dd in 0..9 loop
        if (v_post + v_dd) <= current_date then
          v_view := (v_base / 4) * (v_dd + 1) + v_vid * 1500;
          insert into tk_snapshot_video (video_id, ngay, luot_xem, luot_thich, binh_luan, chia_se)
          values (v_vidid, v_post + v_dd, v_view, (v_view / 20)::int, (v_view / 200)::int, (v_view / 500)::int);
        end if;
      end loop;
    end loop;

    -- metric 7 ngay
    for v_day in 0..6 loop
      insert into tk_metric_ngay
        (kenh_id, ngay, follower_tang, video_moi, xem_tang, thich_tang, binhluan_tang, chiase_tang)
      values (v_kid, current_date - v_day, (v_base / 900),
              case when v_day % 3 = 0 then 1 else 0 end,
              v_base * 2, v_base / 10, v_base / 100, v_base / 200);
    end loop;
  end loop;

  -- vai canh bao demo
  insert into tk_canh_bao (kenh_id, loai, muc_do, noi_dung, trang_thai)
  select id, 'TOKEN_LOI', 'KHAN', 'Token het han, can ket noi lai', 'MOI'
  from tk_kenh where ma_ch = 'DEMO_CT_01';
  insert into tk_canh_bao (kenh_id, loai, muc_do, noi_dung, trang_thai)
  select id, 'VIDEO_BUNG_NO', 'THONG_TIN', 'Co video tang view nhanh trong 24h dau', 'MOI'
  from tk_kenh where ma_ch = 'DEMO_HCM_01';
  insert into tk_canh_bao (kenh_id, loai, muc_do, noi_dung, trang_thai)
  select id, 'NGUNG_DANG', 'CHU_Y', 'Chua dang video 5 ngay', 'MOI'
  from tk_kenh where ma_ch = 'DEMO_DN_01';
end $$;
