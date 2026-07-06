-- ============================================================
-- NS TIKTOK COMMAND CENTER — 009_trigger.sql
-- Hỗ trợ nút "Cập nhật dữ liệu ngay" trên dashboard: chống spam bằng debounce
-- phía server (dashboard công khai nên không thể tin client). Edge Function
-- trigger-sync gọi xin_trigger_sync() trước khi dispatch workflow GitHub.
-- Chạy sau 008_phan_tich.sql. An toàn chạy lại.
-- ============================================================

create table if not exists tk_trigger (
  loai text primary key,               -- 'sync'
  luc  timestamptz not null default now()
);
-- Chỉ service_role (edge) đụng tới. Bật RLS + KHÔNG policy => anon bị chặn hoàn toàn.
alter table tk_trigger enable row level security;

-- Trả TRUE + ghi mốc nếu đã qua thời gian chờ; FALSE nếu bấm quá gần lần trước.
-- Nguyên tử (tránh TOCTOU khi bị spam đồng thời): dùng INSERT ... ON CONFLICT DO UPDATE
-- có mệnh đề WHERE — ON CONFLICT khóa hàng đang tranh chấp nên các request song song
-- được tuần tự hóa; chỉ hàng nào ghi/cập nhật được (RETURNING có dòng) mới coi là cho phép.
create or replace function xin_trigger_sync(p_cooldown_giay int default 120)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok boolean := false;
begin
  insert into tk_trigger (loai, luc) values ('sync', now())
  on conflict (loai) do update set luc = excluded.luc
    where tk_trigger.luc <= now() - make_interval(secs => p_cooldown_giay)
  returning true into v_ok;
  return coalesce(v_ok, false);
end;
$$;
revoke all on function xin_trigger_sync(int) from public, anon;
grant execute on function xin_trigger_sync(int) to service_role;
