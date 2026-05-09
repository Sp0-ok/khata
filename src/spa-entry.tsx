// Dedicated SPA entry for the Capacitor Android build (and any static host).
// TanStack Start's normal client entry uses `hydrateRoot`, which expects SSR
// markup — inside Capacitor there is none, so the WebView ends up blank.
// This entry boots the router with `createRoot` instead.
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { getRouter } from "./router";
import { applyStoredTheme } from "./lib/theme";
import { loadCurrency } from "./lib/format";
import { Toaster } from "./components/ui/sonner";
import { clearRadixLocks, installAndroidFreezeWatchdog, nativeLog } from "./lib/androidStability";
import "./styles.css";

// Surface any uncaught error inside the WebView instead of freezing silently.
function showFatal(msg: string) {
  try {
    const root = document.getElementById("root");
    if (root) {
      root.innerHTML = `<div style="padding:16px;font:14px/1.4 system-ui;color:#b91c1c;white-space:pre-wrap;word-break:break-word">App error:\n${msg}</div>`;
    }
  } catch {}
}
window.addEventListener("error", (e) => {
  console.error("[fatal]", e.error || e.message);
  showFatal(String(e.error?.stack || e.error?.message || e.message));
});
window.addEventListener("unhandledrejection", (e) => {
  console.error("[fatal-promise]", e.reason);
  showFatal(String((e.reason as any)?.stack || (e.reason as any)?.message || e.reason));
});

const router = getRouter();
const queryClient = router.options.context!.queryClient;
installAndroidFreezeWatchdog();
router.subscribe("onBeforeNavigate", () => { clearRadixLocks(); nativeLog("nav:before", location.pathname); });
router.subscribe("onLoad", () => { clearRadixLocks(); nativeLog("nav:loaded", location.pathname); });

applyStoredTheme();
loadCurrency();

const el = document.getElementById("root")!;
// Note: no <StrictMode> — double-mount interacts badly with Radix focus
// trap inside the Capacitor WebView and can freeze the UI on dialog open.
createRoot(el).render(
  <QueryClientProvider client={queryClient}>
    <RouterProvider router={router} />
    <Toaster richColors position="top-center" />
  </QueryClientProvider>,
);
