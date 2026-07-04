// ============================================================
// NS TIKTOK COMMAND CENTER — worker/report.mjs (Phase 2)
// Báo cáo tuần tự động: gọi RPC dựng digest số liệu (SQL) rồi để Claude Haiku
// viết NHẬN ĐỊNH ĐIỀU HÀNH (tiêu đề, điểm nhấn, nhận định, khuyến nghị) -> ghi tom_tat.
// Chạy trên GitHub Actions thứ 2 06h VN. env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY.
// Tuỳ chọn env NGAY=YYYY-MM-DD để chốt lại một tuần cũ (mặc định: tuần vừa kết thúc).
// ============================================================
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE || !ANTHROPIC_API_KEY) {
  console.error("Thieu SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / ANTHROPIC_API_KEY");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
const claude = new Anthropic(); // tự đọc ANTHROPIC_API_KEY từ env

const MODEL = "claude-haiku-4-5"; // 1 báo cáo/tuần -> chi phí không đáng kể

const TOOL = {
  name: "viet_nhan_dinh",
  description: "Viết nhận định điều hành cho báo cáo tuần chuỗi kênh TikTok Nón Sơn.",
  input_schema: {
    type: "object",
    properties: {
      tieu_de: { type: "string", description: "1 dòng tiêu đề tuần, ngắn gọn, có định hướng." },
      diem_nhan: {
        type: "array",
        items: { type: "string" },
        description: "3-5 gạch đầu dòng nổi bật nhất tuần (số liệu cụ thể, có đối chiếu tuần trước).",
      },
      nhan_dinh: { type: "string", description: "1 đoạn 2-4 câu nhận định tổng thể sức khỏe chuỗi." },
      khuyen_nghi: {
        type: "array",
        items: { type: "string" },
        description: "2-4 hành động đề xuất cho tuần tới (cụ thể, làm được ngay).",
      },
    },
    required: ["tieu_de", "diem_nhan", "nhan_dinh", "khuyen_nghi"],
  },
};

const HUONG_DAN = `Bạn là trợ lý phân tích cho chủ chuỗi cửa hàng Nón Sơn (thương hiệu nón/mũ Việt Nam), đang quản trị nhiều kênh TikTok của các cửa hàng.
Dưới đây là DIGEST số liệu tuần (JSON) đã được hệ thống tính sẵn. Hãy viết nhận định điều hành bằng TIẾNG VIỆT, giọng gọn gàng, thực tế, cho người bận rộn đọc trên điện thoại.
Nguyên tắc:
- CHỈ dùng số liệu trong digest, TUYỆT ĐỐI không bịa số. Nếu một mục trống thì bỏ qua, không suy diễn.
- So sánh tuần này với tuần trước khi digest có sẵn (follower/video/view).
- Ưu tiên nêu: kênh top, kênh bứt phá, video nổi bật để nhân rộng, kênh ngừng đăng cần nhắc.
- Không dùng emoji. Không markdown. Không xưng hô hoa mỹ. Đơn vị theo tiếng Việt (ví dụ: 12.300 lượt xem).
Trả kết quả qua công cụ viet_nhan_dinh.`;

async function vietNhanDinh(du_lieu) {
  const res = await claude.messages.create({
    model: MODEL,
    max_tokens: 1500,
    tools: [TOOL],
    tool_choice: { type: "tool", name: "viet_nhan_dinh" },
    messages: [
      { role: "user", content: HUONG_DAN + "\n\nDIGEST tuần (JSON):\n" + JSON.stringify(du_lieu) },
    ],
  });
  const tu = res.content.find((b) => b.type === "tool_use");
  return tu?.input ?? null;
}

async function main() {
  // NGAY rỗng -> bỏ tham số để RPC dùng mặc định (CN tuần trước = tuần vừa kết thúc).
  // Chỉ truyền p_ngay khi user nhập tay để chốt lại một tuần cụ thể.
  const p_ngay = process.env.NGAY?.trim() || null;
  const args = p_ngay ? { p_ngay } : {};

  // 1) SQL dựng/refresh digest số liệu cho tuần (idempotent, giữ tom_tat cũ).
  const { data: tuan, error: eRpc } = await sb.rpc("tk_tao_bao_cao_tuan", args);
  if (eRpc) {
    console.error("RPC tk_tao_bao_cao_tuan loi:", eRpc.message);
    process.exit(1);
  }
  console.log(`Digest tuan ${tuan} da san sang.`);

  // 2) Đọc digest vừa tạo.
  const { data: bc, error: eSel } = await sb
    .from("tk_bao_cao_tuan")
    .select("tuan,du_lieu")
    .eq("tuan", tuan)
    .single();
  if (eSel || !bc) {
    console.error("Doc tk_bao_cao_tuan loi:", eSel?.message ?? "khong co dong");
    process.exit(1);
  }

  // 3) Claude viết nhận định.
  let tom_tat;
  try {
    tom_tat = await vietNhanDinh(bc.du_lieu);
  } catch (e) {
    console.error("Claude viet nhan dinh loi:", String(e).slice(0, 300));
    // Digest vẫn có (bước 1) — không coi là thất bại toàn phần, thoát nhẹ.
    return;
  }
  if (!tom_tat) {
    console.error("Claude khong tra ve nhan dinh (khong co tool_use).");
    return;
  }

  // 4) Ghi tom_tat.
  const { error: eUpd } = await sb
    .from("tk_bao_cao_tuan")
    .update({ tom_tat, tom_tat_luc: new Date().toISOString() })
    .eq("tuan", tuan);
  if (eUpd) {
    console.error("Ghi tom_tat loi:", eUpd.message);
    process.exit(1);
  }
  console.log(`Xong: bao cao tuan ${tuan} — "${tom_tat.tieu_de}".`);
}

main().catch((e) => {
  console.error("report sup do:", e);
  process.exit(1);
});
