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

// Currencies that use the Indian numbering system (1,00,000 = 1 Lakh)
const INDIAN_GROUPING = new Set(["₨", "₹"]);

export function groupAmount(raw: string): string {
  // raw: digits and optional single dot
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const [intRaw = "", decRaw] = cleaned.split(".");
  const intPart = intRaw.replace(/^0+(?=\d)/, "");
  if (!intPart && decRaw === undefined) return "";
  let grouped: string;
  if (INDIAN_GROUPING.has(_currency)) {
    if (intPart.length <= 3) grouped = intPart;
    else {
      const last3 = intPart.slice(-3);
      const rest = intPart.slice(0, -3);
      grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
    }
  } else {
    grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  if (decRaw === undefined) return grouped || "0";
  return (grouped || "0") + "." + decRaw.slice(0, 2);
}

export function unformatAmount(s: string): string {
  return s.replace(/,/g, "");
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
