import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Served from a sub-path on the demo host, e.g. BASE_PATH=/ticketing-seat-hold/
  base: process.env.BASE_PATH ?? "/",
  plugins: [vue()],
  server: {
    proxy: { "/api": "http://localhost:8000" },
  },
  test: {
    environment: "jsdom",
  },
});
