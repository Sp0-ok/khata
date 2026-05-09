import { getSetting } from "./db";

let _currency = "₹";
export async function loadCurrency() {
  _currency = await getSetting<string>("currency", "₹");
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
  return `${prefix}${_currency}${s}`;
}
