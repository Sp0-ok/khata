import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { TransactionDialog } from "./TransactionDialog";
import type { TxType } from "@/lib/db";

export function PartyPickerDialog({
  open,
  onOpenChange,
  type,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  type: TxType;
}) {
  const [q, setQ] = useState("");
  const [pickedId, setPickedId] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const parties = useLiveQuery(() => db.parties.orderBy("name").toArray(), []);
  const navigate = useNavigate();

  const filtered = (parties ?? []).filter((p) =>
    p.name.toLowerCase().includes(q.toLowerCase()) || (p.phone ?? "").includes(q)
  );

  async function quickCreate() {
    const name = newName.trim();
    if (!name) return;
    const id = await db.parties.add({ name, createdAt: Date.now() });
    setPickedId(id as number);
  }

  return (
    <>
      <Dialog open={open && pickedId === null} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Select Party</DialogTitle>
          </DialogHeader>
          <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          <div className="max-h-72 overflow-y-auto -mx-2">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => setPickedId(p.id!)}
                className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-accent"
              >
                <Avatar className="h-9 w-9">
                  {p.photo && <AvatarImage src={p.photo} />}
                  <AvatarFallback className="bg-primary/15 text-primary text-sm">
                    {p.name.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium text-sm">{p.name}</div>
                  {p.phone && <div className="text-xs text-muted-foreground">{p.phone}</div>}
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-2 py-4 text-sm text-muted-foreground text-center">No parties found.</p>
            )}
          </div>
          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-xs text-muted-foreground">Or quick add a new party</p>
            <div className="flex gap-2">
              <Input placeholder="New party name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <Button onClick={quickCreate} disabled={!newName.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="ghost"
              className="w-full text-xs"
              onClick={() => {
                onOpenChange(false);
                navigate({ to: "/parties" });
              }}
            >
              Manage all parties →
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {pickedId !== null && (
        <TransactionDialog
          open
          onOpenChange={(v) => {
            if (!v) {
              setPickedId(null);
              onOpenChange(false);
            }
          }}
          partyId={pickedId}
          initialType={type}
        />
      )}
    </>
  );
}
