"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { confirmDelete } from "@/lib/swal";
import { Plus, Check, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { formatCurrency, formatDate } from "@/lib/format";

interface DebtRow {
  _id: string;
  name: string;
  amount: number;
  dueDate: string;
  paid: boolean;
  paidDate: string | null;
  priority: "high" | "medium" | "low";
  notes: string;
}
interface AccountOpt {
  _id: string;
  name: string;
}

interface DebtFormState {
  _id?: string;
  name: string;
  amount: string;
  dueDate: string;
  priority: DebtRow["priority"];
  notes: string;
}

const emptyDebt: DebtFormState = {
  name: "",
  amount: "",
  dueDate: new Date().toISOString().slice(0, 10),
  priority: "medium",
  notes: "",
};

function startOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day + 6) % 7; // Monday=0
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export default function PagosPage(): React.ReactElement {
  const [debts, setDebts] = useState<DebtRow[] | null>(null);
  const [accounts, setAccounts] = useState<AccountOpt[]>([]);
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<DebtFormState | null>(null);
  const [payDebt, setPayDebt] = useState<DebtRow | null>(null);
  const [payAccountId, setPayAccountId] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/debts", { cache: "no-store" });
    if (res.ok) setDebts((await res.json()) as DebtRow[]);
  }, []);

  useEffect(() => {
    void load();
    void (async () => {
      const aRes = await fetch("/api/accounts");
      setAccounts((await aRes.json()) as AccountOpt[]);
    })();
  }, [load]);

  const weeks = useMemo(() => {
    const start = startOfWeek(new Date());
    return Array.from({ length: 4 }).map((_, i) => {
      const wStart = new Date(start);
      wStart.setDate(start.getDate() + i * 7);
      const wEnd = new Date(wStart);
      wEnd.setDate(wStart.getDate() + 6);
      wEnd.setHours(23, 59, 59, 999);
      return { wStart, wEnd, label: `Semana ${i === 0 ? "actual" : i === 1 ? "próxima" : `+${i}`}` };
    });
  }, []);

  const totals = useMemo(() => {
    if (!debts) return null;
    const unpaid = debts.filter((d) => !d.paid);
    const thisWeek = unpaid.filter(
      (d) =>
        new Date(d.dueDate) >= weeks[0]!.wStart &&
        new Date(d.dueDate) <= weeks[0]!.wEnd,
    );
    const nextWeek = unpaid.filter(
      (d) =>
        new Date(d.dueDate) >= weeks[1]!.wStart &&
        new Date(d.dueDate) <= weeks[1]!.wEnd,
    );
    return {
      thisWeek: thisWeek.reduce((s, d) => s + d.amount, 0),
      nextWeek: nextWeek.reduce((s, d) => s + d.amount, 0),
      total4w: unpaid
        .filter(
          (d) =>
            new Date(d.dueDate) >= weeks[0]!.wStart &&
            new Date(d.dueDate) <= weeks[3]!.wEnd,
        )
        .reduce((s, d) => s + d.amount, 0),
    };
  }, [debts, weeks]);

  function openCreate(): void {
    setEditing({ ...emptyDebt });
    setOpenForm(true);
  }
  function openEdit(d: DebtRow): void {
    setEditing({
      _id: d._id,
      name: d.name,
      amount: d.amount.toString(),
      dueDate: d.dueDate.slice(0, 10),
      priority: d.priority,
      notes: d.notes,
    });
    setOpenForm(true);
  }

  async function saveDebt(): Promise<void> {
    if (!editing) return;
    if (!editing.name.trim() || !editing.amount) {
      toast.error("Faltan datos");
      return;
    }
    const payload = {
      name: editing.name.trim(),
      amount: parseFloat(editing.amount),
      dueDate: editing.dueDate,
      priority: editing.priority,
      notes: editing.notes,
    };
    const url = editing._id ? `/api/debts/${editing._id}` : "/api/debts";
    const method = editing._id ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      toast.error("Error guardando");
      return;
    }
    toast.success("Guardado");
    setOpenForm(false);
    setEditing(null);
    void load();
  }

  async function removeDebt(id: string): Promise<void> {
    const ok = await confirmDelete({ title: "¿Borrar pago?", text: "Esta acción no se puede deshacer." });
    if (!ok) return;
    const res = await fetch(`/api/debts/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Borrado");
      void load();
    }
  }

  async function markPaid(): Promise<void> {
    if (!payDebt || !payAccountId) {
      toast.error("Falta cuenta de pago");
      return;
    }
    const res = await fetch(`/api/debts/${payDebt._id}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: payAccountId }),
    });
    if (res.ok) {
      toast.success("Marcado como pagado");
      setPayDebt(null);
      setPayAccountId("");
      void load();
    } else {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      toast.error(data?.error ?? "No se pudo");
    }
  }

  if (!debts) {
    return (
      <>
        <PageHeader title="Pagos" />
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64 mt-4" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Pagos"
        description="Pagos corto plazo no asociados a tarjeta"
        action={
          <Button onClick={openCreate} className="w-full sm:w-auto">
            <Plus className="mr-2 size-4" />
            Nuevo pago
          </Button>
        }
      />

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3 mb-4">
        <KPI label="Esta semana" value={formatCurrency(totals?.thisWeek ?? 0)} />
        <KPI label="Próxima semana" value={formatCurrency(totals?.nextWeek ?? 0)} />
        <KPI label="Total próximas 4 sem" value={formatCurrency(totals?.total4w ?? 0)} tone="warning" />
      </div>

      <div className="space-y-4">
        {weeks.map((w) => {
          const items = debts
            .filter(
              (d) =>
                !d.paid &&
                new Date(d.dueDate) >= w.wStart &&
                new Date(d.dueDate) <= w.wEnd,
            )
            .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
          return (
            <section key={w.wStart.toISOString()}>
              <div className="sticky top-14 lg:top-14 z-30 bg-background py-2 -mx-4 px-4 sm:-mx-6 sm:px-6 border-b">
                <h2 className="font-semibold text-sm">
                  {w.label}{" "}
                  <span className="text-muted-foreground font-normal">
                    {formatDate(w.wStart)} → {formatDate(w.wEnd)}
                  </span>
                </h2>
              </div>
              <div className="mt-3 space-y-2">
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin pagos.</p>
                ) : (
                  items.map((d) => (
                    <Card key={d._id}>
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-medium truncate">{d.name}</h3>
                              <Badge
                                variant={
                                  d.priority === "high"
                                    ? "destructive"
                                    : d.priority === "low"
                                      ? "secondary"
                                      : "warning"
                                }
                              >
                                {d.priority}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Vence {formatDate(d.dueDate)}
                            </p>
                            {d.notes ? (
                              <p className="text-xs mt-1">{d.notes}</p>
                            ) : null}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-semibold tabular-nums">
                              {formatCurrency(d.amount)}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Button
                            size="sm"
                            onClick={() => setPayDebt(d)}
                            className="flex-1"
                          >
                            <Check className="mr-1 size-3.5" />
                            Marcar pagada
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openEdit(d)} aria-label="Editar">
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => removeDebt(d._id)} aria-label="Borrar">
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* Form pago */}
      <Sheet
        open={openForm}
        onOpenChange={(v) => {
          setOpenForm(v);
          if (!v) setEditing(null);
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing?._id ? "Editar pago" : "Nuevo pago"}</SheetTitle>
          </SheetHeader>
          {editing ? (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="Mecánico"
                />
              </div>
              <div className="space-y-2">
                <Label>Importe (ARS)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={editing.amount}
                  onChange={(e) => setEditing({ ...editing, amount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Vencimiento</Label>
                <Input
                  type="date"
                  value={editing.dueDate}
                  onChange={(e) => setEditing({ ...editing, dueDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Prioridad</Label>
                <Select
                  value={editing.priority}
                  onValueChange={(v) =>
                    setEditing({ ...editing, priority: v as DebtRow["priority"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="low">Baja</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea
                  value={editing.notes}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                />
              </div>
            </div>
          ) : null}
          <SheetFooter className="gap-2 pb-[env(safe-area-inset-bottom)]">
            <Button variant="outline" onClick={() => setOpenForm(false)} className="flex-1 sm:flex-none">
              Cancelar
            </Button>
            <Button onClick={saveDebt} className="flex-1 sm:flex-none">
              Guardar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Pay dialog */}
      <Sheet
        open={!!payDebt}
        onOpenChange={(v) => {
          if (!v) {
            setPayDebt(null);
            setPayAccountId("");
          }
        }}
      >
        <SheetContent side="bottom" className="sm:max-w-md sm:mx-auto sm:rounded-t-lg">
          <SheetHeader>
            <SheetTitle>Marcar como pagada</SheetTitle>
          </SheetHeader>
          {payDebt ? (
            <div className="space-y-4 py-4">
              <p className="text-sm">
                <strong>{payDebt.name}</strong> · {formatCurrency(payDebt.amount)}
              </p>
              <div className="space-y-2">
                <Label>Cuenta desde la que pagás</Label>
                <Select value={payAccountId} onValueChange={setPayAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Elegí una cuenta" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a._id} value={a._id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Se va a crear una transacción de gasto por este monto.
              </p>
            </div>
          ) : null}
          <SheetFooter className="gap-2 pb-[env(safe-area-inset-bottom)]">
            <Button variant="outline" onClick={() => setPayDebt(null)} className="flex-1 sm:flex-none">
              Cancelar
            </Button>
            <Button onClick={markPaid} className="flex-1 sm:flex-none">
              Confirmar pago
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

function KPI({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warning";
}): React.ReactElement {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-xl sm:text-2xl font-semibold tabular-nums ${tone === "warning" ? "text-amber-600" : ""}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
