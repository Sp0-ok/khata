import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { db, type Transaction, type TxType } from "@/lib/db";
import { fileToDataURL } from "@/lib/exporters";
import { groupAmount, unformatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  partyId: number;
  initialType: TxType;
  existing?: Transaction;
  onSaved?: () => void;
}



export function TransactionDialog({ open, onOpenChange, partyId, initialType, existing, onSaved }: Props) {
  const [type, setType] = useState<TxType>(initialType);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [receipt, setReceipt] = useState<string | undefined>();
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 16));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (existing) {
        setType(existing.type);
        setAmount(groupAmount(String(existing.amount)));
        setNote(existing.note || "");
        setReceipt(existing.receipt);
        setDate(new Date(existing.date).toISOString().slice(0, 16));
      } else {
        setType(initialType);
        setAmount("");
        setNote("");
        setReceipt(undefined);
        setDate(new Date().toISOString().slice(0, 16));
      }
    }
  }, [open, existing, initialType]);

  async function handleSave() {
    const amt = parseFloat(unformatAmount(amount));
    if (!isFinite(amt) || amt <= 0) return;
    setSaving(true);
    try {
      if (existing?.id) {
        await db.transactions.update(existing.id, {
          amount: amt,
          type,
          note,
          receipt,
          date: new Date(date).getTime(),
          updatedAt: Date.now(),
        });
      } else {
        await db.transactions.add({
          partyId,
          amount: amt,
          type,
          note,
          receipt,
          date: new Date(date).getTime(),
          createdAt: Date.now(),
        });
      }
      onSaved?.();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setReceipt(await fileToDataURL(f));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Transaction" : type === "got" ? "You Got" : "You Gave"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={type === "gave" ? "default" : "outline"}
              className={cn(type === "gave" && "bg-danger hover:bg-danger/90 text-danger-foreground")}
              onClick={() => setType("gave")}
            >
              You Gave
            </Button>
            <Button
              type="button"
              variant={type === "got" ? "default" : "outline"}
              className={cn(type === "got" && "bg-success hover:bg-success/90 text-success-foreground")}
              onClick={() => setType("got")}
            >
              You Got
            </Button>
          </div>
          <div>
            <Label>Amount</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              autoFocus
              placeholder="0.00"
            />
          </div>
          <div>
            <Label>Date & Time</Label>
            <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Note</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
          <div>
            <Label>Receipt Image</Label>
            <Input type="file" accept="image/*" onChange={handleFile} />
            {receipt && <img src={receipt} alt="receipt" className="mt-2 max-h-32 rounded border border-border" />}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !amount}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
