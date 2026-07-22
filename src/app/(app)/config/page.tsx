"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { confirmDelete } from "@/lib/swal";
import { Plus, Pencil, Trash2, Download, KeyRound, RefreshCw, Link2, Link2Off, Loader2, TrendingUp, TrendingDown, Repeat, Smartphone } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { formatDate, formatCurrency } from "@/lib/format";

interface CategoryRow {
  _id: string;
  name: string;
  kind: "income" | "expense";
  fixed: boolean;
  color: string;
  icon: string;
}

interface MPConnectionRow {
  _id: string;
  mpUserId: string;
  mpNickname: string;
  mpEmail: string;
  lastSyncAt: string | null;
  linkedAccountId: { _id: string; name: string; type: string };
}

interface AccountOpt {
  _id: string;
  name: string;
  type: string;
  bank: string | null;
}

interface RecurringRow {
  _id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  dayOfMonth: number;
  accountId: { _id: string; name: string };
  categoryId: { _id: string; name: string; color: string };
}

interface RecurringForm {
  description: string;
  amount: string;
  type: "income" | "expense";
  accountId: string;
  categoryId: string;
  dayOfMonth: string;
}

interface MPTxRow {
  _id: string;
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  categoryId: { name: string } | null;
}

interface CategoryFormState {
  _id?: string;
  name: string;
  kind: "income" | "expense";
  fixed: boolean;
  color: string;
  icon: string;
}

const emptyCategory: CategoryFormState = {
  name: "",
  kind: "expense",
  fixed: false,
  color: "#6366f1",
  icon: "Circle",
};

function ConfigPageInner(): React.ReactElement {
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get("tab") ?? "categorias";

  const [categories, setCategories] = useState<CategoryRow[] | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<CategoryFormState | null>(null);

  // MP state
  const [mpConnections, setMpConnections] = useState<MPConnectionRow[] | null>(null);
  const [mpAccounts, setMpAccounts] = useState<AccountOpt[]>([]);
  const [mpSelectedAccount, setMpSelectedAccount] = useState<string>("");
  const [mpSyncing, setMpSyncing] = useState<string | null>(null);
  const [mpTxs, setMpTxs] = useState<Record<string, MPTxRow[]>>({});

  // Recurring state
  const [recurring, setRecurring] = useState<RecurringRow[] | null>(null);
  const [recForm, setRecForm] = useState<RecurringForm | null>(null);
  const [allAccounts, setAllAccounts] = useState<AccountOpt[]>([]);
  const [allCategories, setAllCategories] = useState<CategoryRow[]>([]);

  // Cuenta state
  const [phone, setPhone] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/categories", { cache: "no-store" });
    if (res.ok) setCategories((await res.json()) as CategoryRow[]);
  }, []);

  const loadMpTxs = useCallback(async (connectionId: string) => {
    const res = await fetch(`/api/mp/transactions?connectionId=${connectionId}&limit=100`, { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as MPTxRow[];
      setMpTxs((prev) => ({ ...prev, [connectionId]: data }));
    }
  }, []);

  const loadMp = useCallback(async () => {
    const [connRes, accRes] = await Promise.all([
      fetch("/api/mp/connections", { cache: "no-store" }),
      fetch("/api/accounts", { cache: "no-store" }),
    ]);
    if (connRes.ok) {
      const conns = (await connRes.json()) as MPConnectionRow[];
      setMpConnections(conns);
      for (const c of conns) void loadMpTxs(c._id);
    }
    if (accRes.ok) {
      const all = (await accRes.json()) as AccountOpt[];
      setMpAccounts(all.filter((a) => a.bank === "MercadoPago" || a.type === "wallet"));
    }
  }, [loadMpTxs]);

  const loadRecurring = useCallback(async () => {
    const [recRes, accRes, catRes] = await Promise.all([
      fetch("/api/recurring", { cache: "no-store" }),
      fetch("/api/accounts", { cache: "no-store" }),
      fetch("/api/categories", { cache: "no-store" }),
    ]);
    if (recRes.ok) setRecurring((await recRes.json()) as RecurringRow[]);
    if (accRes.ok) setAllAccounts((await accRes.json()) as AccountOpt[]);
    if (catRes.ok) setAllCategories((await catRes.json()) as CategoryRow[]);
  }, []);

  const loadPhone = useCallback(async () => {
    const res = await fetch("/api/me", { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { phone?: string };
      setPhone(data.phone ?? "");
    }
  }, []);

  useEffect(() => {
    void load();
    void loadMp();
    void loadRecurring();
    void loadPhone();
  }, [load, loadMp, loadRecurring, loadPhone]);

  // Handle MP OAuth redirect result — auto-trigger sync after connection
  useEffect(() => {
    const success = searchParams.get("mp_success");
    const error = searchParams.get("mp_error");
    if (error) { toast.error(`Error conectando MP: ${error}`); return; }
    if (!success) return;

    toast.success("MercadoPago conectado. Sincronizando movimientos...");
    // Wait for DB to settle then auto-sync all connections
    setTimeout(() => {
      void (async () => {
        const res = await fetch("/api/mp/connections", { cache: "no-store" });
        if (!res.ok) return;
        const conns = (await res.json()) as MPConnectionRow[];
        for (const c of conns) {
          setMpSyncing(c._id);
          const syncRes = await fetch("/api/mp/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ connectionId: c._id }),
          });
          setMpSyncing(null);
          if (syncRes.ok) {
            const data = (await syncRes.json()) as { imported: number; skipped: number };
            toast.success(`Sincronizado: ${data.imported} nuevos movimientos importados`);
          }
        }
        void loadMp();
      })();
    }, 1500);
  }, [searchParams, loadMp]);

  function openCreate(): void {
    setEditing({ ...emptyCategory });
    setOpenForm(true);
  }
  function openEdit(c: CategoryRow): void {
    setEditing({
      _id: c._id,
      name: c.name,
      kind: c.kind,
      fixed: c.fixed,
      color: c.color,
      icon: c.icon,
    });
    setOpenForm(true);
  }
  async function saveCat(): Promise<void> {
    if (!editing) return;
    if (!editing.name.trim()) {
      toast.error("Nombre requerido");
      return;
    }
    const payload = {
      name: editing.name.trim(),
      kind: editing.kind,
      fixed: editing.fixed,
      color: editing.color,
      icon: editing.icon,
    };
    const url = editing._id ? `/api/categories/${editing._id}` : "/api/categories";
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
  async function removeCat(id: string): Promise<void> {
    const ok = await confirmDelete({ title: "¿Borrar categoría?", text: "Solo se puede borrar si no tiene movimientos asociados." });
    if (!ok) return;
    const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Borrada");
      void load();
    } else {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      toast.error(data?.error ?? "No se pudo borrar");
    }
  }

  async function mpSync(connectionId: string, reset = false): Promise<void> {
    setMpSyncing(connectionId);
    const res = await fetch("/api/mp/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId, reset }),
    });
    setMpSyncing(null);
    if (res.ok) {
      const data = (await res.json()) as { imported: number; skipped: number; errors: number };
      if (reset) {
        toast.success(`Reimportado: ${data.imported} movimientos con categorías mejoradas`);
      } else {
        toast.success(`Sincronizado: ${data.imported} nuevos, ${data.skipped} ya existentes`);
      }
      void loadMp();
      void loadMpTxs(connectionId);
    } else {
      toast.error("Error al sincronizar");
    }
  }

  async function savePhone(): Promise<void> {
    setSavingPhone(true);
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phone.trim() || null }),
    });
    setSavingPhone(false);
    if (res.ok) toast.success("Teléfono guardado");
    else toast.error("Error guardando");
  }

  async function saveRecurring(): Promise<void> {
    if (!recForm) return;
    if (!recForm.description || !recForm.amount || !recForm.accountId || !recForm.categoryId || !recForm.dayOfMonth) {
      toast.error("Completá todos los campos");
      return;
    }
    const res = await fetch("/api/recurring", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: recForm.description,
        amount: Number(recForm.amount),
        type: recForm.type,
        accountId: recForm.accountId,
        categoryId: recForm.categoryId,
        dayOfMonth: Number(recForm.dayOfMonth),
      }),
    });
    if (res.ok) {
      toast.success("Recurrente guardado");
      setRecForm(null);
      void loadRecurring();
    } else {
      toast.error("Error guardando");
    }
  }

  async function deleteRecurring(id: string): Promise<void> {
    const res = await fetch(`/api/recurring/${id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Eliminado"); void loadRecurring(); }
    else toast.error("Error");
  }

  async function mpDisconnect(connectionId: string): Promise<void> {
    const res = await fetch(`/api/mp/connections?id=${connectionId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Desvinculado");
      void loadMp();
    } else {
      toast.error("Error al desvincular");
    }
  }

  async function exportJson(): Promise<void> {
    const res = await fetch("/api/export");
    if (!res.ok) {
      toast.error("No se pudo exportar");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup-finanzas-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Backup descargado");
  }

  return (
    <>
      <PageHeader title="Configuración" />
      <Tabs defaultValue={defaultTab}>
        <TabsList className="w-full sm:w-auto flex-wrap h-auto gap-1">
          <TabsTrigger value="categorias" className="flex-1 sm:flex-none">Categorías</TabsTrigger>
          <TabsTrigger value="mercadopago" className="flex-1 sm:flex-none">MercadoPago</TabsTrigger>
          <TabsTrigger value="recurrentes" className="flex-1 sm:flex-none">Recurrentes</TabsTrigger>
          <TabsTrigger value="cuenta" className="flex-1 sm:flex-none">Cuenta</TabsTrigger>
          <TabsTrigger value="backup" className="flex-1 sm:flex-none">Backup</TabsTrigger>
        </TabsList>

        <TabsContent value="categorias" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button onClick={openCreate} className="w-full sm:w-auto">
              <Plus className="mr-2 size-4" />
              Nueva categoría
            </Button>
          </div>
          {!categories ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : (
            <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((c) => (
                <Card key={c._id}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div
                      className="size-3 rounded-full shrink-0"
                      style={{ backgroundColor: c.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{c.name}</div>
                      <div className="flex gap-1 mt-0.5">
                        <Badge variant="outline" className="text-xs">
                          {c.kind === "expense" ? "Gasto" : "Ingreso"}
                        </Badge>
                        {c.fixed ? (
                          <Badge variant="outline" className="text-xs">Fijo</Badge>
                        ) : null}
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(c)} aria-label="Editar">
                      <Pencil className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => removeCat(c._id)} aria-label="Borrar">
                      <Trash2 className="size-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="mercadopago" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conectar cuenta MercadoPago</CardTitle>
              <CardDescription>
                Vinculá tu cuenta MP para importar automáticamente gastos e ingresos.
                Cada usuario conecta la suya por separado.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {mpAccounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No tenés cuentas de tipo MercadoPago creadas. Creá una en Cuentas con banco &ldquo;MercadoPago&rdquo; primero.
                </p>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  <Select value={mpSelectedAccount} onValueChange={setMpSelectedAccount}>
                    <SelectTrigger className="w-full sm:w-56">
                      <SelectValue placeholder="Elegí la cuenta MP" />
                    </SelectTrigger>
                    <SelectContent>
                      {mpAccounts.map((a) => (
                        <SelectItem key={a._id} value={a._id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    asChild={!!mpSelectedAccount}
                    disabled={!mpSelectedAccount}
                    className="flex-1 sm:flex-none"
                  >
                    {mpSelectedAccount ? (
                      <a href={`/api/mp/connect?accountId=${mpSelectedAccount}`}>
                        <Link2 className="mr-2 size-4" />
                        Conectar con MP
                      </a>
                    ) : (
                      <span>
                        <Link2 className="mr-2 size-4" />
                        Conectar con MP
                      </span>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {mpConnections === null ? (
            <Skeleton className="h-32" />
          ) : mpConnections.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ninguna cuenta conectada todavía.</p>
          ) : (
            <div className="space-y-4">
              {mpConnections.map((c) => {
                const txs = mpTxs[c._id] ?? null;
                return (
                  <Card key={c._id}>
                    <CardContent className="p-4 space-y-3">
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <div className="font-medium">{c.mpNickname || c.mpEmail}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {c.mpEmail} · Cuenta: <strong>{c.linkedAccountId?.name}</strong>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {c.lastSyncAt
                              ? `Última sync: ${formatDate(c.lastSyncAt)} ${new Date(c.lastSyncAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`
                              : "Sin sincronizar aún"}
                            {txs !== null && (
                              <span className="ml-2 font-medium text-foreground">{txs.length} movimientos importados</span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => mpSync(c._id)}
                            disabled={mpSyncing === c._id}
                          >
                            {mpSyncing === c._id ? (
                              <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                            ) : (
                              <RefreshCw className="size-3.5 mr-1.5" />
                            )}
                            Sincronizar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950"
                            onClick={() => mpSync(c._id, true)}
                            disabled={mpSyncing === c._id}
                            title="Borra los movimientos importados y los reimporta con IA mejorada"
                          >
                            {mpSyncing === c._id ? (
                              <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                            ) : (
                              <RefreshCw className="size-3.5 mr-1.5" />
                            )}
                            Reimportar todo
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => mpDisconnect(c._id)}
                          >
                            <Link2Off className="size-3.5 mr-1.5" />
                            Desvincular
                          </Button>
                        </div>
                      </div>

                      {/* Transactions list */}
                      {mpSyncing === c._id ? (
                        <div className="space-y-1.5">
                          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8" />)}
                        </div>
                      ) : txs === null ? (
                        <Skeleton className="h-20" />
                      ) : txs.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No hay movimientos importados aún.</p>
                      ) : (
                        <div className="rounded-md border overflow-hidden">
                          <div className="max-h-72 overflow-y-auto">
                            <table className="w-full text-xs">
                              <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                                <tr>
                                  <th className="text-left px-3 py-2 font-medium">Fecha</th>
                                  <th className="text-left px-3 py-2 font-medium">Descripción</th>
                                  <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">Categoría</th>
                                  <th className="text-right px-3 py-2 font-medium">Monto</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {txs.map((tx) => (
                                  <tr key={tx._id} className="hover:bg-muted/40 transition-colors">
                                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                                      {formatDate(tx.date)}
                                    </td>
                                    <td className="px-3 py-2 max-w-[160px] sm:max-w-xs">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        {tx.type === "income" ? (
                                          <TrendingUp className="size-3 text-emerald-500 shrink-0" />
                                        ) : (
                                          <TrendingDown className="size-3 text-red-500 shrink-0" />
                                        )}
                                        <span className="truncate">{tx.description || "—"}</span>
                                      </div>
                                    </td>
                                    <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">
                                      {tx.categoryId?.name ?? "—"}
                                    </td>
                                    <td className={`px-3 py-2 text-right font-medium whitespace-nowrap ${tx.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                                      {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <Card className="border-dashed">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">
                <strong>Webhook URL</strong> (configurar en tu app de MP Developers para recibir movimientos en tiempo real):<br />
                <code className="bg-muted px-1 py-0.5 rounded text-xs break-all">
                  {typeof window !== "undefined" ? window.location.origin : ""}/api/mp/webhook
                </code>
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recurrentes" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button
              className="w-full sm:w-auto"
              onClick={() => setRecForm({ description: "", amount: "", type: "expense", accountId: allAccounts[0]?._id ?? "", categoryId: "", dayOfMonth: "1" })}
            >
              <Plus className="mr-2 size-4" />
              Nuevo recurrente
            </Button>
          </div>

          {recForm && (
            <Card>
              <CardHeader><CardTitle className="text-base">Nuevo movimiento recurrente</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <Label>Descripción</Label>
                    <Input value={recForm.description} onChange={(e) => setRecForm({ ...recForm, description: e.target.value })} placeholder="Ej: Luz, Gas, Netflix..." />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Monto</Label>
                    <Input type="number" value={recForm.amount} onChange={(e) => setRecForm({ ...recForm, amount: e.target.value })} placeholder="0" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Día del mes</Label>
                    <Input type="number" min={1} max={28} value={recForm.dayOfMonth} onChange={(e) => setRecForm({ ...recForm, dayOfMonth: e.target.value })} placeholder="1-28" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tipo</Label>
                    <Select value={recForm.type} onValueChange={(v) => setRecForm({ ...recForm, type: v as "income" | "expense" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expense">Gasto</SelectItem>
                        <SelectItem value="income">Ingreso</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cuenta</Label>
                    <Select value={recForm.accountId} onValueChange={(v) => setRecForm({ ...recForm, accountId: v })}>
                      <SelectTrigger><SelectValue placeholder="Elegí cuenta" /></SelectTrigger>
                      <SelectContent>
                        {allAccounts.map((a) => <SelectItem key={a._id} value={a._id}>{a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label>Categoría</Label>
                    <Select value={recForm.categoryId} onValueChange={(v) => setRecForm({ ...recForm, categoryId: v })}>
                      <SelectTrigger><SelectValue placeholder="Elegí categoría" /></SelectTrigger>
                      <SelectContent>
                        {allCategories.filter((c) => c.kind === recForm.type).map((c) => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setRecForm(null)}>Cancelar</Button>
                  <Button onClick={saveRecurring}>Guardar</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {recurring === null ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : recurring.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay movimientos recurrentes. Agregá tus gastos fijos (luz, gas, sueldo, etc.) y se crean solos cada mes.</p>
          ) : (
            <div className="space-y-2">
              {recurring.map((r) => (
                <Card key={r._id}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <Repeat className="size-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{r.description}</div>
                      <div className="text-xs text-muted-foreground">
                        Día {r.dayOfMonth} · {r.accountId?.name} · {r.categoryId?.name}
                      </div>
                    </div>
                    <div className={`font-semibold text-sm whitespace-nowrap ${r.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {r.type === "income" ? "+" : "-"}${new Intl.NumberFormat("es-AR").format(r.amount)}
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => deleteRecurring(r._id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="cuenta" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">WhatsApp para registrar gastos</CardTitle>
              <CardDescription>
                Vinculá tu número para poder registrar gastos enviando un mensaje como: <em>&quot;gasté 800 en nafta&quot;</em>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Número de WhatsApp</Label>
                <div className="flex gap-2">
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+5492614001122 (con código de país)"
                    className="flex-1"
                  />
                  <Button onClick={savePhone} disabled={savingPhone}>
                    {savingPhone ? <Loader2 className="size-4 animate-spin" /> : <Smartphone className="size-4 mr-1.5" />}
                    Guardar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Formato: +549 + código de área + número (sin el 15). Ej: +5492614001122</p>
              </div>
              {typeof window !== "undefined" && (
                <div className="rounded-md bg-muted p-3 text-xs space-y-1">
                  <p className="font-medium">URL Webhook para Twilio:</p>
                  <code className="break-all">{window.location.origin}/api/whatsapp/webhook</code>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Contraseña</CardTitle></CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/cambiar-password">
                  <KeyRound className="mr-2 size-4" />
                  Cambiar contraseña
                </Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backup" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Backup</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Descargá un JSON con todas tus cuentas, transacciones, deudas, categorías y presupuestos.
              </p>
              <Button onClick={exportJson}>
                <Download className="mr-2 size-4" />
                Exportar todo a JSON
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Category form */}
      <Sheet
        open={openForm}
        onOpenChange={(v) => {
          setOpenForm(v);
          if (!v) setEditing(null);
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing?._id ? "Editar categoría" : "Nueva categoría"}</SheetTitle>
          </SheetHeader>
          {editing ? (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={editing.kind}
                  onValueChange={(v) =>
                    setEditing({ ...editing, kind: v as "income" | "expense" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Gasto</SelectItem>
                    <SelectItem value="income">Ingreso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <Input
                  type="color"
                  value={editing.color}
                  onChange={(e) => setEditing({ ...editing, color: e.target.value })}
                  className="h-10 w-20 p-1"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label>Fijo (gasto mensual recurrente)</Label>
                <Switch
                  checked={editing.fixed}
                  onCheckedChange={(v) => setEditing({ ...editing, fixed: v })}
                />
              </div>
            </div>
          ) : null}
          <SheetFooter className="gap-2 pb-[env(safe-area-inset-bottom)]">
            <Button variant="outline" onClick={() => setOpenForm(false)} className="flex-1 sm:flex-none">
              Cancelar
            </Button>
            <Button onClick={saveCat} className="flex-1 sm:flex-none">
              Guardar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

export default function ConfigPage(): React.ReactElement {
  return (
    <Suspense>
      <ConfigPageInner />
    </Suspense>
  );
}
