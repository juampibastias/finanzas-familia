"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { formatCurrency, toMonthKey, addMonths } from "@/lib/format";

interface CategoryOpt {
  _id: string;
  name: string;
  kind: "income" | "expense";
  color: string;
}
interface BudgetRow {
  categoryId: string;
  name: string;
  estimated: number;
  real: number;
}

function monthOptions(): Array<{ value: string; label: string }> {
  const out: Array<{ value: string; label: string }> = [];
  const now = new Date();
  for (let i = -3; i <= 3; i++) {
    const d = addMonths(now, i);
    const key = toMonthKey(d);
    const label = d.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
    out.push({ value: key, label });
  }
  return out;
}

export default function PresupuestoPage(): React.ReactElement {
  const [month, setMonth] = useState(toMonthKey(new Date()));
  const [rows, setRows] = useState<BudgetRow[] | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRows(null);
    const [year, mm] = month.split("-").map((s) => parseInt(s, 10));
    const fromDate = new Date(Date.UTC(year!, (mm ?? 1) - 1, 1));
    const toDate = new Date(Date.UTC(year!, mm ?? 1, 0, 23, 59, 59, 999));
    const from = fromDate.toISOString().slice(0, 10);
    const to = toDate.toISOString().slice(0, 10);
    const [cRes, bRes, tRes] = await Promise.all([
      fetch("/api/categories"),
      fetch(`/api/budgets?month=${month}`),
      fetch(`/api/transactions?from=${from}&to=${to}&type=expense&limit=500`),
    ]);
    const cats = (await cRes.json()) as CategoryOpt[];
    const budgets = (await bRes.json()) as Array<{ categoryId: { _id: string } | string; estimated: number }>;
    const tx = (await tRes.json()) as {
      items: Array<{ categoryId: { _id: string } | string; amount: number }>;
    };
    const budgetByCat = new Map<string, number>();
    for (const b of budgets) {
      const id = typeof b.categoryId === "string" ? b.categoryId : b.categoryId._id;
      budgetByCat.set(id, b.estimated);
    }
    const realByCat = new Map<string, number>();
    for (const t of tx.items) {
      const id = typeof t.categoryId === "string" ? t.categoryId : t.categoryId._id;
      realByCat.set(id, (realByCat.get(id) ?? 0) + t.amount);
    }
    const expenseCats = cats.filter((c) => c.kind === "expense");
    const next: BudgetRow[] = expenseCats.map((c) => ({
      categoryId: c._id,
      name: c.name,
      estimated: budgetByCat.get(c._id) ?? 0,
      real: realByCat.get(c._id) ?? 0,
    }));
    setRows(next);
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveEstimated(catId: string, value: number): Promise<void> {
    setSavingId(catId);
    const res = await fetch("/api/budgets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, categoryId: catId, estimated: value }),
    });
    setSavingId(null);
    if (!res.ok) toast.error("No se pudo guardar");
  }

  const totalEst = rows?.reduce((s, r) => s + r.estimated, 0) ?? 0;
  const totalReal = rows?.reduce((s, r) => s + r.real, 0) ?? 0;
  const totalVar = totalEst > 0 ? ((totalReal - totalEst) / totalEst) * 100 : 0;

  return (
    <>
      <PageHeader
        title="Presupuesto"
        action={
          <div className="w-full sm:w-48">
            <Label className="sr-only">Mes</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions().map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {!rows ? (
        <Skeleton className="h-96" />
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden sm:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Estimado</TableHead>
                    <TableHead className="text-right">Real</TableHead>
                    <TableHead className="text-right">Variación</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const variation =
                      r.estimated > 0 ? ((r.real - r.estimated) / r.estimated) * 100 : 0;
                    return (
                      <TableRow key={r.categoryId}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-right">
                          <BudgetInput
                            value={r.estimated}
                            saving={savingId === r.categoryId}
                            onCommit={(v) => saveEstimated(r.categoryId, v)}
                          />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(r.real)}
                        </TableCell>
                        <TableCell
                          className={`text-right tabular-nums ${variation > 5 ? "text-destructive" : variation < -5 ? "text-green-600" : ""}`}
                        >
                          {r.estimated > 0 ? `${variation.toFixed(1)}%` : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(totalEst)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(totalReal)}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${totalVar > 5 ? "text-destructive" : totalVar < -5 ? "text-green-600" : ""}`}
                    >
                      {totalEst > 0 ? `${totalVar.toFixed(1)}%` : "—"}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {rows.map((r) => {
              const variation =
                r.estimated > 0 ? ((r.real - r.estimated) / r.estimated) * 100 : 0;
              return (
                <Card key={r.categoryId}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{r.name}</div>
                      <div
                        className={`text-sm tabular-nums ${variation > 5 ? "text-destructive" : variation < -5 ? "text-green-600" : "text-muted-foreground"}`}
                      >
                        {r.estimated > 0 ? `${variation.toFixed(1)}%` : "—"}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Estimado</Label>
                        <BudgetInput
                          value={r.estimated}
                          saving={savingId === r.categoryId}
                          onCommit={(v) => saveEstimated(r.categoryId, v)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Real</Label>
                        <div className="text-base tabular-nums font-medium pt-2">
                          {formatCurrency(r.real)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            <Card>
              <CardContent className="p-3 space-y-1">
                <div className="font-semibold">Total</div>
                <div className="flex justify-between text-sm">
                  <span>Estimado</span>
                  <span className="tabular-nums">{formatCurrency(totalEst)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Real</span>
                  <span className="tabular-nums">{formatCurrency(totalReal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Variación</span>
                  <span
                    className={`tabular-nums ${totalVar > 5 ? "text-destructive" : totalVar < -5 ? "text-green-600" : ""}`}
                  >
                    {totalEst > 0 ? `${totalVar.toFixed(1)}%` : "—"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </>
  );
}

function BudgetInput({
  value,
  saving,
  onCommit,
}: {
  value: number;
  saving: boolean;
  onCommit: (v: number) => void;
}): React.ReactElement {
  const [v, setV] = useState(value.toString());
  useEffect(() => {
    setV(value.toString());
  }, [value]);
  return (
    <Input
      type="number"
      inputMode="decimal"
      min={0}
      step={1}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        const n = parseFloat(v);
        if (!Number.isFinite(n) || n < 0) return;
        if (n !== value) onCommit(n);
      }}
      disabled={saving}
      className="text-right tabular-nums"
    />
  );
}
