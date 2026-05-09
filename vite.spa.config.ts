// Standalone SPA build for the Capacitor Android wrapper.
// TanStack Start's main build emits an SSR-only entry; this companion build
// emits a plain client bundle that mounts via createRoot, so the Android
// WebView can serve a working index.html with no SSR.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  build: {
    outDir: "dist/client/spa",
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, "src/spa-entry.tsx"),
      output: {
        entryFileNames: "assets/spa-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
