/**
 * Importa los datos de mayo 2026 desde el Excel Finanzas_Familiares_v4.
 * Ejecutar: npm run import-mayo
 *
 * Crea (idempotente por descripción+fecha+monto):
 *  - Transactions de ingresos y gastos fijos (Real mes)
 *  - Transactions de tarjetas por resumen mensual
 *  - Transactions del tracker semanal (11/05)
 *  - MonthlyBudgets (estimados) para 2026-05
 */

import mongoose from "mongoose";
import { connectDB } from "../src/lib/db";
import { User } from "../src/lib/models/User";
import { Account } from "../src/lib/models/Account";
import { Category } from "../src/lib/models/Category";
import { Transaction } from "../src/lib/models/Transaction";
import { MonthlyBudget } from "../src/lib/models/MonthlyBudget";

const MONTH = "2026-05";

// ─── Helpers ────────────────────────────────────────────────────────────────

function d(day: number) {
  return new Date(`2026-05-${String(day).padStart(2, "0")}T12:00:00.000Z`);
}

async function getAccount(accounts: Map<string, mongoose.Types.ObjectId>, name: string) {
  const id = accounts.get(name);
  if (!id) throw new Error(`Cuenta no encontrada: "${name}"`);
  return id;
}

async function getCat(categories: Map<string, mongoose.Types.ObjectId>, name: string) {
  const id = categories.get(name);
  if (!id) throw new Error(`Categoría no encontrada: "${name}"`);
  return id;
}

async function upsertTx(data: {
  date: Date;
  amount: number;
  type: "income" | "expense";
  accountId: mongoose.Types.ObjectId;
  categoryId: mongoose.Types.ObjectId;
  description: string;
  notes?: string;
  recurring?: boolean;
  recurringMonth?: string;
  installment?: { current: number; total: number } | null;
  createdBy: mongoose.Types.ObjectId;
}) {
  const existing = await Transaction.findOne({
    date: data.date,
    amount: data.amount,
    description: data.description,
    type: data.type,
  }).lean();

  if (existing) {
    console.log(`  ✓ Ya existe: ${data.description} ($${data.amount.toLocaleString("es-AR")})`);
    return;
  }

  await Transaction.create(data);
  console.log(`  + Creado: ${data.description} ($${data.amount.toLocaleString("es-AR")})`);
}

async function upsertBudget(data: {
  month: string;
  categoryId: mongoose.Types.ObjectId;
  estimated: number;
}) {
  const existing = await MonthlyBudget.findOne({
    month: data.month,
    categoryId: data.categoryId,
  }).lean();

  if (existing) {
    console.log(`  ✓ Budget ya existe para categoryId ${data.categoryId}`);
    return;
  }

  await MonthlyBudget.create(data);
  console.log(`  + Budget creado: $${data.estimated.toLocaleString("es-AR")}`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("→ Conectando a MongoDB...");
  await connectDB();
  console.log("✓ Conectado\n");

  // Cargar IDs de referencia
  const userJuan = await User.findOne({ email: "juan@finanzas.app" }).lean();
  if (!userJuan) throw new Error("Usuario juan@finanzas.app no encontrado. Ejecutá el seed primero.");
  const userId = userJuan._id as mongoose.Types.ObjectId;

  const allAccounts = await Account.find({}).lean();
  const accounts = new Map(allAccounts.map((a) => [a.name, a._id as mongoose.Types.ObjectId]));

  const allCategories = await Category.find({}).lean();
  const cats = new Map(allCategories.map((c) => [c.name, c._id as mongoose.Types.ObjectId]));

  // ── 1. INGRESOS ────────────────────────────────────────────────────────────
  console.log("→ Ingresos:");
  const incomes: Array<[string, number, string, string]> = [
    // [description, amount, categoryName, accountName]
    ["Sueldo XNET", 2_000_000, "Sueldo XNET", "MP Juan"],
    ["Freelance Juan - mantenimiento Cooperativa", 600_000, "Freelance", "MP Juan"],
    ["Instituto Julieta - sesiones", 3_600_000, "Instituto Juli", "MP Juli 1"],
    ["Subalquiler instituto", 300_000, "Subalquiler instituto", "MP Juli 1"],
  ];

  for (const [desc, amount, catName, accName] of incomes) {
    await upsertTx({
      date: d(1),
      amount,
      type: "income",
      accountId: await getAccount(accounts, accName),
      categoryId: await getCat(cats, catName),
      description: desc,
      recurring: true,
      recurringMonth: MONTH,
      createdBy: userId,
    });
  }

  // ── 2. GASTOS FIJOS (Real mes) ─────────────────────────────────────────────
  console.log("\n→ Gastos fijos:");
  const fixedExpenses: Array<[string, number, string]> = [
    // [description, realAmount, categoryName]
    ["Luz", 200_000, "Luz"],
    ["Gas", 250_000, "Gas"],
    ["Agua", 100_000, "Agua"],
    ["Internet", 25_000, "Internet"],
    ["Líneas telefónicas", 40_000, "Líneas"],
    ["Colegio", 200_000, "Colegio"],
    ["Hockey Joaqui", 70_000, "Hockey"],
    ["Básquet Catalina", 25_000, "Básquet"],
    ["Inglés ambas", 85_000, "Inglés"],
    ["Psicólogas Cata + Joaqui", 55_000, "Psicólogas"],
    ["Gym", 100_000, "Gym"],
    ["Profe running Juan", 50_000, "Running"],
    ["Padel Julieta", 50_000, "Padel"],
    ["Camioneta (prendario + seguro + combustible)", 1_000_000, "Camioneta"],
    ["Mantenimiento camioneta", 20_000, "Mantenimiento"],
    ["Súper + comida", 900_000, "Súper"],
    ["Monotributo Juli", 70_000, "Monotributo"],
    ["Contador Juli", 30_000, "Contador"],
    ["Yamila - ayuda casa", 180_000, "Ayuda Casa"],
    ["Salidas finde + entre semana", 400_000, "Salidas"],
    ["Ropa / farmacia / perfumería", 200_000, "Ropa"],
  ];

  for (const [desc, amount, catName] of fixedExpenses) {
    await upsertTx({
      date: d(1),
      amount,
      type: "expense",
      accountId: await getAccount(accounts, "Efectivo"),
      categoryId: await getCat(cats, catName),
      description: desc,
      recurring: true,
      recurringMonth: MONTH,
      createdBy: userId,
    });
  }

  // ── 3. TARJETAS (resumen mensual) ──────────────────────────────────────────
  console.log("\n→ Tarjetas:");
  const cards: Array<[string, number]> = [
    ["Francés Master", 719_476],
    ["Francés Visa", 678_580],
    ["Galicia Master", 300_000],
    ["Nación Master", 683_467],
  ];

  for (const [cardName, amount] of cards) {
    await upsertTx({
      date: d(1),
      amount,
      type: "expense",
      accountId: await getAccount(accounts, cardName),
      categoryId: await getCat(cats, "Deuda Tarjetas"),
      description: `Resumen ${cardName} mayo 2026`,
      recurring: true,
      recurringMonth: MONTH,
      createdBy: userId,
    });
  }

  // ── 4. TRACKER SEMANAL (11/05) ─────────────────────────────────────────────
  console.log("\n→ Tracker semanal:");
  // Categorías del tracker no coinciden exactamente; mapeamos a las más cercanas
  const tracker: Array<[string, number, string, string]> = [
    // [description, amount, categoryName, notes]
    ["Viaje XNET bondi ida y vuelta", 12_600, "Camioneta", "Juan - Traslados"],
    ["Comida XNET oficina", 7_900, "Súper", "Juan"],
    ["Almuerzo casa", 26_000, "Súper", "Familia"],
    ["Padel Juli - sesión", 9_000, "Padel", "Juli"],
    ["Cena casa", 20_000, "Súper", "Familia"],
  ];

  for (const [desc, amount, catName, notes] of tracker) {
    await upsertTx({
      date: d(11),
      amount,
      type: "expense",
      accountId: await getAccount(accounts, "Efectivo"),
      categoryId: await getCat(cats, catName),
      description: desc,
      notes,
      recurring: false,
      createdBy: userId,
    });
  }

  // ── 5. PRESUPUESTO ESTIMADO (MonthlyBudget) ────────────────────────────────
  console.log("\n→ Presupuesto estimado mayo:");
  const budgets: Array<[string, number]> = [
    ["Sueldo XNET", 2_000_000],
    ["Freelance", 600_000],
    ["Instituto Juli", 3_600_000],
    ["Subalquiler instituto", 300_000],
    ["Luz", 217_400],
    ["Gas", 113_700],
    ["Agua", 100_000],
    ["Internet", 25_000],
    ["Líneas", 40_000],
    ["Colegio", 200_000],
    ["Hockey", 70_000],
    ["Básquet", 25_000],
    ["Inglés", 85_000],
    ["Psicólogas", 55_000],
    ["Gym", 100_000],
    ["Running", 50_000],
    ["Padel", 50_000],
    ["Camioneta", 1_000_000],
    ["Mantenimiento", 20_000],
    ["Súper", 900_000],
    ["Monotributo", 70_000],
    ["Contador", 30_000],
    ["Ayuda Casa", 180_000],
    ["Salidas", 1_000_000],
    ["Ropa", 200_000],
    ["Deuda Tarjetas", 2_381_523],
  ];

  for (const [catName, estimated] of budgets) {
    const categoryId = await getCat(cats, catName);
    await upsertBudget({ month: MONTH, categoryId, estimated });
  }

  console.log("\n✓ Importación de mayo completada.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("✗ Importación falló:", err);
  process.exit(1);
});
