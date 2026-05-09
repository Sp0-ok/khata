import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { db, type Transaction, type TxType } from "@/lib/db";
import { fileToDataURL } from "@/lib/exporters";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  partyId: number;
  initialType: TxType;
  existing?: Transaction;
  onSaved?: () => void;
}

const PAYMENT_METHODS = ["Cash", "UPI", "Bank Transfer", "Card", "Cheque", "Other"];

export function TransactionDialog({ open, onOpenChange, partyId, initialType, existing, onSaved }: Props) {
  const [type, setType] = useState<TxType>(initialType);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");
  const [note, setNote] = useState("");
  const [receipt, setReceipt] = useState<string | undefined>();
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 16));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (existing) {
        setType(existing.type);
        setAmount(String(existing.amount));
        setMethod(existing.paymentMethod || "Cash");
        setNote(existing.note || "");
        setReceipt(existing.receipt);
        setDate(new Date(existing.date).toISOString().slice(0, 16));
      } else {
        setType(initialType);
        setAmount("");
        setMethod("Cash");
        setNote("");
        setReceipt(undefined);
        setDate(new Date().toISOString().slice(0, 16));
      }
    }
  }, [open, existing, initialType]);

  async function handleSave() {
    const amt = parseFloat(amount);
    if (!isFinite(amt) || amt <= 0) return;
    setSaving(true);
    try {
      const payload = {
        partyId,
        amount: amt,
        type,
        paymentMethod: method,
        note,
        receipt,
        date: new Date(date).getTime(),
        createdAt: existing?.createdAt ?? Date.now(),
      };
      if (existing?.id) await db.transactions.update(existing.id, payload);
      else await db.transactions.add(payload);
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
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
              placeholder="0.00"
            />
          </div>
          <div>
            <Label>Payment Method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
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
