import { connectDB } from "@/lib/db";
import { Account } from "@/lib/models/Account";
import { Category } from "@/lib/models/Category";
import { Transaction } from "@/lib/models/Transaction";
import { Debt } from "@/lib/models/Debt";
import { MonthlyBudget } from "@/lib/models/MonthlyBudget";
import { handleAuthError, handleError, requireAuth } from "@/lib/api-utils";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    await requireAuth();
    await connectDB();
    const [accounts, categories, transactions, debts, budgets] = await Promise.all([
      Account.find().lean(),
      Category.find().lean(),
      Transaction.find().lean(),
      Debt.find().lean(),
      MonthlyBudget.find().lean(),
    ]);
    const payload = {
      exportedAt: new Date().toISOString(),
      version: 1,
      accounts,
      categories,
      transactions,
      debts,
      budgets,
    };
    const filename = `backup-finanzas-${new Date().toISOString().slice(0, 10)}.json`;
    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return handleAuthError(err) ?? handleError(err);
  }
}
