// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
    // Prerender the SPA shell so `dist/client/index.html` exists. Capacitor needs
    // an index.html as the WebView entry point — without it `npx cap copy android`
    // fails with "The web assets directory must contain an index.html file".
    // We only prerender "/" (crawlLinks: false) so dynamic / loader-bound routes
    // don't 500 during prerender; the client-side router still handles them at
    // runtime once the SPA shell loads.
    prerender: {
      enabled: true,
      crawlLinks: false,
    },
    pages: [{ path: "/" }],
  },
});
