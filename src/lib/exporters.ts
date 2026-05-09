import Papa from "papaparse";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { db, type Party, type Transaction } from "./db";
import { format } from "date-fns";
import { currency } from "./format";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportPartyCSV(party: Party, txs: Transaction[]) {
  const rows = txs.map((t) => ({
    date: format(t.date, "yyyy-MM-dd HH:mm"),
    type: t.type === "got" ? "You Got" : "You Gave",
    amount: t.amount,
    payment_method: t.paymentMethod ?? "",
    note: t.note ?? "",
  }));
  const csv = Papa.unparse(rows);
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${party.name}-transactions.csv`);
}

export async function importPartyCSV(partyId: number, file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    Papa.parse<any>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (res) => {
        try {
          let count = 0;
          for (const r of res.data) {
            const amt = parseFloat(r.amount);
            if (!isFinite(amt) || amt <= 0) continue;
            const typeRaw = String(r.type ?? "").toLowerCase();
            const type = typeRaw.includes("got") || typeRaw === "got" ? "got" : "gave";
            const dateMs = r.date ? new Date(r.date).getTime() : Date.now();
            await db.transactions.add({
              partyId,
              amount: amt,
              type,
              paymentMethod: r.payment_method || r.paymentMethod || "",
              note: r.note || "",
              date: isNaN(dateMs) ? Date.now() : dateMs,
              createdAt: Date.now(),
            });
            count++;
          }
          resolve(count);
        } catch (e) {
          reject(e);
        }
      },
      error: reject,
    });
  });
}

export async function exportPartyPDF(party: Party, txs: Transaction[]) {
  const doc = new jsPDF();
  const cur = currency();
  doc.setFontSize(18);
  doc.text(`Statement: ${party.name}`, 14, 18);
  doc.setFontSize(10);
  if (party.phone) doc.text(`Phone: ${party.phone}`, 14, 26);
  doc.text(`Generated: ${format(Date.now(), "yyyy-MM-dd HH:mm")}`, 14, 32);

  const totalGot = txs.filter((t) => t.type === "got").reduce((s, t) => s + t.amount, 0);
  const totalGave = txs.filter((t) => t.type === "gave").reduce((s, t) => s + t.amount, 0);
  const net = totalGot - totalGave;

  doc.text(`You Got: ${cur}${totalGot.toFixed(2)}`, 14, 40);
  doc.text(`You Gave: ${cur}${totalGave.toFixed(2)}`, 70, 40);
  doc.text(`Net: ${cur}${net.toFixed(2)}`, 130, 40);

  autoTable(doc, {
    startY: 46,
    head: [["Date", "Type", "Amount", "Method", "Note"]],
    body: txs.map((t) => [
      format(t.date, "yyyy-MM-dd HH:mm"),
      t.type === "got" ? "You Got" : "You Gave",
      `${cur}${t.amount.toFixed(2)}`,
      t.paymentMethod ?? "",
      t.note ?? "",
    ]),
    headStyles: { fillColor: [20, 150, 150] },
    styles: { fontSize: 9 },
  });

  doc.save(`${party.name}-statement.pdf`);
}

export async function exportFullBackup() {
  const data = {
    version: 1,
    exportedAt: Date.now(),
    parties: await db.parties.toArray(),
    transactions: await db.transactions.toArray(),
    settings: await db.settings.toArray(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  downloadBlob(blob, `digikhata-backup-${format(Date.now(), "yyyyMMdd-HHmm")}.json`);
}

export async function importFullBackup(file: File): Promise<void> {
  const text = await file.text();
  const data = JSON.parse(text);
  if (!data.parties || !data.transactions) throw new Error("Invalid backup file");
  await db.transaction("rw", db.parties, db.transactions, db.settings, async () => {
    await db.parties.clear();
    await db.transactions.clear();
    await db.settings.clear();
    if (data.parties.length) await db.parties.bulkAdd(data.parties);
    if (data.transactions.length) await db.transactions.bulkAdd(data.transactions);
    if (data.settings?.length) await db.settings.bulkAdd(data.settings);
  });
}

export async function fileToDataURL(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result as string);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}
