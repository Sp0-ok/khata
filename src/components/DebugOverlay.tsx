// On-device debug overlay. Activate by:
//   - Tapping the small floating "DBG" button (bottom-right)
//   - 3-finger tap anywhere
//   - Long-press the top-left corner (top 48x48 px) for ~700ms
//   - Adding ?debug=1 to the URL
//
// Lets the user copy/share the device log so we can diagnose freezes
// without chrome://inspect or adb.

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  clearDeviceLog,
  devLog,
  getDeviceLog,
  subscribeDeviceLog,
  type DeviceLogEntry,
} from "@/lib/deviceLog";

function useDeviceLog() {
  return useSyncExternalStore(subscribeDeviceLog, getDeviceLog, getDeviceLog);
}

function formatLog(entries: DeviceLogEntry[]) {
  const header = [
    `KhataBook device log`,
    `When: ${new Date().toISOString()}`,
    `UA: ${navigator.userAgent}`,
    `Viewport: ${innerWidth}x${innerHeight} dpr=${devicePixelRatio}`,
    `URL: ${location.href}`,
    `Entries: ${entries.length}`,
    `--------`,
  ].join("\n");
  const lines = entries.map((e) => {
    const ts = new Date(e.t).toISOString().slice(11, 23);
    return `[${ts}] ${e.level.toUpperCase().padEnd(5)} ${e.name}${e.detail ? ` :: ${e.detail}` : ""}`;
  });
  return `${header}\n${lines.join("\n")}`;
}

async function shareText(text: string) {
  // Try Capacitor Share first (gives the system share sheet on Android)
  try {
    const { Share } = await import("@capacitor/share");
    await Share.share({ title: "KhataBook log", text, dialogTitle: "Share log" });
    return true;
  } catch {}
  // Fallback to Web Share API
  try {
    if ((navigator as any).share) {
      await (navigator as any).share({ text, title: "KhataBook log" });
      return true;
    }
  } catch {}
  return false;
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
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
    return ok;
  } catch {
    return false;
  }
}

export function DebugOverlay() {
  const [open, setOpen] = useState(true);
  const entries = useDeviceLog();
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Listen for programmatic open events (e.g. watchdog)
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("khata:open-debug-overlay", onOpen);
    return () => window.removeEventListener("khata:open-debug-overlay", onOpen);
  }, []);

  // Auto-open on ?debug=1
  useEffect(() => {
    try {
      if (new URL(location.href).searchParams.get("debug") === "1") setOpen(true);
    } catch {}
  }, []);

  // 3-finger tap to open
  useEffect(() => {
    const onTouch = (e: TouchEvent) => {
      if (e.touches.length >= 3) setOpen(true);
    };
    window.addEventListener("touchstart", onTouch, { passive: true });
    return () => window.removeEventListener("touchstart", onTouch);
  }, []);

  // Long-press top-left corner
  useEffect(() => {
    const start = (e: PointerEvent) => {
      if (e.clientX > 48 || e.clientY > 48) return;
      longPressTimer.current = setTimeout(() => setOpen(true), 700);
    };
    const cancel = () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      longPressTimer.current = undefined;
    };
    window.addEventListener("pointerdown", start);
    window.addEventListener("pointerup", cancel);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("pointermove", cancel);
    return () => {
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("pointerup", cancel);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("pointermove", cancel);
    };
  }, []);

  return (
    <>
      {open && (
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 2147483647,
            background: "rgba(0,0,0,0.85)",
            color: "#e2e8f0",
            display: "flex",
            flexDirection: "column",
            height: "42vh",
            font: "12px ui-monospace,SFMono-Regular,Menlo,monospace",
          }}
        >
          <div style={{ display: "flex", gap: 6, padding: 8, background: "#0f172a", flexWrap: "wrap" }}>
            <strong style={{ flex: 1, fontSize: 13 }}>Device Log ({entries.length})</strong>
            <button
              style={btnStyle}
              onClick={async () => {
                const ok = await shareText(formatLog(entries));
                devLog("debug-overlay:share", ok ? "ok" : "fail");
              }}
            >
              Share
            </button>
            <button
              style={btnStyle}
              onClick={async () => {
                const ok = await copyText(formatLog(entries));
                devLog("debug-overlay:copy", ok ? "ok" : "fail");
              }}
            >
              Copy
            </button>
            <button
              style={btnStyle}
              onClick={() => {
                clearDeviceLog();
                devLog("debug-overlay:cleared");
              }}
            >
              Clear
            </button>
            <button style={btnStyle} onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
          <div
            style={{
              padding: "6px 8px",
              fontSize: 10,
              opacity: 0.75,
              borderBottom: "1px solid #1e293b",
              wordBreak: "break-all",
            }}
          >
            {navigator.userAgent}
            <br />
            {innerWidth}×{innerHeight} dpr={devicePixelRatio} · {location.pathname}
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
            {entries
              .slice()
              .reverse()
              .map((e, i) => {
                const color =
                  e.level === "error" ? "#fca5a5" : e.level === "warn" ? "#fcd34d" : "#cbd5e1";
                return (
                  <div
                    key={i}
                    style={{
                      borderBottom: "1px solid #1e293b",
                      padding: "3px 0",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      color,
                    }}
                  >
                    <span style={{ opacity: 0.6 }}>
                      {new Date(e.t).toISOString().slice(11, 23)}{" "}
                    </span>
                    <strong>{e.name}</strong>
                    {e.detail ? <span style={{ opacity: 0.8 }}> :: {e.detail}</span> : null}
                  </div>
                );
              })}
            {entries.length === 0 && (
              <div style={{ opacity: 0.6, padding: 20, textAlign: "center" }}>
                No events yet. Use the app, then come back.
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const btnStyle: React.CSSProperties = {
  background: "#1e293b",
  color: "#fff",
  border: "1px solid #334155",
  padding: "4px 10px",
  borderRadius: 4,
  fontSize: 11,
  fontWeight: 600,
};
