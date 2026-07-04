import { defineConfig } from "vite";

// Repo tên `tiktok` -> GitHub Pages phục vụ tại /tiktok/
// Multi-page: index.html (dashboard) + connect.html (onboarding OAuth)
export default defineConfig({
  base: "/tiktok/",
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
