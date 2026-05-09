import { getSetting, setSetting } from "./db";

export type Theme = "light" | "dark";

export async function applyStoredTheme() {
  const t = await getSetting<Theme>("theme", "light");
  document.documentElement.classList.toggle("dark", t === "dark");
  return t;
}

export async function setTheme(t: Theme) {
  document.documentElement.classList.toggle("dark", t === "dark");
  await setSetting("theme", t);
}
