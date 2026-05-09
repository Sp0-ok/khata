// App warm-up: open Dexie, prime queries, load theme + currency BEFORE the
// router mounts. Keeps the first tap from hitting a cold WebView.
import { db, getSetting, setSetting } from "./db";
import { applyStoredTheme } from "./theme";
import { loadCurrency } from "./format";
import { devLog } from "./deviceLog";

const TIMEOUT_MS = 5000;

function withTimeout<T>(label: string, p: Promise<T>, ms = TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timeout ${ms}ms`)), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

export async function runWarmup(): Promise<void> {
  devLog("warmup:start");
  try {
    devLog("warmup:db-open");
    await withTimeout("db.open", db.open());
    devLog("warmup:db-open-ok");

    devLog("warmup:prime");
    await withTimeout("prime", Promise.all([
      db.parties.count(),
      db.transactions.count(),
    ]).then(([p, t]) => devLog("warmup:counts", { parties: p, tx: t })));

    devLog("warmup:theme+currency");
    await withTimeout("theme+currency", Promise.all([applyStoredTheme(), loadCurrency()]));

    // One frame settle
    await new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    devLog("warmup:done");
  } catch (e) {
    devLog("warmup:error", e, "error");
    throw e;
  }
}

export async function isOnboardingDone(): Promise<boolean> {
  try { return !!(await getSetting<boolean>("onboarding_done", false)); }
  catch { return false; }
}

export async function markOnboardingDone(): Promise<void> {
  try { await setSetting("onboarding_done", true); } catch {}
}
