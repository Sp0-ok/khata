import { memo, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { NativeModal } from "@/components/ui/native-modal";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { TransactionDialog } from "./TransactionDialog";
import type { TxType } from "@/lib/db";
import { afterNativeFrame, clearRadixLocks, nativeLog, withNativeTimeout } from "@/lib/androidStability";

export const PartyPickerDialog = memo(function PartyPickerDialog({
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

  useEffect(() => {
    if (!open) {
      setPickedId(null);
      setQ("");
      setNewName("");
    } else {
      nativeLog("party-picker:open", type);
    }
  }, [open, type]);

  const filtered = useMemo(() => {
    const query = q.toLowerCase();
    return (parties ?? []).filter((p) =>
      p.name.toLowerCase().includes(query) || (p.phone ?? "").includes(q)
    ).slice(0, 80);
  }, [parties, q]);

  async function quickCreate() {
    const name = newName.trim();
    if (!name) return;
    const id = await withNativeTimeout("party:quick-create", db.parties.add({ name, createdAt: Date.now() }));
    setPickedId(id as number);
  }

  function pick(id: number) {
    nativeLog("party-picker:picked", id);
    afterNativeFrame(() => setPickedId(id));
  }

  return (
    <>
      <NativeModal open={open && pickedId === null} onOpenChange={onOpenChange} title="Select Party" className="max-w-sm">
          <input
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-base shadow-sm outline-none focus:ring-1 focus:ring-ring"
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="keyboard-scroll h-72 -mx-2">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => pick(p.id!)}
                className="flex w-full touch-manipulation items-center gap-3 rounded-md px-2 py-2 text-left active:bg-accent"
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
              <input
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-base shadow-sm outline-none focus:ring-1 focus:ring-ring"
                placeholder="New party name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <Button onClick={quickCreate} disabled={!newName.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="ghost"
              className="w-full text-xs"
              onClick={() => {
                clearRadixLocks();
                onOpenChange(false);
                navigate({ to: "/parties" });
              }}
            >
              Manage all parties →
            </Button>
          </div>
      </NativeModal>

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
});
