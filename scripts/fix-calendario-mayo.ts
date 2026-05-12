/**
 * Asienta los movimientos del calendario (11/05 - 22/05) con fechas correctas.
 * - Actualiza fechas/montos de pagos de tarjetas ya importados
 * - Crea MP préstamo (único, no existía)
 * - Crea cobros semanales de Juli
 * - Actualiza fecha del freelance Juan
 *
 * Uso: npm run fix-calendario
 */

import mongoose from "mongoose";
import { connectDB } from "../src/lib/db";
import { User } from "../src/lib/models/User";
import { Account } from "../src/lib/models/Account";
import { Category } from "../src/lib/models/Category";
import { Transaction } from "../src/lib/models/Transaction";

function d(day: number) {
  return new Date(`2026-05-${String(day).padStart(2, "0")}T12:00:00.000Z`);
}

async function main() {
  console.log("→ Conectando...");
  await connectDB();
  console.log("✓ Conectado\n");

  const userJuan = await User.findOne({ email: "juan@finanzas.app" }).lean();
  if (!userJuan) throw new Error("Usuario no encontrado");
  const userId = userJuan._id as mongoose.Types.ObjectId;

  const allAccounts = await Account.find({}).lean();
  const acc = new Map(allAccounts.map((a) => [a.name, a._id as mongoose.Types.ObjectId]));

  const allCats = await Category.find({}).lean();
  const cat = new Map(allCats.map((c) => [c.name, c._id as mongoose.Types.ObjectId]));

  // ── 1. PAGO BNA Master 13/05 — actualizar fecha del Nación Master ──────────
  console.log("→ Actualizando fecha Nación Master → 13/05...");
  const nacionTx = await Transaction.findOne({
    accountId: acc.get("Nación Master"),
    type: "expense",
    amount: 683_467,
  });
  if (nacionTx) {
    nacionTx.date = d(13);
    nacionTx.description = "PAGO BNA Master mayo 2026";
    await nacionTx.save();
    console.log("  ✓ Actualizado");
  } else {
    console.log("  ! No encontrado — creando...");
    await Transaction.create({
      date: d(13),
      amount: 683_467,
      type: "expense",
      accountId: acc.get("Nación Master"),
      categoryId: cat.get("Deuda Tarjetas"),
      description: "PAGO BNA Master mayo 2026",
      recurring: false,
      createdBy: userId,
    });
    console.log("  ✓ Creado");
  }

  // ── 2. PAGO Galicia 20/05 — actualizar fecha y corregir monto ─────────────
  console.log("→ Actualizando Galicia → 20/05, $900.000...");
  const galiciaTx = await Transaction.findOne({
    accountId: acc.get("Galicia Master"),
    type: "expense",
    recurring: false,
  });
  if (galiciaTx) {
    galiciaTx.date = d(20);
    galiciaTx.amount = 900_000;
    galiciaTx.description = "PAGO Galicia mayo 2026";
    await galiciaTx.save();
    console.log("  ✓ Actualizado a $900.000");
  } else {
    console.log("  ! No encontrado — creando...");
    await Transaction.create({
      date: d(20),
      amount: 900_000,
      type: "expense",
      accountId: acc.get("Galicia Master"),
      categoryId: cat.get("Deuda Tarjetas"),
      description: "PAGO Galicia mayo 2026",
      recurring: false,
      createdBy: userId,
    });
    console.log("  ✓ Creado");
  }

  // ── 3. PAGO MercadoPago préstamo 18/05 — nuevo ────────────────────────────
  console.log("→ Creando PAGO MercadoPago préstamo 18/05...");
  const mpExisting = await Transaction.findOne({
    amount: 560_000,
    type: "expense",
    date: d(18),
  });
  if (mpExisting) {
    console.log("  ✓ Ya existe");
  } else {
    await Transaction.create({
      date: d(18),
      amount: 560_000,
      type: "expense",
      accountId: acc.get("MP - JUAN"),
      categoryId: cat.get("Deuda Tarjetas"),
      description: "PAGO MercadoPago préstamo",
      notes: "Préstamo MP en un solo pago",
      recurring: false,
      createdBy: userId,
    });
    console.log("  ✓ Creado");
  }

  // ── 4. COBRO Freelance Juan 16/05 — actualizar fecha ─────────────────────
  console.log("→ Actualizando fecha Freelance Juan → 16/05...");
  const freelanceTx = await Transaction.findOne({
    categoryId: cat.get("Freelance"),
    type: "income",
    amount: 600_000,
  });
  if (freelanceTx) {
    freelanceTx.date = d(16);
    freelanceTx.description = "COBRO Juan freelance";
    await freelanceTx.save();
    console.log("  ✓ Actualizado");
  } else {
    console.log("  ! No encontrado — creando...");
    await Transaction.create({
      date: d(16),
      amount: 600_000,
      type: "income",
      accountId: acc.get("MP - JUAN"),
      categoryId: cat.get("Freelance"),
      description: "COBRO Juan freelance",
      recurring: false,
      createdBy: userId,
    });
    console.log("  ✓ Creado");
  }

  // ── 5. COBRO Juli semana 1 — 15/05 ────────────────────────────────────────
  console.log("→ Creando COBRO Juli semana 1 15/05...");
  const juliS1Existing = await Transaction.findOne({
    amount: 675_000,
    type: "income",
    date: d(15),
  });
  if (juliS1Existing) {
    console.log("  ✓ Ya existe");
  } else {
    await Transaction.create({
      date: d(15),
      amount: 675_000,
      type: "income",
      accountId: acc.get("MP - JULI"),
      categoryId: cat.get("Instituto Juli"),
      description: "COBRO Instituto Juli — semana 1",
      recurring: false,
      createdBy: userId,
    });
    console.log("  ✓ Creado");
  }

  // ── 6. COBRO Juli semana 2 — 22/05 ────────────────────────────────────────
  console.log("→ Creando COBRO Juli semana 2 22/05...");
  const juliS2Existing = await Transaction.findOne({
    amount: 900_000,
    type: "income",
    date: d(22),
  });
  if (juliS2Existing) {
    console.log("  ✓ Ya existe");
  } else {
    await Transaction.create({
      date: d(22),
      amount: 900_000,
      type: "income",
      accountId: acc.get("MP - JULI"),
      categoryId: cat.get("Instituto Juli"),
      description: "COBRO Instituto Juli — semana 2",
      recurring: false,
      createdBy: userId,
    });
    console.log("  ✓ Creado");
  }

  console.log("\n✓ Calendario mayo actualizado.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("✗ Falló:", err);
  process.exit(1);
});
