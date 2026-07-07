// Ghim kênh theo dõi nhanh — lưu localStorage (theo trình duyệt người dùng).
const KEY = "ns_pin_kenh";

export function layPins(): number[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "number") : [];
  } catch {
    return [];
  }
}

export function datPins(ids: number[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids.slice(0, 30)));
  } catch {
    /* private mode -> bỏ qua */
  }
}

export function togglePin(id: number): number[] {
  const cur = layPins();
  // Cắt trần TRƯỚC khi trả về để state UI luôn khớp những gì thật sự được lưu.
  const next = (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]).slice(0, 30);
  datPins(next);
  return next;
}
