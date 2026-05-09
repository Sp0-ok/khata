import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, startOfDay, subDays, subMonths } from "date-fns";
import { fmtMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reports")({
  component: ReportsPage,
  head: () => ({
    meta: [
      { title: "Reports — KhataBook" },
      { name: "description", content: "Visualize money in and out over time." },
    ],
  }),
});

const RANGES = [
  { key: "1m", label: "1M", days: 30 },
  { key: "3m", label: "3M", days: 90 },
  { key: "6m", label: "6M", days: 180 },
  { key: "1y", label: "1Y", days: 365 },
  { key: "all", label: "All", days: 0 },
] as const;

function ReportsPage() {
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("3m");
  const txs = useLiveQuery(() => db.transactions.toArray(), []);

  const { chartData, totalGot, totalGave, net } = useMemo(() => {
    const all = txs ?? [];
    const r = RANGES.find((x) => x.key === range)!;
    const cutoff = r.days === 0 ? 0 : subDays(new Date(), r.days).getTime();
    const filtered = all.filter((t) => t.date >= cutoff);

    // Decide bucket size
    const buckets = r.days <= 30 ? 30 : r.days <= 90 ? 30 : r.days <= 180 ? 24 : r.days <= 365 ? 24 : 24;
    const start = r.days === 0
      ? (filtered.length ? Math.min(...filtered.map((t) => t.date)) : Date.now())
      : cutoff;
    const end = Date.now();
    const span = Math.max(end - start, 1);
    const step = span / buckets;

    const data = Array.from({ length: buckets }, (_, i) => ({
      ts: start + step * (i + 0.5),
      got: 0,
      gave: 0,
      net: 0,
    }));

    filtered.forEach((t) => {
      const idx = Math.min(buckets - 1, Math.max(0, Math.floor((t.date - start) / step)));
      if (t.type === "got") data[idx].got += t.amount;
      else data[idx].gave += t.amount;
    });

    let running = 0;
    const chartData = data.map((d) => {
      running += d.got - d.gave;
      return {
        label: format(d.ts, r.days <= 90 ? "MMM d" : "MMM yy"),
        Got: Math.round(d.got),
        Gave: Math.round(d.gave),
        Net: Math.round(running),
      };
    });

    const totalGot = filtered.filter((t) => t.type === "got").reduce((s, t) => s + t.amount, 0);
    const totalGave = filtered.filter((t) => t.type === "gave").reduce((s, t) => s + t.amount, 0);
    return { chartData, totalGot, totalGave, net: totalGot - totalGave };
  }, [txs, range]);

  return (
    <AppShell>
      <header className="px-4 pt-5 pb-2">
        <h1 className="text-xl font-bold">Reports</h1>
        <p className="text-xs text-muted-foreground">Insights into your cash flow</p>
      </header>

      <div className="px-4 mt-2 flex gap-2 overflow-x-auto no-scrollbar">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap",
              range === r.key ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      <section className="px-4 mt-4 grid grid-cols-3 gap-2">
        <Card className="p-3">
          <p className="text-[10px] uppercase text-muted-foreground">Got</p>
          <p className="font-semibold text-success text-sm tabular-nums mt-1">{fmtMoney(totalGot)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[10px] uppercase text-muted-foreground">Gave</p>
          <p className="font-semibold text-danger text-sm tabular-nums mt-1">{fmtMoney(totalGave)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[10px] uppercase text-muted-foreground">Net</p>
          <p className={cn("font-semibold text-sm tabular-nums mt-1", net < 0 ? "text-danger" : "text-success")}>{fmtMoney(net, true)}</p>
        </Card>
      </section>

      <section className="px-4 mt-4">
        <Card className="p-3">
          <p className="text-xs font-semibold mb-2">Money In vs Out</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="Got" stroke="oklch(0.62 0.16 155)" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="Gave" stroke="oklch(0.6 0.22 25)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      <section className="px-4 mt-4">
        <Card className="p-3">
          <p className="text-xs font-semibold mb-2">Net Balance Trend</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Line type="monotone" dataKey="Net" stroke="var(--primary)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>
    </AppShell>
  );
}
