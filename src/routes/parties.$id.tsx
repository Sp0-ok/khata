import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Transaction } from "@/lib/db";
import { AppShell } from "@/components/AppShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, Edit2, FileDown, FileUp, FileText, Phone, Trash2, MoreVertical, Search, ArrowUpDown } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { TransactionDialog } from "@/components/TransactionDialog";
import { PartyDialog } from "./parties.index";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtMoney } from "@/lib/format";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { exportPartyCSV, exportPartyPDF, importPartyCSV } from "@/lib/exporters";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export const Route = createFileRoute("/parties/$id")({
  component: PartyDetail,
});

function PartyDetail() {
  const { id } = Route.useParams();
  const partyId = parseInt(id, 10);
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [txOpen, setTxOpen] = useState(false);
  const [txType, setTxType] = useState<"got" | "gave">("got");
  const [editingTx, setEditingTx] = useState<Transaction | undefined>();
  const [editParty, setEditParty] = useState(false);
  const [confirmEditParty, setConfirmEditParty] = useState(false);
  const [confirmEditTx, setConfirmEditTx] = useState<Transaction | null>(null);
  const [confirmDeleteTx, setConfirmDeleteTx] = useState<Transaction | null>(null);
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<string>("created-desc");
  const [viewing, setViewing] = useState<Transaction | null>(null);

  const party = useLiveQuery(() => db.parties.get(partyId), [partyId]);
  const txs = useLiveQuery(
    () => db.transactions.where("partyId").equals(partyId).toArray(),
    [partyId]
  );

  const list = useMemo(() => {
    const filtered = (txs ?? []).filter((t) => {
      if (!q) return true;
      const lc = q.toLowerCase();
      return (t.note ?? "").toLowerCase().includes(lc) || String(t.amount).includes(q);
    });
    const sorted = [...filtered];
    switch (sortBy) {
      case "created-asc": sorted.sort((a, b) => a.createdAt - b.createdAt); break;
      case "date-desc": sorted.sort((a, b) => b.date - a.date); break;
      case "date-asc": sorted.sort((a, b) => a.date - b.date); break;
      case "amount-desc": sorted.sort((a, b) => b.amount - a.amount); break;
      case "amount-asc": sorted.sort((a, b) => a.amount - b.amount); break;
      case "got-first": sorted.sort((a, b) => (a.type === b.type ? b.createdAt - a.createdAt : a.type === "got" ? -1 : 1)); break;
      case "gave-first": sorted.sort((a, b) => (a.type === b.type ? b.createdAt - a.createdAt : a.type === "gave" ? -1 : 1)); break;
      default: sorted.sort((a, b) => b.createdAt - a.createdAt);
    }
    return sorted;
  }, [txs, q, sortBy]);

  if (!party) {
    return (
      <AppShell>
        <div className="p-8 text-center text-muted-foreground">Party not found.</div>
      </AppShell>
    );
  }

  const totalGot = (txs ?? []).filter((t) => t.type === "got").reduce((s, t) => s + t.amount, 0);
  const totalGave = (txs ?? []).filter((t) => t.type === "gave").reduce((s, t) => s + t.amount, 0);
  const net = totalGot - totalGave;

  function newTx(type: "got" | "gave") {
    setEditingTx(undefined);
    setTxType(type);
    setTxOpen(true);
  }

  async function deleteTx(id: number) {
    await db.transactions.delete(id);
    toast.success("Transaction deleted");
  }

  async function deleteParty() {
    await db.transaction("rw", db.parties, db.transactions, async () => {
      await db.transactions.where("partyId").equals(partyId).delete();
      await db.parties.delete(partyId);
    });
    toast.success("Party deleted");
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
          <Link to="/parties" className="rounded-full p-1.5 hover:bg-accent">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <Avatar className="h-10 w-10">
            {party.photo && <AvatarImage src={party.photo} />}
            <AvatarFallback className="bg-primary/15 text-primary">{party.name.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="font-semibold truncate">{party.name}</p>
            {party.phone && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{party.phone}</p>}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost"><MoreVertical className="h-5 w-5" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setConfirmEditParty(true)}><Edit2 className="h-4 w-4 mr-2" />Edit Party</DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportPartyCSV(party, txs ?? [])}><FileDown className="h-4 w-4 mr-2" />Export CSV</DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportPartyPDF(party, txs ?? [])}><FileText className="h-4 w-4 mr-2" />Export PDF</DropdownMenuItem>
            <DropdownMenuItem onClick={() => fileRef.current?.click()}><FileUp className="h-4 w-4 mr-2" />Import CSV</DropdownMenuItem>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-danger"><Trash2 className="h-4 w-4 mr-2" />Delete Party</DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this party?</AlertDialogTitle>
                  <AlertDialogDescription>All {(txs ?? []).length} transactions will be permanently deleted.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={deleteParty} className="bg-danger hover:bg-danger/90">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </DropdownMenuContent>
        </DropdownMenu>
        <input ref={fileRef} type="file" accept=".csv" hidden onChange={handleImport} />
      </header>

      <section className="px-4">
        <div
          className={cn(
            "rounded-2xl text-primary-foreground p-4 shadow-lg transition-colors",
            net < 0
              ? "bg-gradient-to-br from-rose-400 via-rose-500 to-red-500/90"
              : net > 0
              ? "bg-gradient-to-br from-teal-400 via-teal-500 to-cyan-700"
              : "bg-gradient-to-br from-primary to-primary/80"
          )}
        >
          <p className="text-xs uppercase opacity-90">Net Balance</p>
          <p className="text-2xl font-bold mt-1 tabular-nums text-white">
            {fmtMoney(net, true)}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg bg-white/15 p-2 backdrop-blur">
              <p className="text-[10px] uppercase opacity-90">You Got</p>
              <p className="font-semibold">{fmtMoney(totalGot)}</p>
            </div>
            <div className="rounded-lg bg-white/15 p-2 backdrop-blur">
              <p className="text-[10px] uppercase opacity-90">You Gave</p>
              <p className="font-semibold">{fmtMoney(totalGave)}</p>
            </div>
          </div>
        </div>
      </section>

      {party.notes && (
        <p className="mx-4 mt-3 text-xs text-muted-foreground bg-accent/40 rounded-lg p-2">{party.notes}</p>
      )}

      <div className="px-4 mt-4 mb-2 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search transactions…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-auto gap-1 px-2.5">
            <ArrowUpDown className="h-4 w-4" />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="created-desc">Recently added</SelectItem>
            <SelectItem value="created-asc">Oldest added</SelectItem>
            <SelectItem value="date-desc">Date (newest)</SelectItem>
            <SelectItem value="date-asc">Date (oldest)</SelectItem>
            <SelectItem value="amount-desc">Amount (high → low)</SelectItem>
            <SelectItem value="amount-asc">Amount (low → high)</SelectItem>
            <SelectItem value="got-first">You Got first</SelectItem>
            <SelectItem value="gave-first">You Gave first</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <section className="px-4 space-y-2 pb-32">
        {list.map((t) => {
          const isGot = t.type === "got";
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setViewing(t)}
              className="w-full text-left rounded-xl bg-card border border-border p-3 flex items-start gap-3 hover:bg-accent/40 transition-colors"
            >
              <div className={cn("h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                isGot ? "bg-success/15 text-success" : "bg-danger/15 text-danger")}>
                {isGot ? "+" : "-"}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn("font-semibold text-sm tabular-nums", isGot ? "text-success" : "text-danger")}>
                  {isGot ? "+" : "-"} {fmtMoney(t.amount).replace(/^[+\-]\s?/, "")}
                </p>
                <p className="text-xs text-muted-foreground">{format(t.createdAt, "MMM d yyyy, h:mm a")}</p>
                {t.note && <p className="text-xs mt-1 line-clamp-1">{t.note}</p>}
              </div>
              {t.receipt && <img src={t.receipt} alt="" className="h-10 w-10 rounded border border-border object-cover shrink-0" />}
            </button>
          );
        })}
        {list.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No transactions {q ? "match your search" : "yet"}.
          </div>
        )}
      </section>

      {/* Sticky action bar */}
      <div className="fixed bottom-16 inset-x-0 z-30 px-4 pb-2 pointer-events-none">
        <div className="mx-auto max-w-md grid grid-cols-2 gap-2.5 pointer-events-auto">
          <Button onClick={() => newTx("gave")} className="bg-danger hover:bg-danger/90 text-danger-foreground h-11 text-sm font-medium shadow-md rounded-xl">You Gave</Button>
          <Button onClick={() => newTx("got")} className="bg-success hover:bg-success/90 text-success-foreground h-11 text-sm font-medium shadow-md rounded-xl">You Got</Button>
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

      <Dialog open={!!viewing} onOpenChange={(v) => !v && setViewing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-3 text-sm">
              <div className={cn("rounded-xl p-4 text-center",
                viewing.type === "got" ? "bg-success/10 text-success" : "bg-danger/10 text-danger")}>
                <p className="text-xs uppercase opacity-80">{viewing.type === "got" ? "You Got" : "You Gave"}</p>
                <p className="text-2xl font-bold tabular-nums mt-1">{fmtMoney(viewing.amount)}</p>
              </div>
              <div className="grid grid-cols-[110px_1fr] gap-y-1.5">
                <span className="text-muted-foreground">Entry date</span>
                <span>{format(viewing.date, "MMM d yyyy, h:mm a")}</span>
                <span className="text-muted-foreground">Created</span>
                <span>{format(viewing.createdAt, "MMM d yyyy, h:mm a")}</span>
                {viewing.updatedAt && (
                  <>
                    <span className="text-muted-foreground">Last edited</span>
                    <span>{format(viewing.updatedAt, "MMM d yyyy, h:mm a")}</span>
                  </>
                )}
                {viewing.note && (
                  <>
                    <span className="text-muted-foreground">Note</span>
                    <span className="break-words">{viewing.note}</span>
                  </>
                )}
              </div>
              {viewing.receipt && (
                <img src={viewing.receipt} alt="receipt" className="w-full rounded border border-border" />
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              className="text-danger border-danger/40 hover:bg-danger/10"
              onClick={() => { setConfirmDeleteTx(viewing); setViewing(null); }}
            >
              <Trash2 className="h-4 w-4 mr-1.5" /> Delete
            </Button>
            <Button onClick={() => { setConfirmEditTx(viewing); setViewing(null); }}>
              <Edit2 className="h-4 w-4 mr-1.5" /> Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmEditParty} onOpenChange={setConfirmEditParty}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit this party?</AlertDialogTitle>
            <AlertDialogDescription>You're about to modify {party.name}'s details.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmEditParty(false); setEditParty(true); }}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmEditTx} onOpenChange={(v) => !v && setConfirmEditTx(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit this entry?</AlertDialogTitle>
            <AlertDialogDescription>You're about to modify a transaction of {confirmEditTx ? fmtMoney(confirmEditTx.amount) : ""}.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmEditTx) { setEditingTx(confirmEditTx); setTxOpen(true); } setConfirmEditTx(null); }}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDeleteTx} onOpenChange={(v) => !v && setConfirmDeleteTx(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this transaction.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (confirmDeleteTx?.id) await deleteTx(confirmDeleteTx.id); setConfirmDeleteTx(null); }} className="bg-danger hover:bg-danger/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
