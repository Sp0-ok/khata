// Persistent on-device event log. Survives reloads/crashes via localStorage.
// Visible through DebugOverlay so we get ground truth from the Android device
// without needing chrome://inspect or adb.

export type LogLevel = "info" | "warn" | "error";

export interface DeviceLogEntry {
  t: number; // epoch ms
  level: LogLevel;
  name: string;
  detail?: string;
}

const STORAGE_KEY = "__khata_devlog_v1";
const MAX_ENTRIES = 250;

let buffer: DeviceLogEntry[] = [];
let listeners = new Set<() => void>();
let loaded = false;

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) buffer = parsed.slice(-MAX_ENTRIES);
    }
  } catch {}
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleSave() {
  if (typeof window === "undefined") return;
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(buffer));
    } catch {}
  }, 250);
}

function detailToString(detail: unknown): string | undefined {
  if (detail == null) return undefined;
  if (detail instanceof Error) return (detail.stack || detail.message).slice(0, 1500);
  if (typeof detail === "string") return detail.slice(0, 1500);
  try {
    return JSON.stringify(detail).slice(0, 1500);
  } catch {
    return String(detail).slice(0, 1500);
  }
}

export function devLog(name: string, detail?: unknown, level: LogLevel = "info") {
  load();
  const entry: DeviceLogEntry = { t: Date.now(), level, name, detail: detailToString(detail) };
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) buffer.splice(0, buffer.length - MAX_ENTRIES);
  scheduleSave();
  listeners.forEach((l) => {
    try { l(); } catch {}
  });
  if (level === "error") console.error("[devlog]", name, entry.detail ?? "");
  else if (level === "warn") console.warn("[devlog]", name, entry.detail ?? "");
}

export function getDeviceLog(): DeviceLogEntry[] {
  load();
  return [...buffer];
}

export function clearDeviceLog() {
  buffer = [];
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  listeners.forEach((l) => l());
}

export function subscribeDeviceLog(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Open the overlay programmatically (e.g. from the watchdog)
export function openDebugOverlay() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("khata:open-debug-overlay"));
}

// Install global listeners — call once at app start.
let installed = false;
export function installDeviceLogListeners() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  load();
  devLog("app:start", { ua: navigator.userAgent, w: innerWidth, h: innerHeight });

  window.addEventListener("error", (e) => {
    devLog("window:error", (e.error && (e.error.stack || e.error.message)) || e.message, "error");
    openDebugOverlay();
  });
  window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
    const r: any = e.reason;
    devLog("window:unhandledrejection", r?.stack || r?.message || r, "error");
    openDebugOverlay();
  });
  document.addEventListener("visibilitychange", () => {
    devLog("doc:visibility", document.visibilityState);
  });
  window.addEventListener("pagehide", () => devLog("window:pagehide"));
  window.addEventListener("pageshow", () => devLog("window:pageshow"));

  // Lightweight tap breadcrumb (capture phase, passive)
  window.addEventListener(
    "pointerdown",
    (e) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const tag = t.tagName?.toLowerCase();
      const id = t.id ? `#${t.id}` : "";
      const cls = typeof t.className === "string" && t.className ? `.${t.className.split(/\s+/).slice(0, 2).join(".")}` : "";
      devLog("tap", `${tag}${id}${cls}`.slice(0, 120));
    },
    { passive: true, capture: true },
  );
}
