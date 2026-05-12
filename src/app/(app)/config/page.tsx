"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { confirmDelete } from "@/lib/swal";
import { Plus, Pencil, Trash2, Download, KeyRound } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

interface CategoryRow {
  _id: string;
  name: string;
  kind: "income" | "expense";
  fixed: boolean;
  color: string;
  icon: string;
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

export default function ConfigPage(): React.ReactElement {
  const [categories, setCategories] = useState<CategoryRow[] | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<CategoryFormState | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/categories", { cache: "no-store" });
    if (res.ok) setCategories((await res.json()) as CategoryRow[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
      <Tabs defaultValue="categorias">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="categorias" className="flex-1 sm:flex-none">
            Categorías
          </TabsTrigger>
          <TabsTrigger value="cuenta" className="flex-1 sm:flex-none">
            Cuenta
          </TabsTrigger>
          <TabsTrigger value="backup" className="flex-1 sm:flex-none">
            Backup
          </TabsTrigger>
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

        <TabsContent value="cuenta" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cuenta</CardTitle>
            </CardHeader>
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
