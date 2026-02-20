import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@tanstack/react-query": "/src/shims/react-query.tsx",
      zustand: "/src/shims/zustand.ts",
    },
  },
  server: {
    port: 5173,
  },
  test: {
    environment: "jsdom",
    setupFiles: "./tests/setup.ts",
  },
});
