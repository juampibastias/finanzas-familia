"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { confirmDelete } from "@/lib/swal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface AccountOpt {
  _id: string;
  name: string;
  type: string;
}
interface CategoryOpt {
  _id: string;
  name: string;
  kind: "income" | "expense";
}

export interface TransactionFormState {
  _id?: string;
  date: string; // yyyy-mm-dd
  amount: string;
  type: "income" | "expense" | "transfer";
  accountId: string;
  categoryId: string;
  description: string;
  installmentEnabled: boolean;
  installmentCurrent: string;
  installmentTotal: string;
  recurring: boolean;
  notes: string;
}

export const emptyTransaction: TransactionFormState = {
  date: new Date().toISOString().slice(0, 10),
  amount: "",
  type: "expense",
  accountId: "",
  categoryId: "",
  description: "",
  installmentEnabled: false,
  installmentCurrent: "1",
  installmentTotal: "3",
  recurring: false,
  notes: "",
};

export function TransactionFormSheet({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: TransactionFormState | null;
  onSaved: () => void;
}): React.ReactElement {
  const [state, setState] = useState<TransactionFormState>(emptyTransaction);
  const [accounts, setAccounts] = useState<AccountOpt[]>([]);
  const [categories, setCategories] = useState<CategoryOpt[]>([]);
  const [saving, setSaving] = useState(false);

  async function deleteRecurringSeries(): Promise<void> {
    const ok = await confirmDelete({
      title: "¿Eliminar toda la serie?",
      text: "Se borrarán todos los movimientos recurrentes con la misma descripción, cuenta, categoría e importe. Esta acción no se puede deshacer.",
    });
    if (!ok) return;
    setSaving(true);
    const res = await fetch(`/api/transactions/${state._id}?scope=recurring`, {
      method: "DELETE",
    });
    setSaving(false);
    if (res.ok) {
      const data = (await res.json()) as { deleted?: number };
      toast.success(`Serie eliminada (${data.deleted ?? 0} movimientos)`);
      onSaved();
    } else {
      toast.error("No se pudo eliminar la serie");
    }
  }

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const [aRes, cRes] = await Promise.all([
        fetch("/api/accounts"),
        fetch("/api/categories"),
      ]);
      const aJson = (await aRes.json()) as AccountOpt[];
      const cJson = (await cRes.json()) as CategoryOpt[];
      setAccounts(aJson.filter((a) => a));
      setCategories(cJson);
    })();
  }, [open]);

  useEffect(() => {
    if (initial) setState(initial);
  }, [initial]);

  async function submit(): Promise<void> {
    const amount = parseFloat(state.amount);
    if (!amount || amount <= 0) {
      toast.error("Importe inválido");
      return;
    }
    if (!state.accountId) {
      toast.error("Falta cuenta");
      return;
    }
    if (!state.categoryId) {
      toast.error("Falta categoría");
      return;
    }
    setSaving(true);
    const payload = {
      date: state.date,
      amount,
      type: state.type,
      accountId: state.accountId,
      categoryId: state.categoryId,
      description: state.description,
      notes: state.notes,
      installment:
        state.installmentEnabled && !state._id
          ? {
              current: parseInt(state.installmentCurrent, 10) || 1,
              total: parseInt(state.installmentTotal, 10) || 1,
            }
          : null,
      recurring: state.recurring,
      generateInstallments: state.installmentEnabled && !state._id,
      recurringMonths: state.recurring && !state._id ? 12 : 0,
    };
    const url = state._id
      ? `/api/transactions/${state._id}`
      : "/api/transactions";
    const method = state._id ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Error guardando movimiento");
      return;
    }
    toast.success(state._id ? "Actualizado" : "Movimiento creado");
    onSaved();
  }

  const filteredCats = categories.filter((c) =>
    state.type === "income"
      ? c.kind === "income"
      : state.type === "expense"
        ? c.kind === "expense"
        : true,
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {state._id ? "Editar movimiento" : "Nuevo movimiento"}
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={state.type}
                onValueChange={(v) =>
                  setState((s) => ({ ...s, type: v as TransactionFormState["type"] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Gasto</SelectItem>
                  <SelectItem value="income">Ingreso</SelectItem>
                  <SelectItem value="transfer">Transferencia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Fecha</Label>
              <Input
                id="date"
                type="date"
                value={state.date}
                onChange={(e) =>
                  setState((s) => ({ ...s, date: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Importe (ARS)</Label>
            <Input
              id="amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={state.amount}
              onChange={(e) =>
                setState((s) => ({ ...s, amount: e.target.value }))
              }
              placeholder="0"
            />
          </div>

          <div className="space-y-2">
            <Label>Cuenta</Label>
            <Select
              value={state.accountId}
              onValueChange={(v) => setState((s) => ({ ...s, accountId: v }))}
            >
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

          <div className="space-y-2">
            <Label>Categoría</Label>
            <Select
              value={state.categoryId}
              onValueChange={(v) => setState((s) => ({ ...s, categoryId: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Elegí una categoría" />
              </SelectTrigger>
              <SelectContent>
                {filteredCats.map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Input
              id="description"
              value={state.description}
              onChange={(e) =>
                setState((s) => ({ ...s, description: e.target.value }))
              }
              placeholder="Súper Coto"
            />
          </div>

          {!state._id ? (
            <>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>Es cuota</Label>
                  <p className="text-xs text-muted-foreground">
                    Genera N transacciones futuras
                  </p>
                </div>
                <Switch
                  checked={state.installmentEnabled}
                  onCheckedChange={(v) =>
                    setState((s) => ({
                      ...s,
                      installmentEnabled: v,
                      recurring: v ? false : s.recurring,
                    }))
                  }
                />
              </div>
              {state.installmentEnabled ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Cuota actual</Label>
                    <Input
                      type="number"
                      min={1}
                      value={state.installmentCurrent}
                      onChange={(e) =>
                        setState((s) => ({
                          ...s,
                          installmentCurrent: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>De</Label>
                    <Input
                      type="number"
                      min={1}
                      value={state.installmentTotal}
                      onChange={(e) =>
                        setState((s) => ({
                          ...s,
                          installmentTotal: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>Recurrente mensual</Label>
                  <p className="text-xs text-muted-foreground">
                    Genera 12 meses a futuro
                  </p>
                </div>
                <Switch
                  checked={state.recurring}
                  onCheckedChange={(v) =>
                    setState((s) => ({
                      ...s,
                      recurring: v,
                      installmentEnabled: v ? false : s.installmentEnabled,
                    }))
                  }
                />
              </div>
            </>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={state.notes}
              onChange={(e) => setState((s) => ({ ...s, notes: e.target.value }))}
            />
          </div>
        </div>
        <SheetFooter className="gap-2 pb-[env(safe-area-inset-bottom)] flex-wrap">
          {state._id && state.recurring ? (
            <Button
              variant="destructive"
              onClick={deleteRecurringSeries}
              disabled={saving}
              className="w-full sm:w-auto sm:mr-auto"
            >
              <Trash2 className="size-4 mr-2" />
              Eliminar serie
            </Button>
          ) : null}
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 sm:flex-none"
          >
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving} className="flex-1 sm:flex-none">
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
