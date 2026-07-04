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
} from "../lib/types";

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
    queryFn: async (): Promise<SnapshotKenh[]> => {
      const { data, error } = await supabase
        .from("tk_snapshot_kenh")
        .select("*")
        .gte("ngay", isoNgayTruoc(days))
        .order("ngay");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMetricsTuan(days = 7) {
  return useQuery({
    queryKey: ["metrics_tuan", days],
    queryFn: async (): Promise<MetricNgay[]> => {
      const { data, error } = await supabase
        .from("tk_metric_ngay")
        .select("*")
        .gte("ngay", isoNgayTruoc(days));
      if (error) throw error;
      return data ?? [];
    },
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
    queryFn: async (): Promise<SnapshotKenh[]> => {
      const { data, error } = await supabase
        .from("tk_snapshot_kenh")
        .select("*")
        .eq("kenh_id", kenhId!)
        .gte("ngay", isoNgayTruoc(days))
        .order("ngay");
      if (error) throw error;
      return data ?? [];
    },
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
      const { data, error } = await supabase
        .from("tk_snapshot_video")
        .select("*")
        .in("video_id", videoIds)
        .order("ngay");
      if (error) throw error;
      return data ?? [];
    },
  });
}
