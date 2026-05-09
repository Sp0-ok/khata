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
import { installDeviceLogListeners, devLog, openDebugOverlay } from "./lib/deviceLog";
import { OnboardingGate } from "./components/OnboardingGate";
import { DebugOverlay } from "./components/DebugOverlay";
import "./styles.css";

// Bring up persistent on-device logging FIRST so we capture everything,
// including bootstrap errors.
installDeviceLogListeners();

// Surface any uncaught error inside the WebView instead of freezing silently.
function showFatal(msg: string) {
  devLog("fatal", msg, "error");
  openDebugOverlay();
  try {
    const root = document.getElementById("root");
    if (root && !root.hasChildNodes()) {
      root.innerHTML = `<div style="padding:16px;font:14px/1.4 system-ui;color:#b91c1c;white-space:pre-wrap;word-break:break-word">App error:\n${msg}</div>`;
    }
  } catch {
    // Last-resort error UI must never throw.
  }
}
window.addEventListener("error", (e) =>
  showFatal(String(e.error?.stack || e.error?.message || e.message)),
);
window.addEventListener("unhandledrejection", (e) => {
  const reason = e.reason;
  showFatal(String(reason instanceof Error ? reason.stack || reason.message : reason));
});

const router = getRouter();
const queryClient = router.options.context!.queryClient;
installAndroidFreezeWatchdog();
router.subscribe("onBeforeNavigate", () => {
  clearRadixLocks();
  nativeLog("nav:before", location.pathname);
});
router.subscribe("onLoad", () => {
  clearRadixLocks();
  nativeLog("nav:loaded", location.pathname);
});

applyStoredTheme();
loadCurrency();

const el = document.getElementById("root")!;
// Note: no <StrictMode> — double-mount interacts badly with Radix focus
// trap inside the Capacitor WebView and can freeze the UI on dialog open.
createRoot(el).render(
  <QueryClientProvider client={queryClient}>
    <OnboardingGate>
      <RouterProvider router={router} />
    </OnboardingGate>
    <DebugOverlay />
    <Toaster richColors position="top-center" />
  </QueryClientProvider>,
);
