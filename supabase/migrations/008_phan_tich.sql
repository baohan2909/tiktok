-- ============================================================
-- NS TIKTOK COMMAND CENTER — 008_phan_tich.sql
-- Analytics Engine (Phase 4): trả lời "vì sao kênh/video thành công".
-- 3 RPC đọc-only cho dashboard (anon gọi được — dữ liệu nền vốn anon-SELECT
-- theo 002_rls.sql; hàm security INVOKER nên không mở thêm quyền nào).
-- Tính trong Postgres để không kéo hàng triệu dòng snapshot về trình duyệt.
-- Chạy sau 007_bao_cao_tuan.sql. An toàn chạy lại.
-- ============================================================

-- ------------------------------------------------------------
-- 1) pt_yeu_to: yếu tố hiệu quả toàn hệ thống trong cửa sổ p_ngay ngày.
--    Với mỗi chiều (nhãn nội dung / khung giờ đăng / thứ / độ dài video):
--    số video, view trung vị, ER (thích+2·bình luận+3·chia sẻ)/xem·100.
-- ------------------------------------------------------------
create or replace function pt_yeu_to(p_ngay int default 90)
returns jsonb
language sql
stable
set search_path = public
as $$
with vid as (
  select
    coalesce(v.nhan, 'CHUA') as nhan,
    (extract(hour from (v.dang_luc at time zone 'Asia/Ho_Chi_Minh'))::int / 2) * 2 as gio2,
    extract(isodow from (v.dang_luc at time zone 'Asia/Ho_Chi_Minh'))::int as thu,
    case
      when v.thoi_luong_s is null then null
      when v.thoi_luong_s < 15 then '<15s'
      when v.thoi_luong_s < 30 then '15-30s'
      when v.thoi_luong_s < 60 then '30-60s'
      else '>=60s'
    end as do_dai,
    sv.luot_xem, sv.luot_thich, sv.binh_luan, sv.chia_se
  from tk_video v
  join lateral (
    select s.luot_xem, s.luot_thich, s.binh_luan, s.chia_se
    from tk_snapshot_video s
    where s.video_id = v.video_id
    order by s.ngay desc
    limit 1
  ) sv on true
  where (v.dang_luc at time zone 'Asia/Ho_Chi_Minh')::date
          >= ((now() at time zone 'Asia/Ho_Chi_Minh')::date - p_ngay)
    and sv.luot_xem is not null
)
select jsonb_build_object(
  'so_video', (select count(*) from vid),
  'theo_nhan', coalesce((
    select jsonb_agg(x) from (
      select jsonb_build_object(
        'k', nhan, 'n', count(*),
        'med_view', round((percentile_cont(0.5) within group (order by luot_xem))::numeric, 0),
        'er', case when sum(luot_xem) > 0
              then round(sum(coalesce(luot_thich,0) + 2*coalesce(binh_luan,0) + 3*coalesce(chia_se,0))::numeric
                         / sum(luot_xem) * 100, 2) else 0 end
      ) as x
      from vid group by nhan
    ) t), '[]'::jsonb),
  'theo_gio', coalesce((
    select jsonb_agg(x) from (
      select jsonb_build_object(
        'k', gio2, 'n', count(*),
        'med_view', round((percentile_cont(0.5) within group (order by luot_xem))::numeric, 0),
        'er', case when sum(luot_xem) > 0
              then round(sum(coalesce(luot_thich,0) + 2*coalesce(binh_luan,0) + 3*coalesce(chia_se,0))::numeric
                         / sum(luot_xem) * 100, 2) else 0 end
      ) as x
      from vid group by gio2
    ) t), '[]'::jsonb),
  'theo_thu', coalesce((
    select jsonb_agg(x) from (
      select jsonb_build_object(
        'k', thu, 'n', count(*),
        'med_view', round((percentile_cont(0.5) within group (order by luot_xem))::numeric, 0),
        'er', case when sum(luot_xem) > 0
              then round(sum(coalesce(luot_thich,0) + 2*coalesce(binh_luan,0) + 3*coalesce(chia_se,0))::numeric
                         / sum(luot_xem) * 100, 2) else 0 end
      ) as x
      from vid group by thu
    ) t), '[]'::jsonb),
  'theo_dodai', coalesce((
    select jsonb_agg(x) from (
      select jsonb_build_object(
        'k', do_dai, 'n', count(*),
        'med_view', round((percentile_cont(0.5) within group (order by luot_xem))::numeric, 0),
        'er', case when sum(luot_xem) > 0
              then round(sum(coalesce(luot_thich,0) + 2*coalesce(binh_luan,0) + 3*coalesce(chia_se,0))::numeric
                         / sum(luot_xem) * 100, 2) else 0 end
      ) as x
      from vid where do_dai is not null group by do_dai
    ) t), '[]'::jsonb)
);
$$;
revoke all on function pt_yeu_to(int) from public;
grant execute on function pt_yeu_to(int) to anon, service_role;

-- ------------------------------------------------------------
-- 2) pt_dna: "DNA" hành vi theo nhóm hạng A/B/C/D của một tuần điểm
--    (mặc định tuần mới nhất). Cửa sổ hành vi = 28 ngày kết thúc chủ nhật
--    của tuần đó. Trả về mỗi nhóm: số kênh, video/tuần, view trung vị, ER,
--    giờ live/tuần, %Δ follower, cơ cấu nhãn nội dung.
-- ------------------------------------------------------------
create or replace function pt_dna(p_tuan date default null)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_tuan date;
  v_den  date;
  v_tu   date;
  v_out  jsonb;
begin
  select coalesce(p_tuan, max(tuan)) into v_tuan from tk_diem_tuan;
  if v_tuan is null then
    return null; -- chưa có điểm tuần nào
  end if;
  v_den := v_tuan + 6;
  v_tu  := v_den - 27;

  with kh as (
    select d.kenh_id,
           case when d.d_tong >= 80 then 'A'
                when d.d_tong >= 65 then 'B'
                when d.d_tong >= 50 then 'C'
                else 'D' end as nhom
    from tk_diem_tuan d
    where d.tuan = v_tuan and d.d_tong is not null
  ),
  vid as (
    select kh.nhom, kh.kenh_id, coalesce(v.nhan, 'CHUA') as nhan,
           sv.luot_xem, sv.luot_thich, sv.binh_luan, sv.chia_se
    from tk_video v
    join kh on kh.kenh_id = v.kenh_id
    join lateral (
      select s.luot_xem, s.luot_thich, s.binh_luan, s.chia_se
      from tk_snapshot_video s
      where s.video_id = v.video_id
      order by s.ngay desc limit 1
    ) sv on true
    where (v.dang_luc at time zone 'Asia/Ho_Chi_Minh')::date between v_tu and v_den
      and sv.luot_xem is not null
  ),
  base as (select nhom, count(*) as so_kenh from kh group by nhom),
  vstat as (
    select nhom, count(*) as so_video,
           percentile_cont(0.5) within group (order by luot_xem) as med_view,
           case when sum(luot_xem) > 0
             then sum(coalesce(luot_thich,0) + 2*coalesce(binh_luan,0) + 3*coalesce(chia_se,0))::numeric
                  / sum(luot_xem) * 100 else 0 end as er
    from vid group by nhom
  ),
  nmix as (
    select nhom, jsonb_object_agg(nhan, cnt) as mix
    from (select nhom, nhan, count(*) as cnt from vid group by nhom, nhan) t
    group by nhom
  ),
  folc as (
    select kh.nhom,
           (select follower from tk_snapshot_kenh s
            where s.kenh_id = kh.kenh_id and s.ngay <= v_den order by s.ngay desc limit 1) as f1,
           (select follower from tk_snapshot_kenh s
            where s.kenh_id = kh.kenh_id and s.ngay <= v_tu order by s.ngay desc limit 1) as f0
    from kh
  ),
  fol as (
    select nhom, round(avg(case when f0 > 0 then (f1 - f0)::numeric / f0 * 100 end), 2) as tang_pct
    from folc group by nhom
  ),
  liv as (
    select kh.nhom, sum(coalesce(pl.thoi_luong_phut, 0))::numeric / 60.0 as gio
    from kh
    join tk_phien_live pl on pl.kenh_id = kh.kenh_id and pl.ngay between v_tu and v_den
    group by kh.nhom
  )
  select jsonb_build_object(
    'tuan', v_tuan,
    'nhom', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nhom', b.nhom,
        'so_kenh', b.so_kenh,
        'video_tuan', round(coalesce(v.so_video, 0)::numeric / b.so_kenh / 4.0, 1),
        'med_view', round(coalesce(v.med_view, 0)::numeric, 0),
        'er', round(coalesce(v.er, 0)::numeric, 2),
        'live_gio_tuan', round(coalesce(l.gio, 0) / b.so_kenh / 4.0, 1),
        'tang_follower_pct', f.tang_pct,
        'nhan_mix', coalesce(n.mix, '{}'::jsonb)
      ) order by b.nhom)
      from base b
      left join vstat v using (nhom)
      left join nmix  n using (nhom)
      left join fol   f using (nhom)
      left join liv   l using (nhom)
    ), '[]'::jsonb)
  )
  into v_out;

  return v_out;
end;
$$;
revoke all on function pt_dna(date) from public;
grant execute on function pt_dna(date) to anon, service_role;

-- ------------------------------------------------------------
-- 3) pt_video: giải phẫu MỘT video — so với trung vị kênh + trung vị hệ thống
--    (video đăng 90 ngày gần nhất), percentile view, view 24h đầu vs P95,
--    ER video vs ER kênh vs ER hệ thống. Trả null nếu video không tồn tại.
-- ------------------------------------------------------------
create or replace function pt_video(p_video_id text)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  r      record;
  l      record;
  v_moc  date := ((now() at time zone 'Asia/Ho_Chi_Minh')::date - 90);
  v_out  jsonb;
begin
  select v.video_id, v.kenh_id, v.dang_luc, v.nhan, v.thoi_luong_s,
         k.username, k.ma_ch
  into r
  from tk_video v join tk_kenh k on k.id = v.kenh_id
  where v.video_id = p_video_id;
  if not found then
    return null;
  end if;

  select luot_xem, luot_thich, binh_luan, chia_se
  into l
  from tk_snapshot_video
  where video_id = p_video_id
  order by ngay desc limit 1;

  with win as (
    select v.video_id, v.kenh_id,
           sv.luot_xem, sv.luot_thich, sv.binh_luan, sv.chia_se
    from tk_video v
    join lateral (
      select s.luot_xem, s.luot_thich, s.binh_luan, s.chia_se
      from tk_snapshot_video s
      where s.video_id = v.video_id
      order by s.ngay desc limit 1
    ) sv on true
    where (v.dang_luc at time zone 'Asia/Ho_Chi_Minh')::date >= v_moc
      and sv.luot_xem is not null
  ),
  dau as (
    select v.video_id,
           (select s.luot_xem from tk_snapshot_video s
            where s.video_id = v.video_id
              and s.ngay <= ((v.dang_luc at time zone 'Asia/Ho_Chi_Minh')::date + 1)
            order by s.ngay asc limit 1) as view_dau
    from tk_video v
    where (v.dang_luc at time zone 'Asia/Ho_Chi_Minh')::date >= v_moc
  )
  select jsonb_build_object(
    'video_id', r.video_id,
    'kenh_id', r.kenh_id,
    'ten_kenh', coalesce('@' || r.username, r.ma_ch),
    'nhan', r.nhan,
    'thoi_luong_s', r.thoi_luong_s,
    'gio_dang', extract(hour from (r.dang_luc at time zone 'Asia/Ho_Chi_Minh'))::int,
    'thu_dang', extract(isodow from (r.dang_luc at time zone 'Asia/Ho_Chi_Minh'))::int,
    'xem', l.luot_xem, 'thich', l.luot_thich, 'binh_luan', l.binh_luan, 'chia_se', l.chia_se,
    'er', case when coalesce(l.luot_xem, 0) > 0
          then round((coalesce(l.luot_thich,0) + 2*coalesce(l.binh_luan,0) + 3*coalesce(l.chia_se,0))::numeric
                     / l.luot_xem * 100, 2) end,
    'kenh_med_view', (select round((percentile_cont(0.5) within group (order by luot_xem))::numeric, 0)
                      from win w where w.kenh_id = r.kenh_id),
    'sys_med_view',  (select round((percentile_cont(0.5) within group (order by luot_xem))::numeric, 0) from win),
    'so_video_sosanh', (select count(*) from win),
    'pct_view', case when l.luot_xem is null then null else
                  (select round((count(*) filter (where w.luot_xem <= l.luot_xem))::numeric
                                / nullif(count(*), 0), 3) from win w) end,
    'er_kenh', (select case when sum(luot_xem) > 0
                 then round(sum(coalesce(luot_thich,0) + 2*coalesce(binh_luan,0) + 3*coalesce(chia_se,0))::numeric
                            / sum(luot_xem) * 100, 2) end
                from win w where w.kenh_id = r.kenh_id),
    'er_sys',  (select case when sum(luot_xem) > 0
                 then round(sum(coalesce(luot_thich,0) + 2*coalesce(binh_luan,0) + 3*coalesce(chia_se,0))::numeric
                            / sum(luot_xem) * 100, 2) end
                from win),
    'view_ngay_dau', (select view_dau from dau where dau.video_id = r.video_id),
    'p95_ngay_dau', (select round((percentile_cont(0.95) within group (order by view_dau))::numeric, 0)
                     from dau where view_dau is not null)
  )
  into v_out;

  return v_out;
end;
$$;
revoke all on function pt_video(text) from public;
grant execute on function pt_video(text) to anon, service_role;

-- ------------------------------------------------------------
-- 4) pt_video_explorer: kho video toàn hệ thống trong p_ngay ngày, kèm view/ER
--    của snapshot MỚI NHẤT, xếp theo view giảm dần NGAY TRONG SQL rồi mới cắt
--    p_limit. Nhờ vậy "video xem nhiều nhất" là trên toàn cửa sổ (không bị giới
--    hạn "300 bài mới nhất") và dashboard không phải kéo hàng nghìn snapshot.
-- ------------------------------------------------------------
create or replace function pt_video_explorer(p_ngay int default 30, p_limit int default 400)
returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(jsonb_agg(x), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'video_id', v.video_id,
      'kenh_id', v.kenh_id,
      'username', k.username,
      'khu_vuc', k.khu_vuc,
      'ma_ch', k.ma_ch,
      'tieu_de', v.tieu_de,
      'mo_ta', v.mo_ta,
      'nhan', v.nhan,
      'dang_luc', v.dang_luc,
      'share_url', v.share_url,
      'xem', sv.luot_xem,
      'thich', sv.luot_thich,
      'binh_luan', sv.binh_luan,
      'chia_se', sv.chia_se,
      'er', case when coalesce(sv.luot_xem, 0) > 0
            then round((coalesce(sv.luot_thich,0) + 2*coalesce(sv.binh_luan,0) + 3*coalesce(sv.chia_se,0))::numeric
                       / sv.luot_xem * 100, 2) end
    ) as x
    from tk_video v
    join tk_kenh k on k.id = v.kenh_id
    join lateral (
      select s.luot_xem, s.luot_thich, s.binh_luan, s.chia_se
      from tk_snapshot_video s
      where s.video_id = v.video_id
      order by s.ngay desc limit 1
    ) sv on true
    where (v.dang_luc at time zone 'Asia/Ho_Chi_Minh')::date
            >= ((now() at time zone 'Asia/Ho_Chi_Minh')::date - p_ngay)
      and sv.luot_xem is not null
    order by sv.luot_xem desc
    limit p_limit
  ) t;
$$;
revoke all on function pt_video_explorer(int, int) from public;
grant execute on function pt_video_explorer(int, int) to anon, service_role;
