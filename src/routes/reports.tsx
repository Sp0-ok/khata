import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, subDays } from "date-fns";
import { fmtMoney, fmtCompact } from "@/lib/format";
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
  { key: "custom", label: "Custom", days: -1 },
] as const;

function ReportsPage() {
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("3m");
  const [customFrom, setCustomFrom] = useState<string>(() => format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [customTo, setCustomTo] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));
  const txs = useLiveQuery(() => db.transactions.toArray(), []);

  const { chartData, totalGot, totalGave, net } = useMemo(() => {
    const all = txs ?? [];
    const r = RANGES.find((x) => x.key === range)!;

    let start: number;
    let end: number = Date.now();
    if (range === "custom") {
      start = new Date(customFrom).setHours(0, 0, 0, 0);
      end = new Date(customTo).setHours(23, 59, 59, 999);
    } else if (r.days === 0) {
      start = all.length ? Math.min(...all.map((t) => t.date)) : Date.now();
    } else {
      start = subDays(new Date(), r.days).getTime();
    }
    const filtered = all.filter((t) => t.date >= start && t.date <= end);

    const spanDays = Math.max(1, Math.ceil((end - start) / 86400000));
    const buckets = spanDays <= 30 ? 8 : spanDays <= 90 ? 10 : spanDays <= 180 ? 10 : 12;
    const span = Math.max(end - start, 1);
    const step = span / buckets;

    const data = Array.from({ length: buckets }, (_, i) => ({
      ts: start + step * (i + 0.5),
      got: 0,
      gave: 0,
    }));

    filtered.forEach((t) => {
      const idx = Math.min(buckets - 1, Math.max(0, Math.floor((t.date - start) / step)));
      if (t.type === "got") data[idx].got += t.amount;
      else data[idx].gave += t.amount;
    });

    const fmtStr = spanDays <= 30 ? "d MMM" : spanDays <= 365 ? "d MMM" : "MMM yy";
    const chartData = data.map((d) => ({
      label: format(d.ts, fmtStr),
      Got: Math.round(d.got),
      Gave: Math.round(d.gave),
    }));

    const totalGot = filtered.filter((t) => t.type === "got").reduce((s, t) => s + t.amount, 0);
    const totalGave = filtered.filter((t) => t.type === "gave").reduce((s, t) => s + t.amount, 0);
    return { chartData, totalGot, totalGave, net: totalGot - totalGave };
  }, [txs, range, customFrom, customTo]);

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

      <section className="px-4 mt-4 pb-8">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold">Money In vs Out</p>
              <p className="text-[10px] text-muted-foreground">Cash flow over time</p>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-success" /> In
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-danger" /> Out
              </span>
            </div>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.7 0.16 155)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="oklch(0.7 0.16 155)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.65 0.22 25)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="oklch(0.65 0.22 25)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={20}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  tickFormatter={(v) => fmtCompact(v as number)}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    fontSize: 12,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  }}
                  formatter={(v: any, name: any) => [fmtMoney(Number(v) || 0), name === "Got" ? "In" : "Out"]}
                />
                <Area
                  type="monotone"
                  dataKey="Got"
                  stroke="oklch(0.62 0.16 155)"
                  strokeWidth={2.5}
                  fill="url(#gIn)"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Area
                  type="monotone"
                  dataKey="Gave"
                  stroke="oklch(0.6 0.22 25)"
                  strokeWidth={2.5}
                  fill="url(#gOut)"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>
    </AppShell>
  );
}
