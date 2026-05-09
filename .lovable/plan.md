## Goal

Stop guessing. Get **real evidence** from the Android device about what's freezing the WebView, then act on facts.

Good news from a quick audit: no app routes still import Radix `Dialog`, `DropdownMenu`, `Select`, `AlertDialog`, `Popover`, `Sheet`, `Tooltip`, etc. directly. Only the shadcn UI files cross-reference each other. So a blanket "rip out all Radix" is probably wasted work — the remaining freeze is more likely something else (DB call, navigation hang, asset load, etc.). We need the device to tell us.

## Phase 1 — Ship a device debug overlay (do this BEFORE any more Radix work)

Goal: when the app freezes on your phone, you can see exactly what was happening, no `adb`, no Chrome inspector required.

1. **`src/lib/deviceLog.ts`** (new) — small ring buffer (last 200 events), persisted to `localStorage` so it survives crashes. Wrap the existing `nativeLog` to also push here. Capture:
   - every navigation (before / after)
   - every `nativeLog` event
   - every `withNativeTimeout` start / finish / timeout
   - all `window.error` and `unhandledrejection`
   - tap target tag + id/class
   - Dexie open / query errors
   - `document.visibilitychange` and `pagehide` (tells us if WebView itself died vs JS hung)

2. **`src/components/DebugOverlay.tsx`** (new) — fixed bottom-right floating button (only renders on native Android, or when `?debug=1`). Tapping it opens a full-screen panel showing:
   - the event log (newest first, color-coded by level)
   - "Copy all" button → copies to clipboard via `@capacitor/clipboard` (already a transitive dep) or `navigator.clipboard`
   - "Share" button → uses `@capacitor/share` to send the log as text to WhatsApp/email
   - "Clear" button
   - device info header: platform, WebView UA, screen size, build timestamp
   - Activate via **3-finger tap** OR **long-press top-left corner** so it can't be hit accidentally.

3. **Mount the overlay** in `src/spa-entry.tsx` at the root, after `RouterProvider`.

4. **Instrument suspected hot paths** with explicit log lines:
   - `PartyPickerDialog` open/close + party-list query
   - `TransactionDialog` mount, save start, save end
   - Settings page mount + each `db.settings.put`
   - `db.ts` — wrap `db.open()` and log success/failure (Dexie failures on Android WebView are a known freeze cause if the IndexedDB origin gets confused by `androidScheme: "https"`)

5. **Bonus safety net**: lower the watchdog threshold from 2500 ms → 1500 ms and have it auto-show the overlay when it fires, so a freeze surfaces itself.

## Phase 2 — You test on device

You install the new APK, reproduce the freeze (Add party, Settings, You Got/Gave), then:
- pull up the overlay (3-finger tap)
- hit "Share" → send me the log

That log will tell us the *actual* failing call. From there the fix is targeted, not speculative.

## Phase 3 — Conditional Radix audit

**Only if** the log shows the freeze happens inside a Radix-derived component (focus trap, portal, scroll lock), I'll do the full sweep:
- replace `command.tsx` Dialog dep
- replace `sidebar.tsx` Sheet/Tooltip deps
- audit any indirect Radix imports

If the log shows Dexie / navigation / asset loading / native plugin as the culprit, we fix that instead and leave Radix alone.

## Why this order

You've already burned several rebuilds on guesses. One more rebuild that gives us **ground truth from the device** is worth more than three more "this might fix it" rebuilds. The overlay is small (~150 LoC), pure frontend, no native code changes, no `cap sync` weirdness — low risk to add.

## Files to be created / modified

- create `src/lib/deviceLog.ts`
- create `src/components/DebugOverlay.tsx`
- edit `src/lib/androidStability.ts` (forward events to deviceLog, lower watchdog)
- edit `src/spa-entry.tsx` (mount overlay)
- edit `src/lib/db.ts` (log open + errors)
- edit `src/components/PartyPickerDialog.tsx`, `src/components/TransactionDialog.tsx`, `src/routes/settings.tsx`, `src/routes/parties.index.tsx` (add a few log breadcrumbs)

No Radix changes in this phase. No native Android code changes. Just a rebuild + `npx cap sync android`.