-- ============================================================
-- NS TIKTOK COMMAND CENTER — 005_fixes.sql
-- Sửa lỗi từ vòng rà soát tiền-deploy. Chạy sau 004_oauth_rpc.sql.
-- An toàn chạy lại (idempotent).
-- ============================================================

-- ------------------------------------------------------------
-- FIX (#6/#10): username UNIQUE gây va chạm khi onboard. TikTok username
-- vốn duy nhất theo tài khoản nên không cần ràng buộc DB; bỏ để tránh
-- unique_violation làm hỏng luồng kết nối.
-- ------------------------------------------------------------
alter table tk_kenh drop constraint if exists tk_kenh_username_key;

-- ------------------------------------------------------------
-- FIX (#6/#10): oauth_luu_ket_noi nhận diện theo open_id TRƯỚC (danh tính
-- tài khoản TikTok), rồi mới tới ma_ch. Tránh INSERT/UPDATE đụng open_id
-- unique khi nối lại hoặc gửi nhầm mã CH.
-- ------------------------------------------------------------
create or replace function oauth_luu_ket_noi(
  p_ma_ch              text,
  p_open_id            text,
  p_username           text,
  p_access_token       text,
  p_access_expires_in  int,
  p_refresh_token      text,
  p_refresh_expires_in int
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kenh_id   bigint;
  v_secret_id uuid;
begin
  -- nhận diện theo open_id trước (một tài khoản = một kênh), rồi tới ma_ch
  select id into v_kenh_id from tk_kenh where open_id = p_open_id;
  if v_kenh_id is null then
    select id into v_kenh_id from tk_kenh where ma_ch = p_ma_ch;
  end if;

  if v_kenh_id is null then
    insert into tk_kenh (ma_ch, ten_ch, username, open_id, trang_thai, ket_noi_luc)
    values (p_ma_ch, p_ma_ch, p_username, p_open_id, 'HOAT_DONG', now())
    returning id into v_kenh_id;
  else
    update tk_kenh
    set open_id     = p_open_id,
        username    = coalesce(p_username, username),
        trang_thai  = 'HOAT_DONG',
        ket_noi_luc = now()
    where id = v_kenh_id;
  end if;

  -- refresh_token -> Vault (tái dùng secret nếu đã có)
  select refresh_token_id into v_secret_id from tk_token where kenh_id = v_kenh_id;
  if v_secret_id is null then
    select id into v_secret_id from vault.secrets where name = 'tk_refresh_' || v_kenh_id::text;
  end if;

  if v_secret_id is null then
    v_secret_id := vault.create_secret(
      p_refresh_token,
      'tk_refresh_' || v_kenh_id::text,
      'TikTok refresh token kenh ' || v_kenh_id::text
    );
  else
    perform vault.update_secret(v_secret_id, p_refresh_token);
  end if;

  insert into tk_token (kenh_id, refresh_token_id, access_token, access_het_han, refresh_het_han, loi_gan_nhat)
  values (
    v_kenh_id, v_secret_id, p_access_token,
    now() + make_interval(secs => p_access_expires_in),
    now() + make_interval(secs => p_refresh_expires_in),
    null
  )
  on conflict (kenh_id) do update
    set refresh_token_id = excluded.refresh_token_id,
        access_token     = excluded.access_token,
        access_het_han   = excluded.access_het_han,
        refresh_het_han  = excluded.refresh_het_han,
        loi_gan_nhat     = null;

  return v_kenh_id;
end;
$$;
revoke all on function oauth_luu_ket_noi(text,text,text,text,int,text,int) from public, anon;
grant execute on function oauth_luu_ket_noi(text,text,text,text,int,text,int) to service_role;

-- ------------------------------------------------------------
-- FIX (#12): oauth_ds_can_refresh bỏ qua kênh có refresh_token đã hết hạn
-- (dùng token chết chỉ tổ thất bại và có thể xoay mất token).
-- ------------------------------------------------------------
create or replace function oauth_ds_can_refresh()
returns table (kenh_id bigint, refresh_token text, refresh_het_han timestamptz)
language sql
security definer
set search_path = public
as $$
  select t.kenh_id, s.decrypted_secret, t.refresh_het_han
  from tk_token t
  join tk_kenh k on k.id = t.kenh_id
  join vault.decrypted_secrets s on s.id = t.refresh_token_id
  where k.trang_thai in ('HOAT_DONG', 'TOKEN_LOI')
    and (t.refresh_het_han is null or t.refresh_het_han > now());
$$;
revoke all on function oauth_ds_can_refresh() from public, anon;
grant execute on function oauth_ds_can_refresh() to service_role;

-- ------------------------------------------------------------
-- FIX (#14): video_moi = delta tổng số video, kẹp không âm (cửa hàng xóa
-- video làm so_video giảm -> video_moi âm là vô nghĩa). follower_tang vẫn
-- cho phép âm (người bỏ theo dõi là hợp lệ).
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
    greatest(coalesce(k.so_video - kp.so_video, 0), 0),
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
