import Dexie, { type Table } from "dexie";

export type TxType = "gave" | "got";

export interface Party {
  id?: number;
  name: string;
  phone?: string;
  photo?: string; // dataURL
  notes?: string;
  createdAt: number;
}

export interface Transaction {
  id?: number;
  partyId: number;
  amount: number; // always positive
  type: TxType;
  paymentMethod?: string; // Cash, UPI, Card, Bank, Other
  note?: string;
  receipt?: string; // dataURL
  date: number; // timestamp (ms)
  createdAt: number;
  updatedAt?: number;
}

export interface SettingRecord {
  key: string;
  value: any;
}

class BookDB extends Dexie {
  parties!: Table<Party, number>;
  transactions!: Table<Transaction, number>;
  settings!: Table<SettingRecord, string>;

  constructor() {
    super("digikhata_local_v1");
    this.version(1).stores({
      parties: "++id, name, phone, createdAt",
      transactions: "++id, partyId, type, date, createdAt",
      settings: "&key",
    });
  }
}

export const db = new BookDB();

// Eagerly open the DB and report success/failure so we can detect IndexedDB
// problems on Android WebView (a known freeze cause).
if (typeof window !== "undefined") {
  // Lazy import to avoid a circular dep at module init time.
  import("./deviceLog").then(({ devLog, openDebugOverlay }) => {
    devLog("db:opening");
    db.open()
      .then(() => devLog("db:opened"))
      .catch((err) => {
        devLog("db:open-failed", err, "error");
        openDebugOverlay();
      });
  });
}

export async function getSetting<T = any>(key: string, fallback: T): Promise<T> {
  const r = await db.settings.get(key);
  return (r?.value ?? fallback) as T;
}

export async function setSetting(key: string, value: any) {
  await db.settings.put({ key, value });
}

// Convention: positive balance = the party owes you (you'll get).
//   "You Gave"  -> party owes you more   -> +amount
//   "You Got"   -> party owes you less   -> -amount
export async function partyBalance(partyId: number): Promise<number> {
  const txs = await db.transactions.where("partyId").equals(partyId).toArray();
  return txs.reduce((sum, t) => sum + (t.type === "gave" ? t.amount : -t.amount), 0);
}

export async function netTotal(): Promise<number> {
  const txs = await db.transactions.toArray();
  return txs.reduce((sum, t) => sum + (t.type === "gave" ? t.amount : -t.amount), 0);
}
