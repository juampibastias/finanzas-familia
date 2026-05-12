"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { confirmDelete } from "@/lib/swal";
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import {
  TransactionFormSheet,
  emptyTransaction,
  type TransactionFormState,
} from "@/components/transaction-form";
import { formatCurrency, formatDate, startOfMonthUTC, endOfMonthUTC } from "@/lib/format";

interface TxRow {
  _id: string;
  date: string;
  amount: number;
  type: "income" | "expense" | "transfer";
  description: string;
  installment: { current: number; total: number } | null;
  recurring: boolean;
  accountId: { _id: string; name: string } | string;
  categoryId: { _id: string; name: string; color?: string } | string;
}

interface AccountOpt {
  _id: string;
  name: string;
}
interface CategoryOpt {
  _id: string;
  name: string;
  kind: string;
}

export default function MovimientosPage(): React.ReactElement {
  const today = new Date();
  const [from, setFrom] = useState(
    startOfMonthUTC(today).toISOString().slice(0, 10),
  );
  const [to, setTo] = useState(
    endOfMonthUTC(today).toISOString().slice(0, 10),
  );
  const [accountId, setAccountId] = useState<string>("_all");
  const [categoryId, setCategoryId] = useState<string>("_all");
  const [type, setType] = useState<string>("_all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: TxRow[]; total: number } | null>(null);
  const [accounts, setAccounts] = useState<AccountOpt[]>([]);
  const [categories, setCategories] = useState<CategoryOpt[]>([]);
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<TransactionFormState | null>(null);

  const limit = 50;

  const load = useCallback(async () => {
    const url = new URL("/api/transactions", window.location.origin);
    if (from) url.searchParams.set("from", from);
    if (to) url.searchParams.set("to", to);
    if (accountId !== "_all") url.searchParams.set("accountId", accountId);
    if (categoryId !== "_all") url.searchParams.set("categoryId", categoryId);
    if (type !== "_all") url.searchParams.set("type", type);
    url.searchParams.set("page", String(page));
    url.searchParams.set("limit", String(limit));
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (res.ok) {
      const json = (await res.json()) as { items: TxRow[]; total: number };
      setData(json);
    }
  }, [from, to, accountId, categoryId, type, page]);

  useEffect(() => {
    void (async () => {
      const [aRes, cRes] = await Promise.all([
        fetch("/api/accounts"),
        fetch("/api/categories"),
      ]);
      setAccounts((await aRes.json()) as AccountOpt[]);
      setCategories((await cRes.json()) as CategoryOpt[]);
    })();
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate(): void {
    setEditing({ ...emptyTransaction });
    setOpenForm(true);
  }

  function openEdit(t: TxRow): void {
    setEditing({
      _id: t._id,
      date: t.date.slice(0, 10),
      amount: t.amount.toString(),
      type: t.type,
      accountId: typeof t.accountId === "string" ? t.accountId : t.accountId._id,
      categoryId: typeof t.categoryId === "string" ? t.categoryId : t.categoryId._id,
      description: t.description,
      installmentEnabled: !!t.installment,
      installmentCurrent: t.installment?.current.toString() ?? "1",
      installmentTotal: t.installment?.total.toString() ?? "1",
      recurring: t.recurring,
      notes: "",
    });
    setOpenForm(true);
  }

  async function remove(id: string): Promise<void> {
    const ok = await confirmDelete({ title: "¿Borrar movimiento?", text: "Esta acción no se puede deshacer." });
    if (!ok) return;
    const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Borrado");
      void load();
    } else {
      toast.error("No se pudo borrar");
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / limit)) : 1;

  return (
    <>
      <PageHeader
        title="Movimientos"
        action={
          <Button onClick={openCreate} className="w-full sm:w-auto">
            <Plus className="mr-2 size-4" />
            Nuevo
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="p-4 grid gap-3 grid-cols-2 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label htmlFor="from">Desde</Label>
            <Input
              id="from"
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to">Hasta</Label>
            <Input
              id="to"
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="space-y-1.5 col-span-2 sm:col-span-1">
            <Label>Cuenta</Label>
            <Select
              value={accountId}
              onValueChange={(v) => {
                setAccountId(v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todas</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a._id} value={a._id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 col-span-2 sm:col-span-1">
            <Label>Categoría</Label>
            <Select
              value={categoryId}
              onValueChange={(v) => {
                setCategoryId(v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todas</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 col-span-2 sm:col-span-1">
            <Label>Tipo</Label>
            <Select
              value={type}
              onValueChange={(v) => {
                setType(v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todos</SelectItem>
                <SelectItem value="expense">Gasto</SelectItem>
                <SelectItem value="income">Ingreso</SelectItem>
                <SelectItem value="transfer">Transferencia</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!data ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin movimientos en el rango seleccionado.</p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Cuenta</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead className="text-right">Importe</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((t) => {
                      const acc = typeof t.accountId === "string" ? null : t.accountId;
                      const cat = typeof t.categoryId === "string" ? null : t.categoryId;
                      return (
                        <TableRow key={t._id}>
                          <TableCell className="whitespace-nowrap">{formatDate(t.date)}</TableCell>
                          <TableCell>
                            <div className="font-medium">{t.description || "—"}</div>
                            <div className="flex gap-1 mt-0.5">
                              {t.installment ? (
                                <Badge variant="outline" className="text-xs">
                                  Cuota {t.installment.current}/{t.installment.total}
                                </Badge>
                              ) : null}
                              {t.recurring ? (
                                <Badge variant="outline" className="text-xs">Recurrente</Badge>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>{acc?.name ?? "—"}</TableCell>
                          <TableCell>{cat?.name ?? "—"}</TableCell>
                          <TableCell className={`text-right tabular-nums ${t.type === "income" ? "text-green-600" : t.type === "expense" ? "text-destructive" : ""}`}>
                            {t.type === "expense" ? "-" : t.type === "income" ? "+" : ""}
                            {formatCurrency(t.amount)}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" onClick={() => openEdit(t)} aria-label="Editar">
                                <Pencil className="size-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => remove(t._id)} aria-label="Borrar">
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {data.items.map((t) => {
              const acc = typeof t.accountId === "string" ? null : t.accountId;
              const cat = typeof t.categoryId === "string" ? null : t.categoryId;
              return (
                <Card key={t._id}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{t.description || "—"}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {formatDate(t.date)} · {acc?.name ?? ""} · {cat?.name ?? ""}
                        </div>
                        <div className="flex gap-1 mt-1.5 flex-wrap">
                          {t.installment ? (
                            <Badge variant="outline" className="text-xs">
                              {t.installment.current}/{t.installment.total}
                            </Badge>
                          ) : null}
                          {t.recurring ? (
                            <Badge variant="outline" className="text-xs">Rec</Badge>
                          ) : null}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`font-semibold tabular-nums ${t.type === "income" ? "text-green-600" : t.type === "expense" ? "text-destructive" : ""}`}>
                          {t.type === "expense" ? "-" : t.type === "income" ? "+" : ""}
                          {formatCurrency(t.amount)}
                        </div>
                        <div className="flex gap-0.5 mt-1 justify-end">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(t)} aria-label="Editar">
                            <Pencil className="size-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => remove(t._id)} aria-label="Borrar">
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2 mt-4">
            <p className="text-xs text-muted-foreground">
              {data.total} resultado(s) · página {page} de {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                size="icon"
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                aria-label="Anterior"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                aria-label="Siguiente"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      <TransactionFormSheet
        open={openForm}
        onOpenChange={(v) => {
          setOpenForm(v);
          if (!v) setEditing(null);
        }}
        initial={editing}
        onSaved={() => {
          setOpenForm(false);
          setEditing(null);
          void load();
        }}
      />
    </>
  );
}
