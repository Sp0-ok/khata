// Dedicated SPA entry for the Capacitor Android build (and any static host).
// TanStack Start's normal client entry uses `hydrateRoot`, which expects SSR
// markup — inside Capacitor there is none, so the WebView ends up blank.
// This entry boots the router with `createRoot` instead.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { getRouter } from "./router";
import { applyStoredTheme } from "./lib/theme";
import { loadCurrency } from "./lib/format";
import { Toaster } from "./components/ui/sonner";
import "./styles.css";

const router = getRouter();
const queryClient = router.options.context.queryClient;

applyStoredTheme();
loadCurrency();

const el = document.getElementById("root")!;
createRoot(el).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  </StrictMode>,
);
