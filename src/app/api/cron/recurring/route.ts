import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { RecurringTransaction } from "@/lib/models/RecurringTransaction";
import { Transaction } from "@/lib/models/Transaction";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request): Promise<Response> {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const now = new Date();
  // Argentina is UTC-3, adjust day accordingly
  const argNow = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const todayDay = argNow.getUTCDate();
  const currentMonth = `${argNow.getUTCFullYear()}-${String(argNow.getUTCMonth() + 1).padStart(2, "0")}`;

  // Find active recurring transactions due today that haven't been created this month
  const due = await RecurringTransaction.find({
    active: true,
    dayOfMonth: todayDay,
    lastCreatedMonth: { $ne: currentMonth },
  }).lean();

  let created = 0;
  for (const rec of due) {
    try {
      await Transaction.create({
        date: now,
        amount: rec.amount,
        type: rec.type,
        accountId: rec.accountId,
        categoryId: rec.categoryId,
        description: rec.description,
        notes: "Creado automáticamente (recurrente)",
        externalRef: null,
        recurring: true,
        recurringMonth: currentMonth,
        installment: null,
        createdBy: rec.createdBy,
      });

      await RecurringTransaction.updateOne(
        { _id: rec._id },
        { lastCreatedMonth: currentMonth },
      );
      created++;
    } catch {
      // continue with others
    }
  }

  return NextResponse.json({ ok: true, created, due: due.length, month: currentMonth });
}
