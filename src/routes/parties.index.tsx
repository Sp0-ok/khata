import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { AppShell } from "@/components/AppShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Search, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fileToDataURL } from "@/lib/exporters";
import { fmtMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/parties/")({
  component: PartiesPage,
  head: () => ({
    meta: [
      { title: "Parties — KhataBook" },
      { name: "description", content: "Manage your parties and balances." },
    ],
  }),
});

function PartiesPage() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const parties = useLiveQuery(() => db.parties.orderBy("name").toArray(), []);
  const txs = useLiveQuery(() => db.transactions.toArray(), []);

  const balances = new Map<number, number>();
  (txs ?? []).forEach((t) => {
    const cur = balances.get(t.partyId) ?? 0;
    // Display sign from party's perspective: positive = you owe them, negative = they owe you
    balances.set(t.partyId, cur + (t.type === "got" ? t.amount : -t.amount));
  });

  const filtered = (parties ?? []).filter(
    (p) => p.name.toLowerCase().includes(q.toLowerCase()) || (p.phone ?? "").includes(q)
  );

  return (
    <AppShell>
      <header className="flex items-center justify-between px-4 pt-5 pb-2">
        <div className="flex items-center gap-2">
          <Link to="/" className="rounded-full p-1.5 hover:bg-accent md:hidden">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-bold">Parties</h1>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> New
        </Button>
      </header>

      <div className="px-4 mt-2 mb-3 relative">
        <Search className="absolute left-7 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search parties…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="px-4 space-y-2">
        {filtered.map((p) => {
          const bal = balances.get(p.id!) ?? 0;
          return (
            <Link
              key={p.id}
              to="/parties/$id"
              params={{ id: String(p.id) }}
              className="flex items-center gap-3 rounded-xl bg-card p-3 border border-border hover:bg-accent/50 transition-colors"
            >
              <Avatar className="h-11 w-11">
                {p.photo && <AvatarImage src={p.photo} />}
                <AvatarFallback className="bg-primary/15 text-primary font-medium">
                  {p.name.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{p.name}</p>
                {p.phone && <p className="text-xs text-muted-foreground">{p.phone}</p>}
              </div>
              <div className="text-right">
                <p className={cn("font-semibold tabular-nums text-sm", bal < 0 ? "text-danger" : bal > 0 ? "text-success" : "text-muted-foreground")}>
                  {fmtMoney(bal, true)}
                </p>
                <p className="text-[10px] text-muted-foreground">{bal < 0 ? "you'll get" : bal > 0 ? "you'll give" : "settled"}</p>
              </div>
            </Link>
          );
        })}
        {filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No parties yet. Tap "New" to add one.
          </div>
        )}
      </div>

      <PartyDialog open={open} onOpenChange={setOpen} />
    </AppShell>
  );
}

export function PartyDialog({
  open,
  onOpenChange,
  existing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existing?: { id?: number; name: string; phone?: string; photo?: string; notes?: string };
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [phone, setPhone] = useState(existing?.phone ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [photo, setPhoto] = useState<string | undefined>(existing?.photo);

  async function save() {
    const n = name.trim();
    if (!n) return;
    if (existing?.id) {
      await db.parties.update(existing.id, { name: n, phone, notes, photo });
    } else {
      await db.parties.add({ name: n, phone, notes, photo, createdAt: Date.now() });
    }
    onOpenChange(false);
    setName(""); setPhone(""); setNotes(""); setPhoto(undefined);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{existing ? "Edit Party" : "New Party"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
          <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div><Label>Notes</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <div>
            <Label>Photo</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) setPhoto(await fileToDataURL(f));
              }}
            />
            {photo && <img src={photo} alt="" className="mt-2 h-20 w-20 rounded-full object-cover" />}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={!name.trim()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
