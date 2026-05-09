import { Capacitor } from "@capacitor/core";
import { devLog, openDebugOverlay } from "./deviceLog";

export const isNativeAndroid = () =>
  typeof window !== "undefined" &&
  Capacitor.isNativePlatform() &&
  Capacitor.getPlatform() === "android";

type EventLevel = "info" | "warn" | "error";

export function nativeLog(name: string, detail?: unknown, level: EventLevel = "info") {
  // Forward everything into the persistent on-device log
  devLog(name, detail, level);
}

export async function withNativeTimeout<T>(label: string, work: Promise<T>, ms = 8000): Promise<T> {
  const started = performance.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    const elapsed = Math.round(performance.now() - started);
    if (elapsed > 700) nativeLog(`slow:${label}`, `${elapsed}ms`, elapsed > ms ? "error" : "warn");
  }
}

export function afterNativeFrame(fn: () => void) {
  requestAnimationFrame(() => setTimeout(fn, 0));
}

export function clearRadixLocks() {
  if (typeof document === "undefined") return;
  document.body.style.overflow = "";
  document.body.style.pointerEvents = "";
  document.body.removeAttribute("data-scroll-locked");
  document.documentElement.style.pointerEvents = "";
}

export function installAndroidFreezeWatchdog() {
  if (typeof window === "undefined" || !isNativeAndroid() || (window as any).__KHATA_WATCHDOG__) return;
  (window as any).__KHATA_WATCHDOG__ = true;
  let last = performance.now();
  const tick = () => {
    const now = performance.now();
    const gap = now - last;
    if (gap > 2500) nativeLog("main-thread-freeze", `${Math.round(gap)}ms`, "error");
    last = now;
    setTimeout(tick, 1000);
  };
  setTimeout(tick, 1000);
  ["pointerdown", "click", "touchstart"].forEach((type) => {
    window.addEventListener(type, (e) => {
      const target = e.target as HTMLElement | null;
      nativeLog(`event:${type}`, target?.tagName?.toLowerCase());
    }, { passive: true, capture: true });
  });
}