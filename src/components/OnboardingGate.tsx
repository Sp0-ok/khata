import { ReactNode, useEffect, useState } from "react";
import { runWarmup, isOnboardingDone, markOnboardingDone } from "@/lib/warmup";
import { devLog } from "@/lib/deviceLog";

type Phase = "warming" | "onboarding" | "ready" | "error";

const SLIDES = [
  { title: "Welcome to KhataBook", body: "Track who owes you and who you owe — all in one place." },
  { title: "You Gave / You Got", body: "Log every transaction in seconds. Balances update automatically." },
  { title: "Fully Offline", body: "Your data stays on your device. No accounts, no internet needed." },
];

export function OnboardingGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("warming");
  const [error, setError] = useState<string>("");
  const [slide, setSlide] = useState(0);
  const [showContinue, setShowContinue] = useState(false);
  const [startedAt] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    const safety = setTimeout(() => setShowContinue(true), 6000);

    (async () => {
      try {
        await runWarmup();
        if (cancelled) return;
        const done = await isOnboardingDone();
        // Min splash time so it doesn't flash
        const elapsed = Date.now() - startedAt;
        const wait = Math.max(0, 400 - elapsed);
        await new Promise((r) => setTimeout(r, wait));
        if (cancelled) return;
        setPhase(done ? "ready" : "onboarding");
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || String(e));
        setPhase("error");
      } finally {
        clearTimeout(safety);
      }
    })();

    return () => { cancelled = true; clearTimeout(safety); };
  }, [startedAt]);

  if (phase === "ready") return <>{children}</>;

  if (phase === "warming") {
    return (
      <Splash>
        <Spinner />
        <div style={{ marginTop: 16, fontSize: 14, opacity: 0.8 }}>Loading your book…</div>
        {showContinue && (
          <button style={btn} onClick={() => setPhase("onboarding")}>Continue anyway</button>
        )}
      </Splash>
    );
  }

  if (phase === "error") {
    return (
      <Splash>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Couldn't finish loading</div>
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8, maxWidth: 280, textAlign: "center" }}>
          {error}
        </div>
        <button style={btn} onClick={() => location.reload()}>Retry</button>
        <button style={{ ...btn, marginTop: 8, opacity: 0.7 }} onClick={() => setPhase("ready")}>
          Continue anyway
        </button>
      </Splash>
    );
  }

  // onboarding
  const last = slide === SLIDES.length - 1;
  return (
    <Splash>
      <div style={{ fontSize: 44, marginBottom: 16 }}>📒</div>
      <div style={{ fontSize: 22, fontWeight: 700, textAlign: "center" }}>{SLIDES[slide].title}</div>
      <div style={{ marginTop: 12, fontSize: 14, opacity: 0.85, maxWidth: 300, textAlign: "center", lineHeight: 1.5 }}>
        {SLIDES[slide].body}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
        {SLIDES.map((_, i) => (
          <div key={i} style={{
            width: i === slide ? 20 : 8, height: 8, borderRadius: 4,
            background: i === slide ? "#0d9488" : "rgba(255,255,255,0.3)",
            transition: "all 0.2s",
          }}/>
        ))}
      </div>
      <button
        style={{ ...btn, marginTop: 32, minWidth: 180, background: "#0d9488", border: "none" }}
        onClick={async () => {
          if (last) {
            devLog("onboarding:done");
            await markOnboardingDone();
            setPhase("ready");
          } else {
            setSlide(slide + 1);
          }
        }}
      >
        {last ? "Get started" : "Next"}
      </button>
      {!last && (
        <button
          style={{ ...btn, marginTop: 8, background: "transparent", border: "none", opacity: 0.6 }}
          onClick={async () => { await markOnboardingDone(); setPhase("ready"); }}
        >
          Skip
        </button>
      )}
    </Splash>
  );
}

function Splash({ children }: { children: ReactNode }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "linear-gradient(160deg, #0f172a 0%, #134e4a 100%)",
      color: "#f1f5f9",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: 24,
      font: "14px system-ui, -apple-system, sans-serif",
    }}>
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <>
      <style>{`@keyframes khspin{to{transform:rotate(360deg)}}`}</style>
      <div style={{
        width: 36, height: 36, borderRadius: "50%",
        border: "3px solid rgba(255,255,255,0.15)",
        borderTopColor: "#5eead4",
        animation: "khspin 0.8s linear infinite",
      }}/>
    </>
  );
}

const btn: React.CSSProperties = {
  marginTop: 16,
  padding: "10px 20px",
  borderRadius: 8,
  background: "rgba(255,255,255,0.08)",
  color: "#f1f5f9",
  border: "1px solid rgba(255,255,255,0.2)",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};
