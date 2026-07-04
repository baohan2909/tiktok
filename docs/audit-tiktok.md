# Hồ sơ Audit TikTok — Non Son Analytics

Tài liệu chuẩn bị nộp **TikTok App Review** để chuyển app từ Sandbox sang Production
(mở khóa kết nối > 10 tài khoản, tiến tới 200 kênh chuỗi Nón Sơn).

> Điền các link/thông tin thật vào chỗ `⟪...⟫` trước khi nộp.

---

## 1. Thông tin app

| Mục | Giá trị |
|---|---|
| Tên app | Non Son Analytics |
| Client key (sandbox) | `sbaw7f2glhuu5qvn6l` |
| Loại | Internal analytics (nội bộ doanh nghiệp) |
| Nền tảng | Web (Login Kit) |
| Redirect URI | `https://dosfidaqatczisbjtpls.supabase.co/functions/v1/oauth-callback` |
| Website | `https://baohan2909.github.io/tiktok/` |
| Privacy Policy URL | `https://baohan2909.github.io/tiktok/privacy.html` |
| Terms URL | `https://baohan2909.github.io/tiktok/terms.html` |
| Email liên hệ | `quantrinonson@gmail.com` |

---

## 2. Mô tả use case (dán vào form review — English)

> Non Son Analytics is an **internal business analytics dashboard** operated by Non Son,
> a hat and helmet retail chain in Vietnam with ~200 stores. Each store runs its own
> TikTok account for product marketing and livestream selling. Store staff **explicitly
> authorize** our app via TikTok Login Kit so that Non Son head office can monitor the
> **public performance** of these owned accounts in one place: follower growth, posting
> consistency, and video reach. Data is used solely for internal management and coaching
> of our own stores. We do not sell, share, or advertise with this data. There is no
> public-facing product; the dashboard is restricted to Non Son management.

---

## 3. Giải trình từng scope (bắt buộc — mỗi scope phải nêu lý do)

| Scope | Dùng để làm gì | Field API sử dụng |
|---|---|---|
| `user.info.basic` | Xác định tài khoản đã kết nối (open_id), hiển thị đã liên kết | `open_id`, `avatar_url` |
| `user.info.profile` | Hiển thị @username của cửa hàng trên dashboard quản trị | `username`, `display_name` |
| `user.info.stats` | **Chỉ số cốt lõi**: theo dõi tăng trưởng follower, tổng like, số video của kênh cửa hàng | `follower_count`, `following_count`, `likes_count`, `video_count` |
| `video.list` | Đo hiệu quả nội dung: lượt xem/thích/bình luận/chia sẻ của video công khai để tư vấn cửa hàng đăng gì hiệu quả | `id`, `create_time`, `title`, `view_count`, `like_count`, `comment_count`, `share_count` |

**Nguyên tắc:** chỉ đọc dữ liệu **công khai** của **tài khoản do chính cửa hàng sở hữu và tự
nguyện cấp quyền**. Không xin quyền đăng bài, nhắn tin, hay bất kỳ quyền ghi nào.

---

## 4. Xử lý & bảo mật dữ liệu (Data Handling — English cho reviewer)

- **Collection:** only after explicit OAuth consent by the account owner (store staff).
- **Scope of data:** public profile + public account/video statistics listed above. No
  passwords, no private messages, no drafts.
- **Storage:** Supabase (PostgreSQL), EU/AP region. Access tokens encrypted at rest in
  Supabase Vault; refresh tokens never stored in plaintext.
- **Access control:** Row Level Security. The public dashboard reads non-sensitive
  aggregates via a publishable key; tokens are readable only by the server-side
  service role. No secret is exposed to the browser.
- **Retention:** snapshots retained for trend analysis; periodically aggregated. Older
  raw video snapshots rolled up after 180 days.
- **Deletion / revocation:** an account owner may revoke at any time from TikTok
  (Settings → Security → Apps and websites) or by emailing us; upon revocation, tokens
  are deleted and collection stops immediately.

---

## 5. Video demo (bắt buộc) — xem [demo-video-script.md](demo-video-script.md)

Quay 1 video 1–2 phút thể hiện: mở link connect → đăng nhập TikTok → màn hình consent
(thấy rõ các scope) → kết nối thành công → dashboard hiển thị số liệu của chính tài khoản đó.

---

## 6. Checklist trước khi nộp

- [ ] Privacy Policy URL mở được, có mục thu thập/dùng/lưu/xóa dữ liệu ✅ (đã host)
- [ ] Terms URL mở được ✅ (đã host)
- [ ] Redirect URI khớp chính xác app config ✅
- [ ] Website URL mở được, mô tả rõ app ✅ (dashboard live)
- [ ] Mô tả use case (mục 2) dán vào form
- [ ] Giải trình từng scope (mục 3) dán vào form
- [ ] Video demo quay xong, upload (mục 5)
- [ ] Data handling (mục 4) dán vào phần mô tả xử lý dữ liệu
- [ ] Kiểm tra domain verification (meta tag + file txt vẫn còn) ✅

## 7. Quy trình nộp (trên TikTok for Developers)

1. Vào **Manage apps** → app của anh → chuyển từ Sandbox sang môi trường **Production**.
2. Điền đầy đủ: mô tả, scopes + lý do, privacy/terms URL, redirect, video demo.
3. Submit for review → chờ TikTok duyệt (~1–2 tuần).
4. Nếu bị từ chối: TikTok ghi lý do cụ thể → sửa (thường là privacy chưa đủ mục, hoặc
   video chưa thể hiện rõ luồng consent) → nộp lại.

## 8. Mẹo tăng khả năng đậu

- Video demo phải **thấy rõ màn hình consent của TikTok** (danh sách quyền) và **thấy dữ
  liệu của đúng tài khoản vừa cấp** hiện lên dashboard — chứng minh đúng mục đích khai báo.
- Nhấn mạnh **"tài khoản do chính doanh nghiệp sở hữu, cấp quyền tự nguyện, dùng nội bộ"**.
- Không xin scope thừa. Mỗi scope đều phải map tới một tính năng thấy được trên dashboard.
