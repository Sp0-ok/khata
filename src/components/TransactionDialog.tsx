import { memo, useEffect, useState } from "react";
import { NativeModal } from "@/components/ui/native-modal";
import { Input } from "@/components/ui/input";
import { LocalInput, LocalTextarea } from "@/components/ui/local-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { db, type Transaction, type TxType } from "@/lib/db";
import { fileToDataURL } from "@/lib/fileData";
import { groupAmount, unformatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";
import { nativeLog, withNativeTimeout } from "@/lib/androidStability";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  partyId: number;
  initialType: TxType;
  existing?: Transaction;
  onSaved?: () => void;
}



export const TransactionDialog = memo(function TransactionDialog({ open, onOpenChange, partyId, initialType, existing, onSaved }: Props) {
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
        await withNativeTimeout("transaction:update", db.transactions.update(existing.id, {
          amount: amt,
          type,
          note,
          receipt,
          date: new Date(date).getTime(),
          updatedAt: Date.now(),
        }));
      } else {
        await withNativeTimeout("transaction:add", db.transactions.add({
          partyId,
          amount: amt,
          type,
          note,
          receipt,
          date: new Date(date).getTime(),
          createdAt: Date.now(),
        }));
      }
      onSaved?.();
      onOpenChange(false);
      nativeLog("transaction:saved", { partyId, type });
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
    <NativeModal
      open={open}
      onOpenChange={onOpenChange}
      title={existing ? "Edit Transaction" : type === "got" ? "You Got" : "You Gave"}
      className="max-w-sm"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !amount}>Save</Button>
        </>
      }
    >
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
            <LocalInput
              type="text"
              inputMode="decimal"
              value={amount}
              onValueChange={setAmount}
              formatValue={groupAmount}
              placeholder="0.00"
            />
          </div>
          <div>
            <Label>Date & Time</Label>
            <LocalInput type="datetime-local" value={date} onValueChange={setDate} />
          </div>
          <div>
            <Label>Note</Label>
            <LocalTextarea value={note} onValueChange={setNote} rows={2} />
          </div>
          <div>
            <Label>Receipt Image</Label>
            <Input type="file" accept="image/*" onChange={handleFile} />
            {receipt && (
              <div className="relative mt-2 inline-block">
                <img src={receipt} alt="receipt" className="max-h-32 rounded border border-border" />
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="absolute -top-2 -right-2 h-6 px-2 text-xs rounded-full shadow"
                  onClick={() => setReceipt(undefined)}
                >
                  Remove
                </Button>
              </div>
            )}
          </div>
        </div>
    </NativeModal>
  );
});
