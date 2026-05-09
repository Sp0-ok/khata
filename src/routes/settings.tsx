import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Download, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { db, getSetting, setSetting } from "@/lib/db";
import { setTheme } from "@/lib/theme";
import { setCurrencySync } from "@/lib/format";
import { exportFullBackup, fileToDataURL, importFullBackup } from "@/lib/exporters";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "Settings — KhataBook" },
      { name: "description", content: "Manage profile, theme, currency and backups." },
    ],
  }),
});

const CURRENCIES = [
  { sym: "₨", label: "₨ Pakistani Rupee (PKR)" },
  { sym: "BD", label: "BD Bahraini Dinar (BHD)" },
  { sym: "₱", label: "₱ Philippine Peso (PHP)" },
  { sym: "$", label: "$ US Dollar (USD)" },
  { sym: "€", label: "€ Euro (EUR)" },
  { sym: "£", label: "£ British Pound (GBP)" },
  { sym: "¥", label: "¥ Japanese Yen (JPY)" },
  { sym: "د.إ", label: "د.إ UAE Dirham (AED)" },
  { sym: "﷼", label: "﷼ Saudi Riyal (SAR)" },
];

function SettingsPage() {
  const [dark, setDark] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [logo, setLogo] = useState<string | undefined>();
  const [cur, setCur] = useState("₨");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      setDark((await getSetting<string>("theme", "light")) === "dark");
      setBusinessName(await getSetting<string>("businessName", ""));
      setLogo(await getSetting<string | undefined>("logo", undefined));
      setCur(await getSetting<string>("currency", "₨"));
    })();
  }, []);

  async function saveProfile() {
    await setSetting("businessName", businessName);
    await setSetting("logo", logo);
    await setSetting("currency", cur);
    setCurrencySync(cur);
    toast.success("Saved");
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      await importFullBackup(f);
      toast.success("Backup restored");
    } catch (err: any) {
      toast.error(err.message ?? "Restore failed");
    } finally {
      e.target.value = "";
    }
  }

  async function clearAll() {
    if (!confirm("Delete ALL parties and transactions? This cannot be undone.")) return;
    await db.transaction("rw", db.parties, db.transactions, async () => {
      await db.parties.clear();
      await db.transactions.clear();
    });
    toast.success("All data cleared");
  }

  return (
    <AppShell>
      <header className="flex items-center gap-2 px-4 pt-5 pb-3">
        <Link to="/" className="rounded-full p-1.5 hover:bg-accent"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="text-xl font-bold">Settings</h1>
      </header>

      <div className="px-4 space-y-3">
        <Card className="p-4 space-y-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Business Profile</p>
          <div>
            <Label>Business / Profile name</Label>
            <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="My Business" />
          </div>
          <div>
            <Label>Logo</Label>
            <div className="flex items-center gap-3">
              {logo && <img src={logo} className="h-12 w-12 rounded-full object-cover" alt="" />}
              <Input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) setLogo(await fileToDataURL(f));
                }}
              />
            </div>
          </div>
          <div>
            <Label>Currency</Label>
            <Select value={cur} onValueChange={setCur}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => <SelectItem key={c.sym} value={c.sym}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={saveProfile} className="w-full">Save</Button>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Dark mode</p>
              <p className="text-xs text-muted-foreground">Switch app theme</p>
            </div>
            <Switch
              checked={dark}
              onCheckedChange={(v) => { setDark(v); setTheme(v ? "dark" : "light"); }}
            />
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Backup & Restore</p>
          <p className="text-xs text-muted-foreground">All data lives on this device. Export a backup file to keep it safe.</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={exportFullBackup}><Download className="h-4 w-4 mr-2" />Export</Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-2" />Import</Button>
          </div>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={handleImport} />
          <Button variant="outline" className="w-full text-danger border-danger/40 hover:bg-danger/10" onClick={clearAll}>
            Clear all data
          </Button>
        </Card>

        <p className="text-center text-xs text-muted-foreground py-4">KhataBook · Local-first · v1.0</p>
      </div>
    </AppShell>
  );
}
