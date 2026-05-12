/**
 * Seed inicial de la base.
 * Uso: npm run seed
 *
 * Crea (idempotente):
 *  - 2 usuarios (juan, julieta) con mustChangePassword=true
 *  - Cuentas base
 *  - Categorías base (income + expense)
 *
 * Si ya existe un documento por su clave natural (email/name), no lo duplica.
 */

// Env vars vienen de --env-file=.env.local (tsx/node flag).
// Si tu Node es < 20.6, podés llamarlo con: dotenv -e .env.local -- tsx scripts/seed.ts

import { hash } from "bcryptjs";
import mongoose from "mongoose";
import { connectDB } from "../src/lib/db";
import { User } from "../src/lib/models/User";
import { Account } from "../src/lib/models/Account";
import { Category } from "../src/lib/models/Category";

interface SeedAccount {
  name: string;
  type: "card" | "bank" | "cash" | "wallet";
  bank?: "Francés" | "Galicia" | "Nación" | "MercadoPago" | "Otro" | null;
  closingDay?: number | null;
  dueDay?: number | null;
  order: number;
}

const SEED_ACCOUNTS: SeedAccount[] = [
  { name: "Francés Master", type: "card", bank: "Francés", order: 1 },
  { name: "Francés Visa", type: "card", bank: "Francés", order: 2 },
  { name: "Galicia Master", type: "card", bank: "Galicia", order: 3 },
  { name: "Nación Master", type: "card", bank: "Nación", order: 4 },
  { name: "MP Juan", type: "wallet", bank: "MercadoPago", order: 10 },
  { name: "MP Juli 1", type: "wallet", bank: "MercadoPago", order: 11 },
  { name: "MP Juli 2", type: "wallet", bank: "MercadoPago", order: 12 },
  { name: "Efectivo", type: "cash", bank: null, order: 20 },
];

interface SeedCategory {
  name: string;
  kind: "income" | "expense";
  fixed: boolean;
  color: string;
}

const SEED_CATEGORIES: SeedCategory[] = [
  // Income
  { name: "Sueldo XNET", kind: "income", fixed: true, color: "#16a34a" },
  { name: "Freelance", kind: "income", fixed: false, color: "#22c55e" },
  { name: "Instituto Juli", kind: "income", fixed: false, color: "#10b981" },
  { name: "Subalquiler instituto", kind: "income", fixed: false, color: "#84cc16" },

  // Expense - Vivienda
  { name: "Luz", kind: "expense", fixed: true, color: "#f59e0b" },
  { name: "Gas", kind: "expense", fixed: true, color: "#f97316" },
  { name: "Agua", kind: "expense", fixed: true, color: "#0891b2" },
  { name: "Internet", kind: "expense", fixed: true, color: "#06b6d4" },
  { name: "ADT", kind: "expense", fixed: true, color: "#64748b" },
  { name: "Líneas", kind: "expense", fixed: true, color: "#8b5cf6" },

  // Hijas
  { name: "Colegio", kind: "expense", fixed: true, color: "#ec4899" },
  { name: "Hockey", kind: "expense", fixed: true, color: "#db2777" },
  { name: "Básquet", kind: "expense", fixed: true, color: "#be185d" },
  { name: "Inglés", kind: "expense", fixed: true, color: "#a21caf" },
  { name: "Psicólogas", kind: "expense", fixed: true, color: "#c026d3" },

  // Adultos
  { name: "Gym", kind: "expense", fixed: true, color: "#0ea5e9" },
  { name: "Running", kind: "expense", fixed: false, color: "#3b82f6" },
  { name: "Padel", kind: "expense", fixed: false, color: "#2563eb" },

  // Transporte
  { name: "Camioneta", kind: "expense", fixed: true, color: "#ef4444" },
  { name: "Mantenimiento", kind: "expense", fixed: false, color: "#dc2626" },

  // Alimentación
  { name: "Súper", kind: "expense", fixed: false, color: "#84cc16" },

  // Impuestos
  { name: "Monotributo", kind: "expense", fixed: true, color: "#475569" },
  { name: "Contador", kind: "expense", fixed: true, color: "#334155" },

  // Suscripciones
  { name: "Suscripciones", kind: "expense", fixed: true, color: "#7c3aed" },

  // Variables
  { name: "Salidas", kind: "expense", fixed: false, color: "#f43f5e" },
  { name: "Ropa", kind: "expense", fixed: false, color: "#e11d48" },
  { name: "Farmacia", kind: "expense", fixed: false, color: "#be123c" },
  { name: "Regalos", kind: "expense", fixed: false, color: "#f472b6" },

  // Otros
  { name: "Ayuda Casa", kind: "expense", fixed: true, color: "#a78bfa" },
  { name: "Deuda Tarjetas", kind: "expense", fixed: false, color: "#991b1b" },
];

async function upsertUser(email: string, name: string, password: string): Promise<void> {
  const existing = await User.findOne({ email }).lean();
  if (existing) {
    console.log(`✓ Usuario ya existe: ${email}`);
    return;
  }
  const passwordHash = await hash(password, 12);
  await User.create({
    email,
    name,
    passwordHash,
    role: "admin",
    mustChangePassword: true,
  });
  console.log(`+ Usuario creado: ${email} (password temporal, debe cambiarla al primer login)`);
}

async function upsertAccount(a: SeedAccount): Promise<void> {
  const existing = await Account.findOne({ name: a.name }).lean();
  if (existing) {
    console.log(`✓ Cuenta ya existe: ${a.name}`);
    return;
  }
  await Account.create({
    name: a.name,
    type: a.type,
    bank: a.bank ?? null,
    closingDay: a.closingDay ?? null,
    dueDay: a.dueDay ?? null,
    active: true,
    order: a.order,
  });
  console.log(`+ Cuenta creada: ${a.name}`);
}

async function upsertCategory(c: SeedCategory): Promise<void> {
  const existing = await Category.findOne({ name: c.name, kind: c.kind }).lean();
  if (existing) {
    console.log(`✓ Categoría ya existe: ${c.name}`);
    return;
  }
  await Category.create({
    name: c.name,
    kind: c.kind,
    fixed: c.fixed,
    color: c.color,
    icon: "Circle",
  });
  console.log(`+ Categoría creada: ${c.name}`);
}

async function main(): Promise<void> {
  console.log("→ Conectando a MongoDB...");
  await connectDB();
  console.log("✓ Conectado\n");

  console.log("→ Usuarios:");
  await upsertUser("juan@finanzas.app", "Juan", "Cambiar2026!");
  await upsertUser("julieta@finanzas.app", "Julieta", "Cambiar2026!");

  console.log("\n→ Cuentas:");
  for (const a of SEED_ACCOUNTS) await upsertAccount(a);

  console.log("\n→ Categorías:");
  for (const c of SEED_CATEGORIES) await upsertCategory(c);

  console.log("\n✓ Seed completado.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("✗ Seed falló:", err);
  process.exit(1);
});
