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
const ALWAYS_ON_LOG_ID = "__khata_always_on_devlog";

let buffer: DeviceLogEntry[] = [];
let snapshot: DeviceLogEntry[] = buffer;
let listeners = new Set<() => void>();
let loaded = false;
let alwaysOnPanel: HTMLDivElement | null = null;
let alwaysOnBody: HTMLDivElement | null = null;
let fallbackCopyButton: HTMLButtonElement | null = null;

function formatDeviceLogText() {
  const lines = buffer.map((e) => {
    const ts = new Date(e.t).toISOString().slice(11, 23);
    return `[${ts}] ${e.level.toUpperCase().padEnd(5)} ${e.name}${e.detail ? ` :: ${e.detail}` : ""}`;
  });
  return [
    "KhataBook device log",
    `When: ${new Date().toISOString()}`,
    `UA: ${navigator.userAgent}`,
    `Viewport: ${innerWidth}x${innerHeight} dpr=${devicePixelRatio}`,
    `URL: ${location.href}`,
    `Entries: ${buffer.length}`,
    "--------",
    ...lines,
  ].join("\n");
}

async function copyDeviceLogText() {
  const text = formatDeviceLogText();
  try {
    await navigator.clipboard.writeText(text);
    devLog("always-log:copy", "ok");
    return;
  } catch {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    devLog("always-log:copy", ok ? "ok-fallback" : "fail", ok ? "info" : "warn");
  } catch (e) {
    devLog("always-log:copy", e, "warn");
  }
}

function ensureAlwaysOnLogPanel() {
  if (typeof document === "undefined") return;

  const attach = () => {
    if (alwaysOnPanel && document.documentElement.contains(alwaysOnPanel)) return;
    if (!document.body) return;

    const existing = document.getElementById(ALWAYS_ON_LOG_ID) as HTMLDivElement | null;
    if (existing) {
      alwaysOnPanel = existing;
      alwaysOnBody = existing.querySelector("[data-log-body]") as HTMLDivElement | null;
      fallbackCopyButton = existing.querySelector("button") as HTMLButtonElement | null;
      updateAlwaysOnLogPanel();
      return;
    }

    alwaysOnPanel = document.createElement("div");
    alwaysOnPanel.id = ALWAYS_ON_LOG_ID;
    alwaysOnPanel.setAttribute("aria-live", "polite");
    Object.assign(alwaysOnPanel.style, {
      position: "fixed",
      top: "0",
      left: "0",
      right: "0",
      zIndex: "2147483646",
      maxHeight: "34vh",
      overflow: "hidden",
      pointerEvents: "auto",
      background: "rgba(2, 6, 23, 0.9)",
      color: "#e2e8f0",
      font: "10px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace",
      padding: "calc(env(safe-area-inset-top, 0px) + 6px) 8px 7px",
      boxSizing: "border-box",
      borderBottom: "1px solid rgba(148, 163, 184, 0.45)",
      boxShadow: "0 8px 24px rgba(0, 0, 0, 0.28)",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
    });

    const header = document.createElement("div");
    header.setAttribute("data-log-header", "true");
    Object.assign(header.style, {
      color: "#f8fafc",
      fontWeight: "700",
      marginBottom: "3px",
      paddingRight: "72px",
    });

    fallbackCopyButton = document.createElement("button");
    fallbackCopyButton.type = "button";
    fallbackCopyButton.textContent = "COPY";
    Object.assign(fallbackCopyButton.style, {
      position: "absolute",
      top: "calc(env(safe-area-inset-top, 0px) + 6px)",
      right: "8px",
      height: "24px",
      padding: "0 10px",
      borderRadius: "4px",
      border: "1px solid rgba(148, 163, 184, 0.7)",
      background: "rgba(15, 23, 42, 0.95)",
      color: "#f8fafc",
      font: "700 10px ui-monospace, SFMono-Regular, Menlo, monospace",
    });
    fallbackCopyButton.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      copyDeviceLogText();
    });

    alwaysOnBody = document.createElement("div");
    alwaysOnBody.setAttribute("data-log-body", "true");
    Object.assign(alwaysOnBody.style, {
      opacity: "0.92",
      maxHeight: "calc(34vh - 24px)",
      overflow: "hidden",
    });

    alwaysOnPanel.appendChild(header);
    alwaysOnPanel.appendChild(fallbackCopyButton);
    alwaysOnPanel.appendChild(alwaysOnBody);
    document.body.appendChild(alwaysOnPanel);
    updateAlwaysOnLogPanel();
  };

  if (document.body) attach();
  else document.addEventListener("DOMContentLoaded", attach, { once: true });
}

function updateAlwaysOnLogPanel() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (!alwaysOnPanel || !document.documentElement.contains(alwaysOnPanel)) {
    ensureAlwaysOnLogPanel();
  }
  if (!alwaysOnPanel || !alwaysOnBody) return;

  const header = alwaysOnPanel.querySelector("[data-log-header]") as HTMLDivElement | null;
  if (header) {
    header.textContent = `DBG LOG ALWAYS ON · ${buffer.length} events · ${innerWidth}×${innerHeight}`;
  }

  const recent = buffer.slice(-9).reverse();
  alwaysOnBody.textContent = recent.length
    ? recent
        .map((e) => {
          const ts = new Date(e.t).toISOString().slice(11, 23);
          const level = e.level === "error" ? "ERR" : e.level === "warn" ? "WRN" : "INF";
          const detail = e.detail ? ` :: ${e.detail.slice(0, 220)}` : "";
          return `${ts} ${level} ${e.name}${detail}`;
        })
        .join("\n")
    : "Waiting for events...";
}

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) { buffer = parsed.slice(-MAX_ENTRIES); snapshot = buffer.slice(); }
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
  snapshot = buffer.slice();
  updateAlwaysOnLogPanel();
  scheduleSave();
  listeners.forEach((l) => {
    try { l(); } catch {}
  });
  if (level === "error") console.error("[devlog]", name, entry.detail ?? "");
  else if (level === "warn") console.warn("[devlog]", name, entry.detail ?? "");
}

export function getDeviceLog(): DeviceLogEntry[] {
  load();
  return snapshot;
}

export function clearDeviceLog() {
  buffer = [];
  snapshot = buffer;
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  updateAlwaysOnLogPanel();
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
  ensureAlwaysOnLogPanel();
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
