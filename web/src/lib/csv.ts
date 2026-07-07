// Xuất CSV mở được bằng Excel (BOM UTF-8, xuống dòng CRLF, escape chuẩn).
export function taiCSV(
  tenFile: string,
  header: string[],
  rows: (string | number | null | undefined)[][],
): void {
  const esc = (v: string | number | null | undefined): string => {
    const s = v == null ? "" : String(v);
    return /[",\r\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = tenFile;
  a.click();
  URL.revokeObjectURL(a.href);
}
