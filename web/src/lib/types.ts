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

export interface DiemTuan {
  kenh_id: number;
  tuan: string; // YYYY-MM-DD (thứ 2)
  d_chuyencan: number | null;
  d_noidung: number | null;
  d_tangtruong: number | null;
  d_hitrate: number | null;
  d_live: number | null;
  d_tong: number | null;
  hang: number | null;
  hang_khuvuc: number | null;
}

export interface SyncLog {
  id: number;
  bat_dau: string | null;
  ket_thuc: string | null;
  so_kenh_ok: number | null;
  so_kenh_loi: number | null;
  chi_tiet_loi: unknown;
}

// Kênh có tên nhúng (dùng cho Video Explorer)
export interface VideoKenh extends Video {
  tk_kenh: { username: string | null; khu_vuc: string | null; ma_ch: string } | null;
}

// Phiên live tự khai (Phase 3) — nuôi trụ Live của Health Score.
export interface PhienLive {
  id: number;
  kenh_id: number;
  ngay: string;             // YYYY-MM-DD
  gio_bat_dau: string | null; // HH:MM[:SS]
  thoi_luong_phut: number | null;
  nguoi_xem_dinh: number | null;
  ghi_chu: string | null;
  nguon: string | null;     // TU_KHAI | (nguồn tự động sau này)
}

// ---- Báo cáo tuần (Phase 2) ----
// du_lieu do SQL (RPC tk_tao_bao_cao_tuan) tính; tom_tat do Claude viết.
export interface BaoCaoDuLieu {
  ky: { tuan: string; tu: string; den: string; tuan_truoc: string };
  he_thong: {
    tong_follower: number;
    follower_tang: number;
    follower_tang_truoc: number;
    video_moi: number;
    video_moi_truoc: number;
    view_tang: number;
    view_tang_truoc: number;
    thich_tang: number;
    chiase_tang: number;
    so_kenh_hoat_dong: number;
  };
  phan_hang: { A: number; B: number; C: number; D: number; tong: number };
  top_kenh: {
    kenh_id: number; ten: string; khu_vuc: string | null;
    d_tong: number | null; hang: number | null; hang_truoc: number | null;
  }[];
  but_pha: { kenh_id: number; ten: string; hang: number; hang_truoc: number; tang: number }[];
  video_noi_bat: {
    video_id: string; kenh_id: number; ten_kenh: string;
    tieu_de: string; nhan: string | null; share_url: string | null; view_tang: number;
  }[];
  ngung_dang: { kenh_id: number; ten: string; noi_dung: string | null }[];
  canh_bao: { moi: number; khan: number; chu_y: number; thong_tin: number };
  theo_nhan: Record<string, number>;
  theo_khu_vuc: { khu_vuc: string; so_kenh: number; follower: number; diem_tb: number | null }[];
}

export interface BaoCaoTomTat {
  tieu_de: string;
  diem_nhan: string[];
  nhan_dinh: string;
  khuyen_nghi: string[];
}

export interface BaoCaoTuan {
  tuan: string; // YYYY-MM-DD (thứ 2)
  du_lieu: BaoCaoDuLieu;
  tom_tat: BaoCaoTomTat | null;
  tao_luc: string | null;
  tom_tat_luc: string | null;
}
