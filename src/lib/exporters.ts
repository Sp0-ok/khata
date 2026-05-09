import Papa from "papaparse";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { db, type Party, type Transaction } from "./db";
import { format } from "date-fns";
import { currency, groupAmount } from "./format";
import { saveToKhataFolder } from "./saveFile";
export { fileToDataURL } from "./fileData";

// jsPDF's built-in helvetica font has no glyphs for ₨, ₹, ﷼, د.إ etc. so we
// substitute a safe ASCII code for the PDF only.
function pdfCurrency(): string {
  const c = currency();
  switch (c) {
    case "₨": return "Rs";
    case "₹": return "Rs";
    case "₱": return "PHP";
    case "﷼": return "SAR";
    case "د.إ": return "AED";
    case "BD": return "BHD";
    case "€": return "EUR";
    case "£": return "GBP";
    case "¥": return "JPY";
    case "$": return "$";
    default: return c;
  }
}

function fmtPdfMoney(n: number): string {
  const cur = pdfCurrency();
  return `${cur} ${groupAmount(Math.abs(n).toFixed(2))}`;
}

export async function exportPartyCSV(party: Party, txs: Transaction[]) {
  const rows = txs.map((t) => ({
    date: format(t.date, "yyyy-MM-dd HH:mm"),
    type: t.type === "got" ? "You Got" : "You Gave",
    amount: t.amount,
    note: t.note ?? "",
  }));
  const csv = Papa.unparse(rows);
  await saveToKhataFolder(`${party.name}-transactions.csv`, {
    kind: "text",
    data: csv,
    mime: "text/csv;charset=utf-8",
  });
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
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  const from = range?.from;
  const to = range?.to;
  const inRange = txs
    .filter((t) => (from == null || t.date >= from) && (to == null || t.date <= to))
    .sort((a, b) => a.date - b.date);

  // Display convention (from party's perspective):
  //   "You Got"  -> +amount   (party owes you less / you owe more)
  //   "You Gave" -> -amount   (you owe less / party owes you more)
  // So a POSITIVE balance means YOU OWE the party (party will get).
  //    a NEGATIVE balance means PARTY OWES YOU (party will give).
  const opening = from != null
    ? txs.filter((t) => t.date < from).reduce((s, t) => s + (t.type === "got" ? t.amount : -t.amount), 0)
    : 0;
  const totalDebit  = inRange.filter((t) => t.type === "gave").reduce((s, t) => s + t.amount, 0); // You Gave
  const totalCredit = inRange.filter((t) => t.type === "got").reduce((s, t) => s + t.amount, 0);  // You Got
  const periodNet      = totalCredit - totalDebit;
  const runningBalance = opening + periodNet;

  const fmtDate = (ms: number) => format(ms, "dd MMM yy, HH:mm");
  const fmtDateShort = (ms: number) => format(ms, "dd MMM yy");

  function balanceLabel(n: number): string {
    if (n === 0) return "(settled)";
    return n > 0 ? `(${party.name} will get)` : `(${party.name} will give)`;
  }
  function balanceColor(n: number): [number, number, number] {
    if (n === 0) return [60, 60, 60];
    return n > 0 ? [22, 163, 74] : [220, 38, 38];
  }

  // Photo top-right
  if (party.photo) {
    try {
      const ext = party.photo.startsWith("data:image/png") ? "PNG" : "JPEG";
      doc.addImage(party.photo, ext, pageWidth - margin - 22, 10, 22, 22, undefined, "FAST");
    } catch {}
  }

  // Centered title block
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(`${party.name} Statement`, pageWidth / 2, 20, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110);
  if (party.phone) doc.text(`Phone Number: ${party.phone}`, pageWidth / 2, 27, { align: "center" });

  const rangeFromLabel = from != null
    ? fmtDateShort(from)
    : (txs.length ? fmtDateShort(Math.min(...txs.map((t) => t.date))) : fmtDateShort(Date.now()));
  const rangeToLabel = to != null ? fmtDateShort(to) : fmtDateShort(Date.now());
  doc.text(`(${rangeFromLabel} - ${rangeToLabel})`, pageWidth / 2, 33, { align: "center" });
  doc.setTextColor(0);

  // Summary cards row
  const cards: Array<{ label: string; value: string; sub?: string; color: [number, number, number] }> = [
    {
      label: "Opening Balance",
      value: fmtPdfMoney(opening),
      sub: balanceLabel(opening),
      color: balanceColor(opening),
    },
    { label: "Total Debit (You Gave)",  value: fmtPdfMoney(totalDebit),  color: [220, 38, 38] },
    { label: "Total Credit (You Got)",  value: fmtPdfMoney(totalCredit), color: [22, 163, 74] },
    {
      label: "Net (Period)",
      value: fmtPdfMoney(periodNet),
      sub: balanceLabel(periodNet),
      color: balanceColor(periodNet),
    },
    {
      label: "Running Balance",
      value: fmtPdfMoney(runningBalance),
      sub: balanceLabel(runningBalance),
      color: balanceColor(runningBalance),
    },
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
    doc.setFontSize(7.5);
    doc.setTextColor(110);
    doc.text(c.label, x + 3, cardsY + 6);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(c.color[0], c.color[1], c.color[2]);
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
  doc.text(`No. of Entries: ${inRange.length}`, margin, entriesY);
  doc.setFont("helvetica", "normal");

  // Build rows with running balance
  let bal = opening;
  const balances: number[] = [];
  const body = inRange.map((t, i) => {
    const debit  = t.type === "gave" ? t.amount : 0;
    const credit = t.type === "got"  ? t.amount : 0;
    bal += credit - debit;
    balances.push(bal);
    return [
      String(i + 1),
      fmtDate(t.date),
      t.note ?? "",
      debit  ? fmtPdfMoney(debit)  : "",
      credit ? fmtPdfMoney(credit) : "",
      fmtPdfMoney(bal),
    ];
  });

  const debitFill: [number, number, number]  = [253, 235, 235];
  const creditFill: [number, number, number] = [232, 247, 240];
  const debitText: [number, number, number]  = [185, 28, 28];
  const creditText: [number, number, number] = [21, 128, 61];

  autoTable(doc, {
    startY: entriesY + 4,
    head: [["#", "Date & Time", "Details", "Debit (You Gave)", "Credit (You Got)", "Balance"]],
    body,
    foot: [[
      "",
      "",
      "Grand Total",
      fmtPdfMoney(totalDebit),
      fmtPdfMoney(totalCredit),
      fmtPdfMoney(runningBalance),
    ]],
    headStyles: { fillColor: [240, 240, 245], textColor: 30, fontStyle: "bold", halign: "left" },
    footStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: "bold" },
    bodyStyles: { fontSize: 9, cellPadding: 2, valign: "middle", textColor: 0 },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      1: { cellWidth: 30 },
      2: { cellWidth: "auto" },
      3: { halign: "right", cellWidth: 28 },
      4: { halign: "right", cellWidth: 28 },
      5: { halign: "right", cellWidth: 30 },
    },
    didParseCell: (data) => {
      if (data.section === "body") {
        // Debit cell: only fill if there's a value, text stays default black
        if (data.column.index === 3) {
          const v = body[data.row.index]?.[3];
          if (v) {
            data.cell.styles.fillColor = debitFill;
            data.cell.styles.fontStyle = "bold";
          }
        } else if (data.column.index === 4) {
          const v = body[data.row.index]?.[4];
          if (v) {
            data.cell.styles.fillColor = creditFill;
            data.cell.styles.fontStyle = "bold";
          }
        } else if (data.column.index === 5) {
          const runBal = balances[data.row.index] ?? 0;
          data.cell.styles.textColor =
            runBal === 0 ? [60, 60, 60] : runBal > 0 ? creditText : debitText;
          data.cell.styles.fontStyle = "bold";
        }
      }
      // foot rows keep default white bg + black text (no overrides)
    },
    styles: { lineColor: [220, 220, 220], lineWidth: 0.2, overflow: "linebreak" },
    margin: { left: margin, right: margin },
  });

  const finalY = (doc as any).lastAutoTable.finalY ?? entriesY + 20;
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Report Generated : ${format(Date.now(), "hh:mm a | dd MMM yy")}`, margin, finalY + 8);

  const buf = doc.output("arraybuffer");
  await saveToKhataFolder(`${party.name}-statement.pdf`, {
    kind: "binary",
    data: buf,
    mime: "application/pdf",
  });
}

export async function exportFullBackup() {
  const data = {
    version: 1,
    exportedAt: Date.now(),
    parties: await db.parties.toArray(),
    transactions: await db.transactions.toArray(),
    settings: await db.settings.toArray(),
  };
  await saveToKhataFolder(`khatabook-backup-${format(Date.now(), "yyyyMMdd-HHmm")}.json`, {
    kind: "text",
    data: JSON.stringify(data, null, 2),
    mime: "application/json",
  });
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

