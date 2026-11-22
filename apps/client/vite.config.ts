import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
export default defineConfig({
  root: "apps/client",
  plugins: [vue()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:3000" },
  },
  build: {
    outDir: "../../dist/client",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("@tiptap") || id.includes("prosemirror"))
              return "editor";
            if (id.includes("vue") || id.includes("pinia")) return "vue";
            if (id.includes("zod")) return "validation";
          }
        },
      },
    },
  },
});
