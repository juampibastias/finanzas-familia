import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { requireAuth, handleAuthError, handleError } from "@/lib/api-utils";
import { connectDB } from "@/lib/db";
import { Transaction } from "@/lib/models/Transaction";
import { Category } from "@/lib/models/Category";
import { buildDescription } from "@/lib/mp-api";
import { aiCategorize } from "@/lib/mp-categorize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface LeanTx {
  _id: Types.ObjectId;
  description: string;
  type: "income" | "expense";
  categoryId: Types.ObjectId;
  notes: string;
}
interface LeanCat { _id: Types.ObjectId; name: string; kind: string }

// Parse operation_type and poiType from the notes field stored during sync
// Format: "MP ID: 123 | op: money_transfer | poi: INSTORE"
function parseNotes(notes: string): { operationType: string; poiType: string | undefined } {
  const opMatch = /op: ([\w_]+)/.exec(notes);
  const poiMatch = /poi: (\w+)/.exec(notes);
  return {
    operationType: opMatch?.[1] ?? "regular_payment",
    poiType: poiMatch?.[1],
  };
}

export async function POST(): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    void userId; // only authenticated users can call this

    await connectDB();

    const categories = await Category.find().lean<LeanCat[]>();
    const defaultExpenseId = categories.find((c) => c.kind === "expense")?._id;
    const defaultIncomeId = categories.find((c) => c.kind === "income")?._id;
    if (!defaultExpenseId || !defaultIncomeId) {
      return NextResponse.json({ error: "Sin categorías" }, { status: 400 });
    }

    // Fetch all MP-imported transactions
    const txs = await Transaction.find({ externalRef: /^mp:/ })
      .select("description type categoryId notes")
      .lean<LeanTx[]>();

    let updated = 0;

    for (const tx of txs) {
      const { operationType, poiType } = parseNotes(tx.notes ?? "");

      // Rebuild description if it's still generic
      const betterDesc = buildDescription(tx.description, operationType, tx.type);

      const defaultId = tx.type === "income" ? defaultIncomeId : defaultExpenseId;
      const newCategoryId = await aiCategorize(
        betterDesc,
        operationType,
        poiType,
        tx.type,
        categories.map((c) => ({ _id: String(c._id), name: c.name, kind: c.kind })),
        String(defaultId),
      );

      const descChanged = betterDesc !== tx.description;
      const catChanged = newCategoryId !== String(tx.categoryId);

      if (descChanged || catChanged) {
        await Transaction.updateOne(
          { _id: tx._id },
          {
            ...(descChanged ? { description: betterDesc } : {}),
            ...(catChanged ? { categoryId: new Types.ObjectId(newCategoryId) } : {}),
          },
        );
        updated++;
      }
    }

    return NextResponse.json({ updated, total: txs.length });
  } catch (err) {
    return handleAuthError(err) ?? handleError(err);
  }
}
