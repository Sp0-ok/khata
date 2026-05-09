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

export async function exportPartyPDF(
  party: Party,
  txs: Transaction[],
  range?: { from?: number; to?: number }
) {
  const doc = new jsPDF();
  const cur = currency();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  // Filter by range
  const from = range?.from;
  const to = range?.to;
  const inRange = txs
    .filter((t) => (from == null || t.date >= from) && (to == null || t.date <= to))
    .sort((a, b) => a.date - b.date);

  const opening = from != null
    ? txs.filter((t) => t.date < from).reduce((s, t) => s + (t.type === "got" ? t.amount : -t.amount), 0)
    : 0;
  // Convention: positive = party owes you (you gave more). Like image: dr means debit balance.
  // In image: "You Gave" = Debit (-), "You Got" = Credit (+); Balance = Debit - Credit running.
  const totalDebit = inRange.filter((t) => t.type === "gave").reduce((s, t) => s + t.amount, 0);
  const totalCredit = inRange.filter((t) => t.type === "got").reduce((s, t) => s + t.amount, 0);
  // Net (period): debit - credit (positive => party owes you)
  const periodNet = totalDebit - totalCredit;
  // Opening as debit-style (positive => party owes you)
  const openingDebit = -opening;
  const runningBalance = openingDebit + periodNet;

  const fmt = (n: number) => `${cur} ${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const fmtDate = (ms: number) => format(ms, "dd MMM yy");

  // Embed photo top-right
  if (party.photo) {
    try {
      const ext = party.photo.startsWith("data:image/png") ? "PNG" : "JPEG";
      doc.addImage(party.photo, ext, pageWidth - margin - 22, 10, 22, 22, undefined, "FAST");
    } catch {}
  }

  // Centered title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(`${party.name} Statement`, pageWidth / 2, 20, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110);
  if (party.phone) doc.text(`Phone Number: ${party.phone}`, pageWidth / 2, 27, { align: "center" });

  const rangeFromLabel = from != null ? fmtDate(from) : (txs.length ? fmtDate(Math.min(...txs.map((t) => t.date))) : fmtDate(Date.now()));
  const rangeToLabel = to != null ? fmtDate(to) : fmtDate(Date.now());
  doc.text(`(${rangeFromLabel} - ${rangeToLabel})`, pageWidth / 2, 33, { align: "center" });
  doc.setTextColor(0);

  // Summary cards row
  const cards: Array<{ label: string; value: string; sub?: string; color?: [number, number, number] }> = [
    { label: "Opening Balance", value: openingDebit === 0 ? `${cur} 0` : fmt(openingDebit), sub: openingDebit === 0 ? "(settled)" : openingDebit > 0 ? "(will give)" : "(will get)", color: openingDebit > 0 ? [220, 38, 38] : [22, 163, 74] },
    { label: "Total Debit (-)", value: fmt(totalDebit), color: [220, 38, 38] },
    { label: "Total Credit (+)", value: fmt(totalCredit), color: [22, 163, 74] },
    { label: "Net Balance", value: fmt(periodNet), sub: periodNet === 0 ? "(settled)" : periodNet > 0 ? `(${party.name} will give)` : `(${party.name} will get)`, color: periodNet >= 0 ? [220, 38, 38] : [22, 163, 74] },
    { label: "Running Balance", value: fmt(runningBalance), sub: runningBalance === 0 ? "(settled)" : runningBalance > 0 ? `(${party.name} will give)` : `(${party.name} will get)`, color: runningBalance >= 0 ? [220, 38, 38] : [22, 163, 74] },
  ];

  const cardsY = 42;
  const cardsH = 26;
  const innerW = pageWidth - margin * 2;
  const cardW = innerW / cards.length;

  doc.setDrawColor(220);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, cardsY, innerW, cardsH, 2, 2);
  cards.forEach((c, i) => {
    const x = margin + i * cardW;
    if (i > 0) doc.line(x, cardsY + 3, x, cardsY + cardsH - 3);
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text(c.label, x + 3, cardsY + 6);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    if (c.color) doc.setTextColor(c.color[0], c.color[1], c.color[2]); else doc.setTextColor(0);
    doc.text(c.value, x + 3, cardsY + 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(130);
    if (c.sub) doc.text(c.sub, x + 3, cardsY + 18);
  });
  doc.setTextColor(0);

  // Entries header
  const entriesY = cardsY + cardsH + 8;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`No. of Entries: ${inRange.length}${range && (from != null || to != null) ? "" : " (All)"}`, margin, entriesY);
  doc.setFont("helvetica", "normal");

  // Build rows with running balance
  let bal = openingDebit;
  const body = inRange.map((t, i) => {
    const debit = t.type === "gave" ? t.amount : 0;
    const credit = t.type === "got" ? t.amount : 0;
    bal += debit - credit;
    return [
      String(i + 1),
      fmtDate(t.date),
      t.note ?? "",
      debit ? fmt(debit) : "",
      credit ? fmt(credit) : "",
      fmt(bal),
    ];
  });

  autoTable(doc, {
    startY: entriesY + 4,
    head: [["#", "Date", "Details", "Debit (-)", "Credit (+)", "Balance"]],
    body,
    foot: [["", "", "Grand Total", fmt(totalDebit), fmt(totalCredit), fmt(runningBalance)]],
    headStyles: { fillColor: [240, 240, 245], textColor: 30, fontStyle: "bold" },
    footStyles: { fillColor: [245, 245, 248], textColor: 30, fontStyle: "bold" },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      3: { halign: "right", fillColor: [253, 235, 235] },
      4: { halign: "right", fillColor: [232, 247, 240] },
      5: { halign: "right", textColor: [220, 38, 38] },
    },
    styles: { lineColor: [220, 220, 220], lineWidth: 0.2 },
    margin: { left: margin, right: margin },
  });

  const finalY = (doc as any).lastAutoTable.finalY ?? entriesY + 20;
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Report Generated : ${format(Date.now(), "hh:mm a | dd MMM yy")}`, margin, finalY + 8);

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
