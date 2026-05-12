"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/page-header";
import { formatCurrency, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Wallet, TrendingUp, TrendingDown, CreditCard, AlertCircle } from "lucide-react";

interface DashboardData {
  totalBalance: number;
  upcomingDebtsAmount: number;
  upcomingDebts: Array<{ _id: string; name: string; amount: number; dueDate: string; priority: string }>;
  monthIncome: number;
  monthExpense: number;
  monthNet: number;
  totalCards: number;
  cardsBreakdown: Array<{ accountId: string; name: string; total: number }>;
  expenseByCategory: Array<{ categoryId: string; name: string; color: string; total: number }>;
  cashflowSeries: Array<{ month: string; income: number; expense: number; net: number }>;
  nextDebts: Array<{ _id: string; name: string; amount: number; dueDate: string; priority: string }>;
}

export default function DashboardPage(): React.ReactElement {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const res = await fetch("/api/dashboard", { cache: "no-store" });
        if (!res.ok) throw new Error("Error cargando dashboard");
        const json = (await res.json()) as DashboardData;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <div className="text-destructive text-sm">{error}</div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid gap-4 mt-4 grid-cols-1 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Dashboard" description="Resumen general" />

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <KPI
          icon={<Wallet className="size-5" />}
          label="Saldo total disponible"
          value={formatCurrency(data.totalBalance)}
          hint="Cuentas no-tarjeta"
        />
        <KPI
          icon={<AlertCircle className="size-5" />}
          label="A pagar próximas 2 semanas"
          value={formatCurrency(data.upcomingDebtsAmount)}
          hint={`${data.upcomingDebts.length} deuda(s)`}
          tone="warning"
        />
        <KPI
          icon={data.monthNet >= 0 ? <TrendingUp className="size-5" /> : <TrendingDown className="size-5" />}
          label="Cashflow del mes"
          value={formatCurrency(data.monthNet)}
          hint={`Ingresos ${formatCurrency(data.monthIncome)} · Gastos ${formatCurrency(data.monthExpense)}`}
          tone={data.monthNet >= 0 ? "success" : "danger"}
        />
        <KPI
          icon={<CreditCard className="size-5" />}
          label="Tarjetas este mes"
          value={formatCurrency(data.totalCards)}
          hint={`${data.cardsBreakdown.length} tarjeta(s)`}
        />
      </div>

      {data.cardsBreakdown.length > 0 ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Desglose por tarjeta</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {data.cardsBreakdown.map((c) => (
                <li key={c.accountId} className="flex items-center justify-between py-2">
                  <span className="text-sm">{c.name}</span>
                  <span className="text-sm font-medium tabular-nums">
                    {formatCurrency(c.total)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 mt-4 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gastos por categoría (este mes)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.expenseByCategory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tickFormatter={(v) => formatCurrency(Number(v))} width={80} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cashflow (6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.cashflowSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => formatCurrency(Number(v))} width={80} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="income" stroke="#16a34a" name="Ingresos" />
                  <Line type="monotone" dataKey="expense" stroke="#dc2626" name="Gastos" />
                  <Line type="monotone" dataKey="net" stroke="#6366f1" name="Neto" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Próximos vencimientos</CardTitle>
        </CardHeader>
        <CardContent>
          {data.nextDebts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin pagos pendientes.</p>
          ) : (
            <ul className="divide-y">
              {data.nextDebts.map((d) => (
                <li
                  key={d._id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{d.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(d.dueDate)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
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
                    <span className="font-medium tabular-nums">
                      {formatCurrency(d.amount)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function KPI({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: "success" | "warning" | "danger";
}): React.ReactElement {
  const toneClass =
    tone === "success"
      ? "text-green-600"
      : tone === "danger"
        ? "text-destructive"
        : tone === "warning"
          ? "text-amber-600"
          : "text-foreground";
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className={`text-xl sm:text-2xl font-semibold tabular-nums ${toneClass}`}>
          {value}
        </div>
        {hint ? (
          <p className="text-xs text-muted-foreground mt-1">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
