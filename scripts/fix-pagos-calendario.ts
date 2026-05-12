/**
 * Mueve los pagos del calendario de Transactions → Debts
 * y borra las transacciones mal creadas.
 */

import mongoose from "mongoose";
import { connectDB } from "../src/lib/db";
import { Transaction } from "../src/lib/models/Transaction";
import { Debt } from "../src/lib/models/Debt";

async function main() {
  console.log("→ Conectando...");
  await connectDB();
  console.log("✓ Conectado\n");

  // ── Pagos a crear como Debts ──────────────────────────────────────────────
  const pagos = [
    { name: "PAGO BNA Master",       amount: 683_467, dueDate: new Date("2026-05-13T12:00:00Z"), priority: "high"   as const },
    { name: "PAGO MercadoPago préstamo", amount: 560_000, dueDate: new Date("2026-05-18T12:00:00Z"), priority: "high"   as const },
    { name: "PAGO Galicia",          amount: 900_000, dueDate: new Date("2026-05-20T12:00:00Z"), priority: "high"   as const },
  ];

  for (const p of pagos) {
    const existing = await Debt.findOne({ name: p.name });
    if (existing) {
      console.log(`  ✓ Ya existe como Debt: ${p.name}`);
      continue;
    }
    await Debt.create({ ...p, paid: false, paidDate: null, notes: "" });
    console.log(`  + Debt creado: ${p.name} ($${p.amount.toLocaleString("es-AR")})`);
  }

  // ── Borrar las transacciones mal creadas ──────────────────────────────────
  const toDelete = [
    { description: "PAGO BNA Master mayo 2026",       amount: 683_467 },
    { description: "PAGO MercadoPago préstamo",        amount: 560_000 },
    { description: "PAGO Galicia mayo 2026",           amount: 900_000 },
  ];

  console.log("\n→ Borrando transacciones incorrectas...");
  for (const t of toDelete) {
    const res = await Transaction.deleteMany({ description: t.description, amount: t.amount });
    if (res.deletedCount > 0) {
      console.log(`  - Borrada: ${t.description} (${res.deletedCount})`);
    } else {
      console.log(`  ~ No encontrada: ${t.description}`);
    }
  }

  console.log("\n✓ Listo.");
  await mongoose.disconnect();
}

main().catch((err) => { console.error("✗", err); process.exit(1); });
