// Kiểu dữ liệu khớp bảng Postgres (prefix tk_).
export interface Kenh {
  id: number;
  ma_ch: string;
  ten_ch: string;
  khu_vuc: string | null;
  username: string | null;
  open_id: string | null;
  trang_thai: string; // CHUA_KET_NOI | HOAT_DONG | TOKEN_LOI | TAM_NGUNG
  co_tiktok_shop: boolean | null;
  ket_noi_luc: string | null;
  ghi_chu: string | null;
}

export interface SnapshotKenh {
  kenh_id: number;
  ngay: string; // YYYY-MM-DD
  follower: number | null;
  following: number | null;
  tong_like: number | null;
  so_video: number | null;
}

export interface MetricNgay {
  kenh_id: number;
  ngay: string;
  follower_tang: number | null;
  video_moi: number | null;
  xem_tang: number | null;
  thich_tang: number | null;
  binhluan_tang: number | null;
  chiase_tang: number | null;
}

export interface Video {
  video_id: string;
  kenh_id: number;
  dang_luc: string; // ISO
  tieu_de: string | null;
  mo_ta: string | null;
  thoi_luong_s: number | null;
  cover_url: string | null;
  share_url: string | null;
  nhan: string | null;
}

export interface SnapshotVideo {
  video_id: string;
  ngay: string;
  luot_xem: number | null;
  luot_thich: number | null;
  binh_luan: number | null;
  chia_se: number | null;
}

export interface CanhBao {
  id: number;
  kenh_id: number | null;
  video_id: string | null;
  loai: string;
  muc_do: string; // THONG_TIN | CHU_Y | KHAN
  noi_dung: string | null;
  phat_hien_luc: string;
  trang_thai: string; // MOI | DA_XEM | DA_XU_LY
}
