import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

const NUMBER = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 0,
});

export function formatCurrency(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "$ 0";
  return ARS.format(n).replace(/^(\$)/, "$ ");
}

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "0";
  return NUMBER.format(n);
}

export function formatDate(
  d: Date | string | null | undefined,
  fmt = "dd/MM/yyyy",
): string {
  if (!d) return "";
  const date = typeof d === "string" ? parseISO(d) : d;
  return format(date, fmt, { locale: es });
}

export function formatDateLong(d: Date | string | null | undefined): string {
  return formatDate(d, "EEEE d 'de' MMMM");
}

export function toMonthKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  return `${y}-${m}`;
}

export function startOfMonthUTC(d: Date = new Date()): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0));
}

export function endOfMonthUTC(d: Date = new Date()): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999));
}

export function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}
