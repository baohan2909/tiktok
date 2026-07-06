import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { isoNgayTruoc } from "../lib/format";
import type {
  Kenh,
  SnapshotKenh,
  MetricNgay,
  Video,
  SnapshotVideo,
  CanhBao,
  DiemTuan,
  SyncLog,
  BaoCaoTuan,
  PhienLive,
  PtYeuTo,
  PtDna,
  PtVideo,
  PtVideoRow,
  PtMaTranCell,
} from "../lib/types";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../lib/config";

// Lấy HẾT dòng, vượt trần mặc định ~1000 của PostgREST bằng cách lặp .range().
async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const SIZE = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += SIZE) {
    const { data, error } = await page(from, from + SIZE - 1);
    if (error) throw error;
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < SIZE) break;
  }
  return out;
}

export function useKenhs() {
  return useQuery({
    queryKey: ["kenhs"],
    queryFn: async (): Promise<Kenh[]> => {
      const { data, error } = await supabase.from("tk_kenh").select("*").order("ma_ch");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSnapshotsKenh(days = 84) {
  return useQuery({
    queryKey: ["snapshots_kenh", days],
    queryFn: () =>
      fetchAll<SnapshotKenh>((from, to) =>
        supabase
          .from("tk_snapshot_kenh")
          .select("*")
          .gte("ngay", isoNgayTruoc(days))
          .order("ngay")
          .order("kenh_id") // khóa phụ -> thứ tự duy nhất, phân trang ổn định
          .range(from, to),
      ),
  });
}

export function useMetricsTuan(days = 7) {
  return useQuery({
    queryKey: ["metrics_tuan", days],
    queryFn: () =>
      fetchAll<MetricNgay>((from, to) =>
        supabase
          .from("tk_metric_ngay")
          .select("*")
          .gte("ngay", isoNgayTruoc(days))
          .order("ngay")
          .order("kenh_id") // thứ tự duy nhất cho phân trang
          .range(from, to),
      ),
  });
}

export function useCanhBao(kenhId?: number) {
  return useQuery({
    queryKey: ["canh_bao", kenhId ?? "all"],
    queryFn: async (): Promise<CanhBao[]> => {
      let q = supabase
        .from("tk_canh_bao")
        .select("*")
        .order("phat_hien_luc", { ascending: false })
        .limit(50);
      if (kenhId != null) q = q.eq("kenh_id", kenhId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useKenhSnapshots(kenhId: number | undefined, days = 84) {
  return useQuery({
    enabled: kenhId != null,
    queryKey: ["kenh_snaps", kenhId, days],
    queryFn: () =>
      fetchAll<SnapshotKenh>((from, to) =>
        supabase
          .from("tk_snapshot_kenh")
          .select("*")
          .eq("kenh_id", kenhId!)
          .gte("ngay", isoNgayTruoc(days))
          .order("ngay")
          .order("kenh_id")
          .range(from, to),
      ),
  });
}

export function useKenhVideos(kenhId: number | undefined) {
  return useQuery({
    enabled: kenhId != null,
    queryKey: ["kenh_videos", kenhId],
    queryFn: async (): Promise<Video[]> => {
      const { data, error } = await supabase
        .from("tk_video")
        .select("*")
        .eq("kenh_id", kenhId!)
        .order("dang_luc", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useVideoSnapshots(videoIds: string[]) {
  const key = videoIds.slice().sort().join(",");
  return useQuery({
    enabled: videoIds.length > 0,
    queryKey: ["video_snaps", key],
    queryFn: async (): Promise<SnapshotVideo[]> => {
      // Chia lô 100 id/lần: tránh URL .in() quá dài (>8KB -> 414) + phân trang ổn định
      const CHUNK = 100;
      const out: SnapshotVideo[] = [];
      for (let i = 0; i < videoIds.length; i += CHUNK) {
        const ids = videoIds.slice(i, i + CHUNK);
        const rows = await fetchAll<SnapshotVideo>((from, to) =>
          supabase
            .from("tk_snapshot_video")
            .select("*")
            .in("video_id", ids)
            .order("ngay")
            .order("video_id")
            .range(from, to),
        );
        out.push(...rows);
      }
      return out;
    },
  });
}

// Health Score các tuần gần đây (mọi kênh) — Xếp hạng + radar + biến động hạng.
export function useDiemTuan(weeks = 8) {
  return useQuery({
    queryKey: ["diem_tuan", weeks],
    queryFn: () =>
      fetchAll<DiemTuan>((from, to) =>
        supabase
          .from("tk_diem_tuan")
          .select("*")
          .gte("tuan", isoNgayTruoc(weeks * 7))
          .order("tuan")
          .order("kenh_id")
          .range(from, to),
      ),
  });
}

export function useSyncLog(limitN = 20) {
  return useQuery({
    queryKey: ["sync_log", limitN],
    queryFn: async (): Promise<SyncLog[]> => {
      const { data, error } = await supabase
        .from("tk_sync_log")
        .select("*")
        .order("bat_dau", { ascending: false })
        .limit(limitN);
      if (error) throw error;
      return data ?? [];
    },
  });
}

// Báo cáo tuần (mới -> cũ). Mỗi tuần 1 dòng, JSONB nhỏ — lấy vài tuần gần nhất.
export function useBaoCaoTuan(limitN = 12) {
  return useQuery({
    queryKey: ["bao_cao_tuan", limitN],
    queryFn: async (): Promise<BaoCaoTuan[]> => {
      const { data, error } = await supabase
        .from("tk_bao_cao_tuan")
        .select("*")
        .order("tuan", { ascending: false })
        .limit(limitN);
      if (error) throw error;
      return (data ?? []) as unknown as BaoCaoTuan[];
    },
  });
}

// Gạt trạng thái cảnh báo (anon được phép update trang_thai).
export async function datTrangThaiCanhBao(id: number, trang_thai: string): Promise<void> {
  const { error } = await supabase.from("tk_canh_bao").update({ trang_thai }).eq("id", id);
  if (error) throw error;
}

// ---- Analytics Engine (Phase 4) — gọi RPC pt_* tính trong Postgres ----
export function usePtYeuTo(days = 90) {
  return useQuery({
    queryKey: ["pt_yeu_to", days],
    queryFn: async (): Promise<PtYeuTo | null> => {
      const { data, error } = await supabase.rpc("pt_yeu_to", { p_ngay: days });
      if (error) throw error;
      return (data ?? null) as PtYeuTo | null;
    },
  });
}

export function usePtDna() {
  return useQuery({
    queryKey: ["pt_dna"],
    queryFn: async (): Promise<PtDna | null> => {
      const { data, error } = await supabase.rpc("pt_dna");
      if (error) throw error;
      return (data ?? null) as PtDna | null;
    },
  });
}

// Kho video explorer — xếp theo view server-side (không giới hạn "300 bài mới nhất").
export function usePtVideoExplorer(days = 30, limitN = 400) {
  return useQuery({
    queryKey: ["pt_video_explorer", days, limitN],
    queryFn: async (): Promise<PtVideoRow[]> => {
      const { data, error } = await supabase.rpc("pt_video_explorer", { p_ngay: days, p_limit: limitN });
      if (error) throw error;
      return (data ?? []) as PtVideoRow[];
    },
  });
}

export function usePtMaTran(days = 90) {
  return useQuery({
    queryKey: ["pt_ma_tran", days],
    queryFn: async (): Promise<PtMaTranCell[]> => {
      const { data, error } = await supabase.rpc("pt_ma_tran", { p_ngay: days });
      if (error) throw error;
      return (data ?? []) as PtMaTranCell[];
    },
  });
}

// Kích hoạt sync thủ công qua Edge Function trigger-sync (dispatch workflow GitHub).
// Luôn resolve về {ok,...} — kể cả khi mạng/CORS lỗi (không reject).
export async function kichHoatSync(): Promise<{ ok: boolean; thong_bao?: string; ly_do?: string }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/trigger-sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    });
    return await res.json();
  } catch {
    return { ok: false, ly_do: "khong ket noi duoc (kiem tra Edge Function trigger-sync)" };
  }
}

export function usePtVideo(videoId: string | undefined) {
  return useQuery({
    enabled: !!videoId,
    queryKey: ["pt_video", videoId],
    queryFn: async (): Promise<PtVideo | null> => {
      const { data, error } = await supabase.rpc("pt_video", { p_video_id: videoId });
      if (error) throw error;
      return (data ?? null) as PtVideo | null;
    },
  });
}

// Nhật ký live của 1 kênh (mới -> cũ).
export function useKenhLive(kenhId: number | undefined) {
  return useQuery({
    enabled: kenhId != null,
    queryKey: ["kenh_live", kenhId],
    queryFn: async (): Promise<PhienLive[]> => {
      const { data, error } = await supabase
        .from("tk_phien_live")
        .select("*")
        .eq("kenh_id", kenhId!)
        .order("ngay", { ascending: false })
        .order("id", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data ?? [];
    },
  });
}

// Thêm phiên live (anon được phép insert; nguon mặc định TU_KHAI ở DB).
export async function themPhienLive(row: {
  kenh_id: number;
  ngay: string;
  gio_bat_dau?: string | null;
  thoi_luong_phut?: number | null;
  nguoi_xem_dinh?: number | null;
  ghi_chu?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("tk_phien_live").insert(row);
  if (error) throw error;
}
