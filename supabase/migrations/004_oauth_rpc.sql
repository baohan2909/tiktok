-- ============================================================
-- NS TIKTOK COMMAND CENTER — 004_oauth_rpc.sql
-- RPC dùng cho Edge Functions oauth-callback / oauth-refresh.
-- Toàn bộ thao tác Vault nằm trong SQL (security definer), edge chỉ gọi rpc.
-- Chạy sau 003_cron.sql.
-- ============================================================

-- ------------------------------------------------------------
-- Lưu kết nối OAuth: upsert kênh (match ma_ch) + refresh_token vào Vault + upsert token.
-- Trả về kenh_id.
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
  -- tìm hoặc tạo kênh theo ma_ch
  select id into v_kenh_id from tk_kenh where ma_ch = p_ma_ch;
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

  -- refresh_token -> Vault (tái dùng secret nếu đã có, tránh mồ côi)
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

  -- upsert token
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
-- Danh sách kênh cần refresh access_token (kèm refresh_token đã giải mã).
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
  where k.trang_thai in ('HOAT_DONG', 'TOKEN_LOI');
$$;
revoke all on function oauth_ds_can_refresh() from public, anon;
grant execute on function oauth_ds_can_refresh() to service_role;

-- ------------------------------------------------------------
-- Cập nhật token sau refresh thành công.
-- ------------------------------------------------------------
create or replace function oauth_cap_nhat_token(
  p_kenh_id            bigint,
  p_access_token       text,
  p_access_expires_in  int,
  p_refresh_token      text default null,
  p_refresh_expires_in int  default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret_id uuid;
begin
  update tk_token
  set access_token   = p_access_token,
      access_het_han = now() + make_interval(secs => p_access_expires_in),
      refresh_het_han = case when p_refresh_expires_in is not null
                             then now() + make_interval(secs => p_refresh_expires_in)
                             else refresh_het_han end,
      loi_gan_nhat = null
  where kenh_id = p_kenh_id
  returning refresh_token_id into v_secret_id;

  if p_refresh_token is not null and v_secret_id is not null then
    perform vault.update_secret(v_secret_id, p_refresh_token);
  end if;

  update tk_kenh set trang_thai = 'HOAT_DONG'
  where id = p_kenh_id and trang_thai = 'TOKEN_LOI';
end;
$$;
revoke all on function oauth_cap_nhat_token(bigint,text,int,text,int) from public, anon;
grant execute on function oauth_cap_nhat_token(bigint,text,int,text,int) to service_role;

-- ------------------------------------------------------------
-- Báo lỗi token (refresh thất bại) -> TOKEN_LOI + cảnh báo KHAN.
-- ------------------------------------------------------------
create or replace function oauth_bao_loi_token(p_kenh_id bigint, p_loi text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update tk_token set loi_gan_nhat = p_loi where kenh_id = p_kenh_id;
  update tk_kenh  set trang_thai = 'TOKEN_LOI' where id = p_kenh_id;
  insert into tk_canh_bao (kenh_id, loai, muc_do, noi_dung)
  values (p_kenh_id, 'TOKEN_LOI', 'KHAN', coalesce(p_loi, 'Refresh token that bai'));
end;
$$;
revoke all on function oauth_bao_loi_token(bigint,text) from public, anon;
grant execute on function oauth_bao_loi_token(bigint,text) to service_role;

-- ------------------------------------------------------------
-- Cảnh báo refresh_token sắp hết hạn (<30 ngày), không trùng cảnh báo MOI.
-- ------------------------------------------------------------
create or replace function oauth_canh_bao_token_sap_het()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into tk_canh_bao (kenh_id, loai, muc_do, noi_dung)
  select t.kenh_id, 'TOKEN_SAP_HET', 'CHU_Y',
         'Refresh token con han den ' || to_char(t.refresh_het_han, 'YYYY-MM-DD')
  from tk_token t
  where t.refresh_het_han is not null
    and t.refresh_het_han < now() + interval '30 days'
    and not exists (
      select 1 from tk_canh_bao c
      where c.kenh_id = t.kenh_id and c.loai = 'TOKEN_SAP_HET' and c.trang_thai = 'MOI'
    );
end;
$$;
revoke all on function oauth_canh_bao_token_sap_het() from public, anon;
grant execute on function oauth_canh_bao_token_sap_het() to service_role;
