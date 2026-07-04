// ============================================================
// NS TIKTOK COMMAND CENTER — worker/classify.mjs (Phase 2)
// Phân loại nhãn nội dung video mới bằng Claude Haiku (LIVE_CUT/REVIEW/TREND/BTS/KHAC).
// Chạy trên GitHub Actions 03h VN. env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY.
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

const MODEL = "claude-haiku-4-5"; // BLUEPRINT chỉ định Haiku cho phân loại (rẻ, số lượng lớn)
const NHANS = ["LIVE_CUT", "REVIEW", "TREND", "BTS", "KHAC"];
const BATCH = 40;      // số video/lần gọi
const MAX_VIDEO = 400; // trần mỗi lần chạy (kiểm soát chi phí)

const TOOL = {
  name: "ghi_nhan",
  description: "Ghi nhãn nội dung cho từng video theo id.",
  input_schema: {
    type: "object",
    properties: {
      ket_qua: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            nhan: { type: "string", enum: NHANS },
          },
          required: ["id", "nhan"],
        },
      },
    },
    required: ["ket_qua"],
  },
};

const HUONG_DAN = `Bạn phân loại video TikTok của cửa hàng Nón Sơn (thương hiệu nón/mũ Việt Nam) vào ĐÚNG 1 nhãn:
- LIVE_CUT: cắt từ buổi livestream bán hàng (dấu hiệu: "live", "livestream", "phiên live", số phiên theo ngày như 7.7).
- REVIEW: giới thiệu/đánh giá một sản phẩm cụ thể (thường có mã sản phẩm như MC249F, MC025B; giới thiệu mẫu nón).
- TREND: bắt trend, nhạc/hiệu ứng thịnh hành, hashtag xu hướng (#hottrend #xuhuong #fyp mang tính trend).
- BTS: hậu trường, hoạt động cửa hàng/nhân viên, quá trình làm việc.
- KHAC: không rõ hoặc không thuộc các nhãn trên.
Chỉ dựa vào tiêu đề + mô tả được cung cấp. Trả về nhãn cho TỪNG video theo đúng id qua công cụ ghi_nhan.`;

async function phanLoai(list) {
  const res = await claude.messages.create({
    model: MODEL,
    max_tokens: 4096,
    tools: [TOOL],
    tool_choice: { type: "tool", name: "ghi_nhan" },
    messages: [
      { role: "user", content: HUONG_DAN + "\n\nDanh sách video (JSON):\n" + JSON.stringify(list) },
    ],
  });
  const tu = res.content.find((b) => b.type === "tool_use");
  return tu?.input?.ket_qua ?? [];
}

async function main() {
  const { data: videos, error } = await sb
    .from("tk_video")
    .select("video_id,tieu_de,mo_ta")
    .is("nhan", null)
    .limit(MAX_VIDEO);
  if (error) {
    console.error("Query tk_video loi:", error.message);
    process.exit(1);
  }
  if (!videos?.length) {
    console.log("Khong co video can phan loai.");
    return;
  }

  console.log(`Phan loai ${videos.length} video (model ${MODEL})...`);
  let ok = 0;
  for (let i = 0; i < videos.length; i += BATCH) {
    const batch = videos.slice(i, i + BATCH);
    const list = batch.map((v) => ({
      id: v.video_id,
      text: ((v.tieu_de ?? "") + " " + (v.mo_ta ?? "")).slice(0, 300),
    }));

    let ket_qua;
    try {
      ket_qua = await phanLoai(list);
    } catch (e) {
      console.error(`  Loi lo ${i}-${i + BATCH}: ${String(e).slice(0, 200)}`);
      continue;
    }

    // Gom theo nhãn -> cập nhật hàng loạt (mỗi lô <=40 id nên URL .in an toàn)
    const byNhan = {};
    for (const r of ket_qua) {
      if (r && NHANS.includes(r.nhan)) (byNhan[r.nhan] ??= []).push(String(r.id));
    }
    for (const [nhan, ids] of Object.entries(byNhan)) {
      const e = (await sb.from("tk_video").update({ nhan, nhan_nguon: "AUTO" }).in("video_id", ids)).error;
      if (e) console.error(`  Update nhan ${nhan} loi: ${e.message}`);
      else ok += ids.length;
    }
    console.log(`  Da xu ly ${Math.min(i + BATCH, videos.length)}/${videos.length}`);
  }
  console.log(`Xong: ${ok} video duoc gan nhan.`);
}

main().catch((e) => {
  console.error("classify sup do:", e);
  process.exit(1);
});
