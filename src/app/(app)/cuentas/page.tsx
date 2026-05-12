"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { confirmDelete } from "@/lib/swal";
import { Plus, Pencil, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { formatCurrency } from "@/lib/format";

interface AccountRow {
  _id: string;
  name: string;
  type: "card" | "bank" | "cash" | "wallet";
  bank: string | null;
  closingDay: number | null;
  dueDay: number | null;
  active: boolean;
  order: number;
}

const TYPE_LABELS: Record<AccountRow["type"], string> = {
  card: "Tarjetas",
  bank: "Bancos",
  cash: "Efectivo",
  wallet: "Billeteras virtuales",
};

interface Totals {
  [accountId: string]: number;
}

export default function CuentasPage(): React.ReactElement {
  const [accounts, setAccounts] = useState<AccountRow[] | null>(null);
  const [totals, setTotals] = useState<Totals>({});
  const [editing, setEditing] = useState<AccountRow | null>(null);
  const [openForm, setOpenForm] = useState(false);

  const load = useCallback(async () => {
    const [aRes, dRes] = await Promise.all([
      fetch("/api/accounts", { cache: "no-store" }),
      fetch("/api/dashboard", { cache: "no-store" }),
    ]);
    const aJson = (await aRes.json()) as AccountRow[];
    setAccounts(aJson);
    if (dRes.ok) {
      const dJson = (await dRes.json()) as {
        cardsBreakdown: Array<{ accountId: string; total: number }>;
      };
      const t: Totals = {};
      for (const c of dJson.cardsBreakdown) t[c.accountId] = c.total;
      setTotals(t);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate(): void {
    setEditing({
      _id: "",
      name: "",
      type: "card",
      bank: null,
      closingDay: null,
      dueDay: null,
      active: true,
      order: 0,
    });
    setOpenForm(true);
  }

  function openEdit(a: AccountRow): void {
    setEditing({ ...a });
    setOpenForm(true);
  }

  async function archive(a: AccountRow): Promise<void> {
    const ok = await confirmDelete({ title: `¿Archivar "${a.name}"?`, text: "La cuenta quedará inactiva." });
    if (!ok) return;
    const res = await fetch(`/api/accounts/${a._id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Cuenta archivada");
      void load();
    } else {
      toast.error("No se pudo archivar");
    }
  }

  if (!accounts) {
    return (
      <>
        <PageHeader title="Cuentas" />
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </>
    );
  }

  const grouped = (["card", "bank", "wallet", "cash"] as const).map((type) => ({
    type,
    label: TYPE_LABELS[type],
    items: accounts.filter((a) => a.type === type),
  }));

  return (
    <>
      <PageHeader
        title="Cuentas"
        action={
          <Button onClick={openCreate} className="w-full sm:w-auto">
            <Plus className="mr-2 size-4" />
            Nueva cuenta
          </Button>
        }
      />

      <div className="space-y-6">
        {grouped.map((g) =>
          g.items.length === 0 ? null : (
            <section key={g.type}>
              <h2 className="text-sm font-semibold text-muted-foreground mb-2">
                {g.label}
              </h2>
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {g.items.map((a) => (
                  <Card key={a._id} className={!a.active ? "opacity-60" : ""}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-start justify-between gap-2">
                        <span className="truncate">{a.name}</span>
                        {!a.active ? (
                          <Badge variant="secondary">Archivada</Badge>
                        ) : null}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {a.bank ? (
                        <p className="text-xs text-muted-foreground">{a.bank}</p>
                      ) : null}
                      {a.type === "card" && (a.closingDay || a.dueDay) ? (
                        <p className="text-xs text-muted-foreground">
                          {a.closingDay ? `Cierra día ${a.closingDay}` : ""}
                          {a.closingDay && a.dueDay ? " · " : ""}
                          {a.dueDay ? `Vence día ${a.dueDay}` : ""}
                        </p>
                      ) : null}
                      {a.type === "card" ? (
                        <p className="text-sm">
                          <span className="text-muted-foreground">A pagar este mes: </span>
                          <span className="font-medium tabular-nums">
                            {formatCurrency(totals[a._id] ?? 0)}
                          </span>
                        </p>
                      ) : null}
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEdit(a)}
                          className="flex-1"
                        >
                          <Pencil className="mr-2 size-3.5" />
                          Editar
                        </Button>
                        {a.active ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => archive(a)}
                          >
                            <Archive className="size-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ),
        )}
      </div>

      <AccountFormSheet
        open={openForm}
        onOpenChange={(v) => {
          setOpenForm(v);
          if (!v) setEditing(null);
        }}
        account={editing}
        onSaved={() => {
          setOpenForm(false);
          setEditing(null);
          void load();
        }}
      />
    </>
  );
}

function AccountFormSheet({
  open,
  onOpenChange,
  account,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  account: AccountRow | null;
  onSaved: () => void;
}): React.ReactElement {
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountRow["type"]>("card");
  const [bank, setBank] = useState<string>("");
  const [closingDay, setClosingDay] = useState<string>("");
  const [dueDay, setDueDay] = useState<string>("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (account) {
      setName(account.name);
      setType(account.type);
      setBank(account.bank ?? "");
      setClosingDay(account.closingDay?.toString() ?? "");
      setDueDay(account.dueDay?.toString() ?? "");
      setActive(account.active);
    }
  }, [account]);

  async function save(): Promise<void> {
    if (!account) return;
    if (!name.trim()) {
      toast.error("Nombre requerido");
      return;
    }
    setSaving(true);
    const payload = {
      name: name.trim(),
      type,
      bank: bank || null,
      closingDay: type === "card" && closingDay ? parseInt(closingDay, 10) : null,
      dueDay: type === "card" && dueDay ? parseInt(dueDay, 10) : null,
      active,
    };
    const url = account._id ? `/api/accounts/${account._id}` : "/api/accounts";
    const method = account._id ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Error guardando");
      return;
    }
    toast.success("Cuenta guardada");
    onSaved();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {account?._id ? "Editar cuenta" : "Nueva cuenta"}
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Francés Master"
            />
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as AccountRow["type"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="card">Tarjeta</SelectItem>
                <SelectItem value="bank">Banco</SelectItem>
                <SelectItem value="wallet">Billetera virtual</SelectItem>
                <SelectItem value="cash">Efectivo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Banco</Label>
            <Select value={bank || "_none"} onValueChange={(v) => setBank(v === "_none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="(ninguno)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">(ninguno)</SelectItem>
                <SelectItem value="Francés">Francés</SelectItem>
                <SelectItem value="Galicia">Galicia</SelectItem>
                <SelectItem value="Nación">Nación</SelectItem>
                <SelectItem value="MercadoPago">MercadoPago</SelectItem>
                <SelectItem value="Otro">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {type === "card" ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="closingDay">Día de cierre</Label>
                <Input
                  id="closingDay"
                  type="number"
                  min={1}
                  max={31}
                  value={closingDay}
                  onChange={(e) => setClosingDay(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDay">Día de vencimiento</Label>
                <Input
                  id="dueDay"
                  type="number"
                  min={1}
                  max={31}
                  value={dueDay}
                  onChange={(e) => setDueDay(e.target.value)}
                />
              </div>
            </div>
          ) : null}
        </div>
        <SheetFooter className="gap-2 pb-[env(safe-area-inset-bottom)]">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none">
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving} className="flex-1 sm:flex-none">
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
