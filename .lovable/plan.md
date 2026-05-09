## Onboarding splash + background warm-up

### The theory
Yes, this is plausible. On a cold APK launch the WebView has to:
1. Parse + execute the JS bundle
2. Open IndexedDB (Dexie `digikhata_local_v1`)
3. Hydrate the TanStack Router
4. Mount the home route, which immediately runs `db.transactions.toArray()` / `partyBalance()` queries

If any of those stall (Dexie on first launch can take 1–3s on Android, and the router's first navigation can race with it), the UI looks frozen on the very first interaction — exactly matching what you're seeing on Add / Settings / You Gave / You Got.

A welcome/onboarding screen that owns the first ~1–2 seconds gives the WebView time to finish all of that before the user can tap anything that triggers a Dexie query or a dialog.

### What I'll build

**1. `OnboardingGate` component (wraps the whole app in `spa-entry.tsx`)**
- Shows a branded full-screen splash immediately on mount (no Dexie, no router, no Radix — pure JSX).
- Runs a "warm-up" sequence in the background:
  - `await db.open()` (with a hard 5s timeout → if it fails, show retry, not freeze)
  - Prime queries: `db.parties.count()`, `db.transactions.count()` so IndexedDB pages are hot
  - `applyStoredTheme()` + `loadCurrency()` (currently fire-and-forget in `__root.tsx`)
  - One `requestIdleCallback` / `rAF` tick to let the WebView settle
- Only after warm-up resolves does it mount `<RouterProvider />`. Until then, router + all routes + all dialogs don't exist → can't freeze.

**2. First-run onboarding (only shown once)**
- Stored flag: `settings` table key `onboarding_done = true`
- 3 quick swipeable cards: "Track who owes you", "You Gave / You Got", "Works fully offline"
- "Get started" button → sets flag, transitions to app
- On subsequent launches: same `OnboardingGate` runs the warm-up but skips the cards (just shows splash for as long as warm-up takes, min 400ms to avoid flash)

**3. Instrumentation (keeps the DBG overlay useful)**
- `devLog` breadcrumbs at every warm-up step: `warmup:db-open`, `warmup:db-open-ok`, `warmup:prime-queries`, `warmup:done`, `warmup:timeout`
- If warm-up times out, the splash shows a "Continue anyway" button instead of freezing — and the log will tell us exactly which step hung

**4. Defensive: don't query Dexie during render**
- `routes/index.tsx`, `parties.index.tsx`, `parties.$id.tsx` likely call `partyBalance` / `netTotal` in `useEffect`. I'll audit and ensure none of them block first paint — move to `useQuery` with `enabled` guards if needed. (Small, only if the audit shows synchronous-ish patterns.)

### Files touched
- `src/components/OnboardingGate.tsx` (new) — splash + onboarding cards + warm-up logic
- `src/spa-entry.tsx` — wrap `<RouterProvider />` in `<OnboardingGate>`
- `src/lib/warmup.ts` (new) — the actual warm-up sequence, isolated and testable
- `src/routes/__root.tsx` — remove the `useEffect` that calls `applyStoredTheme` / `loadCurrency` (now done in warm-up before render)
- (Conditional) tiny tweaks to home/parties routes if the audit finds blocking queries

### What this does NOT change
- No Radix removal (audit already showed routes don't use Radix directly)
- No native Android changes
- DBG overlay, watchdog, deviceLog all stay exactly as-is
- All your data + existing settings preserved

### Expected outcome
- First launch: clean branded onboarding, ~1.5s of warm-up hidden behind it, then app is fully responsive.
- Subsequent launches: ~400ms splash, app opens already-warm.
- If something genuinely is broken in Dexie or a route, the splash's timeout + DBG log will tell us **which** thing instead of presenting as a generic freeze.
