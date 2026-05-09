import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { fmtMoney } from "@/lib/format";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowDownLeft, ArrowUpRight, Settings as SettingsIcon } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { PartyPickerDialog } from "@/components/PartyPickerDialog";
import { format } from "date-fns";
import type { Transaction, TxType } from "@/lib/db";
import { cn } from "@/lib/utils";
import { afterNativeFrame, clearRadixLocks, nativeLog } from "@/lib/androidStability";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "Home — KhataBook" },
      { name: "description", content: "Your net balance and quick transaction entry." },
    ],
  }),
});

function HomePage() {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerType, setPickerType] = useState<TxType>("got");

  const allTxs = useLiveQuery(() => db.transactions.toArray(), []);
  const parties = useLiveQuery(() => db.parties.toArray(), []);
  const businessName = useLiveQuery(async () => (await db.settings.get("businessName"))?.value as string | undefined, []);

  const partyMap = useMemo(() => new Map((parties ?? []).map((p) => [p.id!, p])), [parties]);
  const { recentTxs, net, totalGot, totalGave } = useMemo(() => {
    const all = allTxs ?? [];
    const recentTxs = [...all].sort((a, b) => b.date - a.date).slice(0, 50);
    // Display from counterparty's perspective:
    //   net > 0  → you owe overall (good standing for you, teal)
    //   net < 0  → others owe you overall (their balance is negative, red)
    let net = 0;
    let totalGot = 0;
    let totalGave = 0;
    for (const t of all) {
      if (t.type === "got") { totalGot += t.amount; net += t.amount; }
      else { totalGave += t.amount; net -= t.amount; }
    }
    return { recentTxs, net, totalGot, totalGave };
  }, [allTxs]);

  function open(type: TxType) {
    nativeLog("home:quick-tx", type);
    setPickerType(type);
    afterNativeFrame(() => setPickerOpen(true));
  }

  return (
    <AppShell>
      <header className="flex items-center justify-between px-4 pt-5 pb-2">
        <div>
          <p className="text-xs text-muted-foreground">Welcome back</p>
          <h1 className="text-lg font-semibold">{businessName || "My Business"}</h1>
        </div>
        <Link to="/settings" preload={false} onClick={() => { clearRadixLocks(); nativeLog("nav:settings"); }} className="rounded-full p-2 hover:bg-accent">
          <SettingsIcon className="h-5 w-5" />
        </Link>
      </header>

      <section className="px-4">
        <Card
          className={cn(
            "overflow-hidden border-0 text-primary-foreground p-5 shadow-lg transition-colors",
            net < 0
              ? "bg-gradient-to-br from-rose-400 via-rose-500 to-red-500/90"
              : net > 0
              ? "bg-gradient-to-br from-teal-400 via-teal-500 to-cyan-700"
              : "bg-gradient-to-br from-primary to-primary/80"
          )}
        >
          <p className="text-xs uppercase tracking-wider opacity-90">Net Balance</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-white">
            {fmtMoney(net, true)}
          </p>
          <p className="text-[11px] mt-1 opacity-90">
            {net < 0 ? "You'll receive overall" : net > 0 ? "You owe overall" : "All settled"}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-white/15 p-3 backdrop-blur">
              <p className="text-[10px] uppercase opacity-90">You Got</p>
              <p className="mt-0.5 font-semibold">{fmtMoney(totalGot)}</p>
            </div>
            <div className="rounded-lg bg-white/15 p-3 backdrop-blur">
              <p className="text-[10px] uppercase opacity-90">You Gave</p>
              <p className="mt-0.5 font-semibold">{fmtMoney(totalGave)}</p>
            </div>
          </div>
        </Card>
      </section>

      <section className="px-4 mt-4 grid grid-cols-2 gap-2.5">
        <Button
          onClick={() => open("gave")}
              className="bg-danger hover:bg-danger/90 text-danger-foreground h-11 text-sm font-medium rounded-xl"
        >
          <ArrowUpRight className="mr-1 h-4 w-4" /> You Gave
        </Button>
        <Button
          onClick={() => open("got")}
              className="bg-success hover:bg-success/90 text-success-foreground h-11 text-sm font-medium rounded-xl"
        >
          <ArrowDownLeft className="mr-1 h-4 w-4" /> You Got
        </Button>
      </section>

      <section className="px-4 mt-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold">Recent Transactions</h2>
          <Link to="/parties" preload={false} onClick={clearRadixLocks} className="text-xs text-primary">View all</Link>
        </div>
        <div className="space-y-2">
          {recentTxs.map((t) => {
            const p = partyMap.get(t.partyId);
            return <RecentTransactionRow key={t.id} transaction={t} partyName={p?.name} partyPhoto={p?.photo} />;
          })}
          {recentTxs.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No transactions yet. Tap "You Got" or "You Gave" to start.
            </div>
          )}
        </div>
      </section>

      <PartyPickerDialog open={pickerOpen} onOpenChange={setPickerOpen} type={pickerType} />
    </AppShell>
  );
}

const RecentTransactionRow = memo(function RecentTransactionRow({ transaction: t, partyName, partyPhoto }: { transaction: Transaction; partyName?: string; partyPhoto?: string }) {
  const isGot = t.type === "got";
  return (
    <Link
      to="/parties/$id"
      params={{ id: String(t.partyId) }}
      preload={false}
      onClick={clearRadixLocks}
      className="flex touch-manipulation items-center gap-3 rounded-xl bg-card p-3 border border-border hover:bg-accent/50"
    >
      <Avatar className="h-10 w-10">
        {partyPhoto && <AvatarImage src={partyPhoto} />}
        <AvatarFallback className="bg-primary/15 text-primary">
          {(partyName ?? "?").slice(0, 1).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{partyName ?? "Unknown"}</p>
        <p className="text-xs text-muted-foreground">{format(t.date, "MMM d, h:mm a")}{t.note ? ` · ${t.note}` : ""}</p>
      </div>
      <div className={cn("text-sm font-semibold tabular-nums", isGot ? "text-success" : "text-danger")}>
        {isGot ? "+" : "-"} {fmtMoney(t.amount).replace(/^[+\-]\s?/, "")}
      </div>
    </Link>
  );
});
