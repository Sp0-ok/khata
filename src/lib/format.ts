import { getSetting } from "./db";

let _currency = "₨";
export async function loadCurrency() {
  _currency = await getSetting<string>("currency", "₨");
  return _currency;
}
export function setCurrencySync(c: string) {
  _currency = c;
}
export function currency() {
  return _currency;
}

export function fmtMoney(n: number, sign = false) {
  const abs = Math.abs(n);
  const s = abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const prefix = sign ? (n < 0 ? "- " : n > 0 ? "+ " : "") : "";
  const sep = _currency.length > 1 ? " " : "";
  return `${prefix}${_currency}${sep}${s}`;
}

export function fmtCompact(n: number) {
  const abs = Math.abs(n);
  let s: string;
  if (abs >= 1e7) s = (n / 1e7).toFixed(1).replace(/\.0$/, "") + "Cr";
  else if (abs >= 1e5) s = (n / 1e5).toFixed(1).replace(/\.0$/, "") + "L";
  else if (abs >= 1e3) s = (n / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
  else s = String(Math.round(n));
  return s;
}
