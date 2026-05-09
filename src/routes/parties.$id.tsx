import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Transaction } from "@/lib/db";
import { AppShell } from "@/components/AppShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Edit2,
  FileDown,
  FileUp,
  FileText,
  Phone,
  Trash2,
  MoreVertical,
  Search,
} from "lucide-react";
import { memo, type ReactNode, useMemo, useRef, useState } from "react";
import { TransactionDialog } from "@/components/TransactionDialog";
import { PartyDialog } from "./parties.index";
import { NativeConfirm, NativeModal } from "@/components/ui/native-modal";
import { fmtMoney } from "@/lib/format";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { exportPartyCSV, exportPartyPDF, importPartyCSV } from "@/lib/exporters";
import { toast } from "sonner";
import {
  afterNativeFrame,
  clearRadixLocks,
  nativeLog,
  withNativeTimeout,
} from "@/lib/androidStability";

export const Route = createFileRoute("/parties/$id")({
  component: PartyDetail,
});

const SORT_OPTIONS = [
  ["created-desc", "Recently added"],
  ["created-asc", "Oldest added"],
  ["date-desc", "Date (newest)"],
  ["date-asc", "Date (oldest)"],
  ["amount-desc", "Amount (high → low)"],
  ["amount-asc", "Amount (low → high)"],
  ["got-first", "You Got first"],
  ["gave-first", "You Gave first"],
] as const;

function PartyDetail() {
  const { id } = Route.useParams();
  const partyId = parseInt(id, 10);
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [txOpen, setTxOpen] = useState(false);
  const [txType, setTxType] = useState<"got" | "gave">("got");
  const [editingTx, setEditingTx] = useState<Transaction | undefined>();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editParty, setEditParty] = useState(false);
  const [confirmEditParty, setConfirmEditParty] = useState(false);
  const [confirmDeleteParty, setConfirmDeleteParty] = useState(false);
  const [confirmEditTx, setConfirmEditTx] = useState<Transaction | null>(null);
  const [confirmDeleteTx, setConfirmDeleteTx] = useState<Transaction | null>(null);
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<string>("created-desc");
  const [viewing, setViewing] = useState<Transaction | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfFrom, setPdfFrom] = useState("");
  const [pdfTo, setPdfTo] = useState("");

  const party = useLiveQuery(() => db.parties.get(partyId), [partyId]);
  const txs = useLiveQuery(
    () => db.transactions.where("partyId").equals(partyId).toArray(),
    [partyId],
  );

  const list = useMemo(() => {
    const filtered = (txs ?? []).filter((t) => {
      if (!q) return true;
      const lc = q.toLowerCase();
      return (t.note ?? "").toLowerCase().includes(lc) || String(t.amount).includes(q);
    });
    const sorted = [...filtered];
    switch (sortBy) {
      case "created-asc":
        sorted.sort((a, b) => a.createdAt - b.createdAt);
        break;
      case "date-desc":
        sorted.sort((a, b) => b.date - a.date);
        break;
      case "date-asc":
        sorted.sort((a, b) => a.date - b.date);
        break;
      case "amount-desc":
        sorted.sort((a, b) => b.amount - a.amount);
        break;
      case "amount-asc":
        sorted.sort((a, b) => a.amount - b.amount);
        break;
      case "got-first":
        sorted.sort((a, b) =>
          a.type === b.type ? b.createdAt - a.createdAt : a.type === "got" ? -1 : 1,
        );
        break;
      case "gave-first":
        sorted.sort((a, b) =>
          a.type === b.type ? b.createdAt - a.createdAt : a.type === "gave" ? -1 : 1,
        );
        break;
      default:
        sorted.sort((a, b) => b.createdAt - a.createdAt);
    }
    return sorted.slice(0, 150);
  }, [txs, q, sortBy]);

  const totals = useMemo(() => {
    let totalGot = 0;
    let totalGave = 0;
    for (const t of txs ?? []) t.type === "got" ? (totalGot += t.amount) : (totalGave += t.amount);
    return { totalGot, totalGave, net: totalGot - totalGave };
  }, [txs]);

  if (!party) {
    return (
      <AppShell>
        <div className="p-8 text-center text-muted-foreground">Party not found.</div>
      </AppShell>
    );
  }

  function newTx(type: "got" | "gave") {
    nativeLog("party:quick-tx", type);
    setEditingTx(undefined);
    setTxType(type);
    afterNativeFrame(() => setTxOpen(true));
  }

  async function deleteTx(id: number) {
    await withNativeTimeout("transaction:delete", db.transactions.delete(id));
    toast.success("Transaction deleted");
  }

  async function deleteParty() {
    await withNativeTimeout(
      "party:delete",
      db.transaction("rw", db.parties, db.transactions, async () => {
        await db.transactions.where("partyId").equals(partyId).delete();
        await db.parties.delete(partyId);
      }),
    );
    toast.success("Party deleted");
    clearRadixLocks();
    navigate({ to: "/parties" });
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const n = await importPartyCSV(partyId, f);
      toast.success(`Imported ${n} transactions`);
    } catch (err: any) {
      toast.error(err.message ?? "Import failed");
    } finally {
      e.target.value = "";
    }
  }

  return (
    <AppShell>
      <header className="flex items-center justify-between px-4 pt-5 pb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Link
            to="/parties"
            preload={false}
            onClick={clearRadixLocks}
            className="rounded-full p-1.5 hover:bg-accent"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <Avatar className="h-10 w-10">
            {party.photo && <AvatarImage src={party.photo} />}
            <AvatarFallback className="bg-primary/15 text-primary">
              {party.name.slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="font-semibold truncate">{party.name}</p>
            {party.phone && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {party.phone}
              </p>
            )}
          </div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => {
            nativeLog("party:menu");
            setMenuOpen(true);
          }}
        >
          <MoreVertical className="h-5 w-5" />
        </Button>
        <input ref={fileRef} type="file" accept=".csv" hidden onChange={handleImport} />
      </header>

      <section className="px-4">
        <div
          className={cn(
            "rounded-2xl text-primary-foreground p-4 shadow-sm",
            totals.net < 0
              ? "bg-gradient-to-br from-rose-400 via-rose-500 to-red-500/90"
              : totals.net > 0
                ? "bg-gradient-to-br from-teal-400 via-teal-500 to-cyan-700"
                : "bg-gradient-to-br from-primary to-primary/80",
          )}
        >
          <p className="text-xs uppercase opacity-90">Net Balance</p>
          <p className="text-2xl font-bold mt-1 tabular-nums text-white">
            {fmtMoney(totals.net, true)}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg bg-white/15 p-2">
              <p className="text-[10px] uppercase opacity-90">You Got</p>
              <p className="font-semibold">{fmtMoney(totals.totalGot)}</p>
            </div>
            <div className="rounded-lg bg-white/15 p-2">
              <p className="text-[10px] uppercase opacity-90">You Gave</p>
              <p className="font-semibold">{fmtMoney(totals.totalGave)}</p>
            </div>
          </div>
        </div>
      </section>

      {party.notes && (
        <p className="mx-4 mt-3 text-xs text-muted-foreground bg-accent/40 rounded-lg p-2">
          {party.notes}
        </p>
      )}

      <div className="px-4 mt-4 mb-2 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search transactions…"
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          aria-label="Sort transactions"
          className="h-9 max-w-28 rounded-md border border-input bg-background px-2 text-xs text-foreground"
        >
          {SORT_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <section className="px-4 space-y-2 pb-32">
        {list.map((t) => (
          <TransactionRow key={t.id} transaction={t} onOpen={setViewing} />
        ))}
        {list.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No transactions {q ? "match your search" : "yet"}.
          </div>
        )}
      </section>

      <div className="fixed bottom-16 inset-x-0 z-30 px-4 pb-2 pointer-events-none">
        <div className="mx-auto max-w-md grid grid-cols-2 gap-2.5 pointer-events-auto">
          <Button
            onClick={() => newTx("gave")}
            className="bg-danger hover:bg-danger/90 text-danger-foreground h-11 text-sm font-medium rounded-xl"
          >
            <ArrowUpRight className="mr-1 h-4 w-4" /> You Gave
          </Button>
          <Button
            onClick={() => newTx("got")}
            className="bg-success hover:bg-success/90 text-success-foreground h-11 text-sm font-medium rounded-xl"
          >
            <ArrowDownLeft className="mr-1 h-4 w-4" /> You Got
          </Button>
        </div>
      </div>

      <TransactionDialog
        open={txOpen}
        onOpenChange={setTxOpen}
        partyId={partyId}
        initialType={txType}
        existing={editingTx}
      />
      <PartyDialog open={editParty} onOpenChange={setEditParty} existing={party} />

      <NativeModal
        open={menuOpen}
        title="Party Actions"
        onOpenChange={setMenuOpen}
        className="max-w-sm"
      >
        <div className="grid gap-1">
          <ActionButton
            icon={<Edit2 className="h-4 w-4" />}
            label="Edit Party"
            onClick={() => {
              setMenuOpen(false);
              setConfirmEditParty(true);
            }}
          />
          <ActionButton
            icon={<FileDown className="h-4 w-4" />}
            label="Export CSV"
            onClick={() => {
              setMenuOpen(false);
              exportPartyCSV(party, txs ?? []);
            }}
          />
          <ActionButton
            icon={<FileText className="h-4 w-4" />}
            label="Export PDF"
            onClick={() => {
              setMenuOpen(false);
              setPdfOpen(true);
            }}
          />
          <ActionButton
            icon={<FileUp className="h-4 w-4" />}
            label="Import CSV"
            onClick={() => {
              setMenuOpen(false);
              fileRef.current?.click();
            }}
          />
          <ActionButton
            danger
            icon={<Trash2 className="h-4 w-4" />}
            label="Delete Party"
            onClick={() => {
              setMenuOpen(false);
              setConfirmDeleteParty(true);
            }}
          />
        </div>
      </NativeModal>

      <NativeModal
        open={!!viewing}
        title="Transaction Details"
        onOpenChange={(v) => !v && setViewing(null)}
        className="max-w-sm"
        footer={
          <>
            <Button
              variant="outline"
              className="text-danger border-danger/40 hover:bg-danger/10"
              onClick={() => {
                setConfirmDeleteTx(viewing);
                setViewing(null);
              }}
            >
              <Trash2 className="h-4 w-4 mr-1.5" /> Delete
            </Button>
            <Button
              onClick={() => {
                setConfirmEditTx(viewing);
                setViewing(null);
              }}
            >
              <Edit2 className="h-4 w-4 mr-1.5" /> Edit
            </Button>
          </>
        }
      >
        {viewing && <TransactionDetails transaction={viewing} />}
      </NativeModal>

      <NativeConfirm
        open={confirmEditParty}
        title="Edit this party?"
        message={`You're about to modify ${party.name}'s details.`}
        onCancel={() => setConfirmEditParty(false)}
        onConfirm={() => {
          setConfirmEditParty(false);
          setEditParty(true);
        }}
      />
      <NativeConfirm
        open={confirmDeleteParty}
        title="Delete this party?"
        message={`All ${(txs ?? []).length} transactions will be permanently deleted.`}
        confirmLabel="Delete"
        destructive
        onCancel={() => setConfirmDeleteParty(false)}
        onConfirm={() => {
          setConfirmDeleteParty(false);
          deleteParty();
        }}
      />
      <NativeConfirm
        open={!!confirmEditTx}
        title="Edit this entry?"
        message={`You're about to modify a transaction of ${confirmEditTx ? fmtMoney(confirmEditTx.amount) : ""}.`}
        onCancel={() => setConfirmEditTx(null)}
        onConfirm={() => {
          if (confirmEditTx) {
            setEditingTx(confirmEditTx);
            setTxOpen(true);
          }
          setConfirmEditTx(null);
        }}
      />
      <NativeConfirm
        open={!!confirmDeleteTx}
        title="Delete this entry?"
        message="This will permanently remove this transaction."
        confirmLabel="Delete"
        destructive
        onCancel={() => setConfirmDeleteTx(null)}
        onConfirm={() => {
          if (confirmDeleteTx?.id) deleteTx(confirmDeleteTx.id);
          setConfirmDeleteTx(null);
        }}
      />

      <NativeModal
        open={pdfOpen}
        title="Export PDF Statement"
        onOpenChange={setPdfOpen}
        className="max-w-sm"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setPdfFrom("");
                setPdfTo("");
              }}
            >
              Clear
            </Button>
            <Button
              onClick={() => {
                const from = pdfFrom ? new Date(pdfFrom + "T00:00:00").getTime() : undefined;
                const to = pdfTo ? new Date(pdfTo + "T23:59:59").getTime() : undefined;
                exportPartyPDF(party, txs ?? [], { from, to });
                setPdfOpen(false);
              }}
            >
              Generate
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground text-xs">
            Choose an optional date range. Leave empty for all transactions.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">From</label>
              <Input
                type="date"
                value={pdfFrom}
                onChange={(event) => setPdfFrom(event.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">To</label>
              <Input type="date" value={pdfTo} onChange={(event) => setPdfTo(event.target.value)} />
            </div>
          </div>
        </div>
      </NativeModal>
    </AppShell>
  );
}

const TransactionRow = memo(function TransactionRow({
  transaction,
  onOpen,
}: {
  transaction: Transaction;
  onOpen: (tx: Transaction) => void;
}) {
  const isGot = transaction.type === "got";
  return (
    <button
      type="button"
      onClick={() => onOpen(transaction)}
      className="w-full touch-manipulation text-left rounded-xl bg-card border border-border p-3 flex items-start gap-3 hover:bg-accent/40"
    >
      <div
        className={cn(
          "h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
          isGot ? "bg-success/15 text-success" : "bg-danger/15 text-danger",
        )}
      >
        {isGot ? "+" : "-"}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "font-semibold text-sm tabular-nums",
            isGot ? "text-success" : "text-danger",
          )}
        >
          {isGot ? "+" : "-"} {fmtMoney(transaction.amount).replace(/^[+\-]\s?/, "")}
        </p>
        <p className="text-xs text-muted-foreground">
          {format(transaction.createdAt, "MMM d yyyy, h:mm a")}
        </p>
        {transaction.note && <p className="text-xs mt-1 line-clamp-1">{transaction.note}</p>}
      </div>
      {transaction.receipt && (
        <img
          src={transaction.receipt}
          alt=""
          className="h-10 w-10 rounded border border-border object-cover shrink-0"
          loading="lazy"
        />
      )}
    </button>
  );
});

function TransactionDetails({ transaction }: { transaction: Transaction }) {
  return (
    <div className="space-y-3 text-sm">
      <div
        className={cn(
          "rounded-xl p-4 text-center",
          transaction.type === "got" ? "bg-success/10 text-success" : "bg-danger/10 text-danger",
        )}
      >
        <p className="text-xs uppercase opacity-80">
          {transaction.type === "got" ? "You Got" : "You Gave"}
        </p>
        <p className="text-2xl font-bold tabular-nums mt-1">{fmtMoney(transaction.amount)}</p>
      </div>
      <div className="grid grid-cols-[110px_1fr] gap-y-1.5">
        <span className="text-muted-foreground">Entry date</span>
        <span>{format(transaction.date, "MMM d yyyy, h:mm a")}</span>
        <span className="text-muted-foreground">Created</span>
        <span>{format(transaction.createdAt, "MMM d yyyy, h:mm a")}</span>
        {transaction.updatedAt && (
          <>
            <span className="text-muted-foreground">Last edited</span>
            <span>{format(transaction.updatedAt, "MMM d yyyy, h:mm a")}</span>
          </>
        )}
        {transaction.note && (
          <>
            <span className="text-muted-foreground">Note</span>
            <span className="break-words">{transaction.note}</span>
          </>
        )}
      </div>
      {transaction.receipt && (
        <img
          src={transaction.receipt}
          alt="receipt"
          className="w-full rounded border border-border"
          loading="lazy"
        />
      )}
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-11 w-full touch-manipulation items-center gap-3 rounded-md px-3 text-left text-sm active:bg-accent",
        danger && "text-danger",
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
