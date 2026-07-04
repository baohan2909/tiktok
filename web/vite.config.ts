import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Repo tên `tiktok` -> GitHub Pages phục vụ tại /tiktok/
// Multi-page: index.html (dashboard React) + connect.html (onboarding OAuth)
export default defineConfig({
  base: "/tiktok/",
  plugins: [react()],
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: "index.html",
        connect: "connect.html",
      },
    },
  },
});
