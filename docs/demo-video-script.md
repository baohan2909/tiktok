# Kịch bản video demo OAuth — cho hồ sơ Audit TikTok

Mục tiêu: chứng minh với reviewer rằng app **xin quyền đúng mục đích, người dùng tự nguyện
cấp, và chỉ dùng dữ liệu công khai của chính tài khoản đó**. Dài **60–120 giây**, quay màn
hình (screen recording), có thể thêm giọng thuyết minh hoặc phụ đề tiếng Anh.

> Quay bằng tài khoản TikTok đã là **Target User** của sandbox (hiện tại là
> @thainguyen.nonson) để luồng chạy thật.

---

## Phân cảnh

| # | Thời lượng | Hình ảnh trên màn hình | Thuyết minh / phụ đề (English) |
|---|---|---|---|
| 1 | 0–8s | Mở `https://baohan2909.github.io/tiktok/connect.html?ch=NS_TEST_01` — trang connect Nón Sơn 3 bước | "This is our internal onboarding page. A store staff member opens the link we sent them." |
| 2 | 8–14s | Bấm nút **Kết nối TikTok** | "They click Connect TikTok to link their own store account." |
| 3 | 14–28s | Màn hình đăng nhập + **consent của TikTok** — **DỪNG LẠI cho thấy rõ danh sách quyền** (user.info.basic/profile/stats, video.list) | "TikTok shows the exact permissions requested — read-only access to public profile and public video stats. The account owner explicitly authorizes." |
| 4 | 28–34s | Bấm **Authorize** → chuyển về trang **"Kết nối thành công"** (hiện @handle) | "After consent, we confirm the connection." |
| 5 | 34–55s | Mở dashboard `https://baohan2909.github.io/tiktok/` → tab **Chi tiết kênh** → chọn đúng @handle vừa kết nối → cho thấy follower, video, lượt xem **của chính tài khoản đó** | "The dashboard now shows this account's own public metrics: follower growth, videos, and reach — used internally to coach our store." |
| 6 | 55–65s | Lướt qua: bảng video, biểu đồ, heatmap lịch đăng | "We use this only for internal performance management across our ~200 owned store accounts. No data is sold or shared." |
| 7 (tùy) | 65–80s | Mở TikTok app → Settings → Security → Apps and websites → cho thấy có thể **thu hồi** | "The owner can revoke access anytime; we then delete tokens and stop collecting." |

---

## Lưu ý khi quay

- **Bắt buộc thấy rõ màn hình consent** (cảnh 3) — đây là phần reviewer soi kỹ nhất.
- Số liệu hiện trên dashboard phải **đúng là của tài khoản vừa cấp quyền** (cảnh 5) — chứng
  minh app dùng dữ liệu đúng như khai báo, không lạm dụng.
- Không cần lộ thông tin nhạy cảm; toàn bộ là dữ liệu công khai.
- Xuất video mp4, độ phân giải ≥ 720p, upload theo yêu cầu form review.
