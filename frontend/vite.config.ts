import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// @contracts → ../shared/contracts (타입을 복사하지 않고 공용 계약을 직접 import)
// @seed      → ../data/seed       (mock 모드가 시드 JSON을 그대로 읽음)
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@contracts": fileURLToPath(new URL("../shared/contracts", import.meta.url)),
      "@seed": fileURLToPath(new URL("../data/seed", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    fs: { allow: [".."] },
    host: true,
    allowedHosts: [".trycloudflare.com"],
  },
});
