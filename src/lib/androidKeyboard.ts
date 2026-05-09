import { Capacitor } from "@capacitor/core";
import { clearRadixLocks, isNativeAndroid, nativeLog } from "./androidStability";

let installed = false;

function isTextControl(target: EventTarget | null): target is HTMLElement {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === "textarea" || tag === "select") return true;
  if (tag !== "input") return false;
  const type = (target as HTMLInputElement).type;
  return !["button", "checkbox", "color", "file", "hidden", "image", "radio", "range", "reset", "submit"].includes(type);
}

function setKeyboardOpen(open: boolean, height = 0) {
  document.body.classList.toggle("keyboard-open", open);
  document.documentElement.style.setProperty("--keyboard-height", `${Math.max(0, Math.round(height))}px`);
  if (!open) document.body.classList.remove("keyboard-focus");
  clearRadixLocks();
}

function scrollFocusedInputIntoSafeArea() {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return;
  if (!isTextControl(active)) return;
  active.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
}

export function installAndroidKeyboardWorkaround() {
  if (installed || typeof window === "undefined" || typeof document === "undefined") return;
  installed = true;

  document.addEventListener(
    "focusin",
    (event) => {
      if (!isTextControl(event.target)) return;
      document.body.classList.add("keyboard-focus");
      clearRadixLocks();
      nativeLog("input:focus", event.target.tagName.toLowerCase());
      setTimeout(scrollFocusedInputIntoSafeArea, 80);
      setTimeout(scrollFocusedInputIntoSafeArea, 300);
    },
    { capture: true },
  );

  document.addEventListener(
    "focusout",
    () => {
      setTimeout(() => {
        if (!isTextControl(document.activeElement)) document.body.classList.remove("keyboard-focus");
      }, 120);
    },
    { capture: true },
  );

  const visualViewport = window.visualViewport;
  const updateFromViewport = () => {
    if (!visualViewport || !isTextControl(document.activeElement)) return;
    const keyboardHeight = Math.max(0, window.innerHeight - visualViewport.height - visualViewport.offsetTop);
    setKeyboardOpen(keyboardHeight > 80, keyboardHeight);
    if (keyboardHeight > 80) setTimeout(scrollFocusedInputIntoSafeArea, 50);
  };
  visualViewport?.addEventListener("resize", updateFromViewport, { passive: true });
  visualViewport?.addEventListener("scroll", updateFromViewport, { passive: true });

  if (!isNativeAndroid()) return;

  window.addEventListener("keyboardWillShow", (event: Event) => {
    const height = Number((event as CustomEvent<{ keyboardHeight?: number }>).detail?.keyboardHeight ?? 0);
    nativeLog("keyboard:will-show", height);
    setKeyboardOpen(true, height);
    setTimeout(scrollFocusedInputIntoSafeArea, 50);
  });
  window.addEventListener("keyboardDidShow", (event: Event) => {
    const height = Number((event as CustomEvent<{ keyboardHeight?: number }>).detail?.keyboardHeight ?? 0);
    nativeLog("keyboard:did-show", height);
    setKeyboardOpen(true, height);
    setTimeout(scrollFocusedInputIntoSafeArea, 50);
  });
  window.addEventListener("keyboardWillHide", () => setKeyboardOpen(false));
  window.addEventListener("keyboardDidHide", () => setKeyboardOpen(false));

  try {
    Capacitor.addListener?.("Keyboard", "keyboardWillShow", (info) => setKeyboardOpen(true, Number(info.keyboardHeight ?? 0)));
    Capacitor.addListener?.("Keyboard", "keyboardDidHide", () => setKeyboardOpen(false));
  } catch (error) {
    nativeLog("keyboard:listeners-failed", error, "warn");
  }
}