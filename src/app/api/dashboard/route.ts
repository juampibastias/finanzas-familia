import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Account } from "@/lib/models/Account";
import { Transaction } from "@/lib/models/Transaction";
import { Debt } from "@/lib/models/Debt";
import { Category } from "@/lib/models/Category";
import {
  addMonths,
  endOfMonthUTC,
  startOfMonthUTC,
  toMonthKey,
} from "@/lib/format";
import { handleAuthError, handleError, jsonOk, requireAuth } from "@/lib/api-utils";

export const runtime = "nodejs";

interface AggResult {
  _id: Types.ObjectId;
  total: number;
}

export async function GET(): Promise<Response> {
  try {
    await requireAuth();
    await connectDB();

    const now = new Date();
    const monthStart = startOfMonthUTC(now);
    const monthEnd = endOfMonthUTC(now);
    const in14 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    // Saldo cuentas no-card activas (placeholder: usamos 0; no llevamos saldo per-cuenta porque
    // no hay schema de balance — usamos suma de ingresos - egresos por cuenta en su histórico).
    const accounts = await Account.find({ active: true }).lean();
    const nonCardAccountIds = accounts
      .filter((a) => a.type !== "card")
      .map((a) => a._id);

    const balanceAgg = await Transaction.aggregate<AggResult>([
      { $match: { accountId: { $in: nonCardAccountIds } } },
      {
        $group: {
          _id: "$accountId",
          total: {
            $sum: {
              $cond: [
                { $eq: ["$type", "income"] },
                "$amount",
                { $multiply: ["$amount", -1] },
              ],
            },
          },
        },
      },
    ]);
    const totalBalance = balanceAgg.reduce((s, r) => s + r.total, 0);

    // A pagar próximas 2 semanas
    const upcomingDebts = await Debt.find({
      paid: false,
      dueDate: { $lte: in14 },
    })
      .sort({ dueDate: 1 })
      .lean();
    const upcomingDebtsAmount = upcomingDebts.reduce((s, d) => s + d.amount, 0);

    // Cashflow del mes actual
    const monthAgg = await Transaction.aggregate<{ _id: string; total: number }>([
      { $match: { date: { $gte: monthStart, $lte: monthEnd } } },
      { $group: { _id: "$type", total: { $sum: "$amount" } } },
    ]);
    const monthIncome = monthAgg.find((r) => r._id === "income")?.total ?? 0;
    const monthExpense = monthAgg.find((r) => r._id === "expense")?.total ?? 0;
    const monthNet = monthIncome - monthExpense;

    // Total tarjetas a pagar este mes — sum de Transactions por cuenta tipo card
    const cardIds = accounts.filter((a) => a.type === "card").map((a) => a._id);
    const cardsAgg = await Transaction.aggregate<AggResult>([
      {
        $match: {
          accountId: { $in: cardIds },
          date: { $gte: monthStart, $lte: monthEnd },
          type: "expense",
        },
      },
      { $group: { _id: "$accountId", total: { $sum: "$amount" } } },
    ]);
    const cardsBreakdown = accounts
      .filter((a) => a.type === "card")
      .map((a) => {
        const found = cardsAgg.find((r) => r._id.toString() === a._id.toString());
        return {
          accountId: a._id.toString(),
          name: a.name,
          total: found?.total ?? 0,
        };
      })
      .filter((c) => c.total > 0);
    const totalCards = cardsBreakdown.reduce((s, c) => s + c.total, 0);

    // Gastos por categoría del mes actual
    const byCategoryAgg = await Transaction.aggregate<AggResult>([
      {
        $match: {
          date: { $gte: monthStart, $lte: monthEnd },
          type: "expense",
        },
      },
      { $group: { _id: "$categoryId", total: { $sum: "$amount" } } },
      { $sort: { total: -1 } },
    ]);
    const categories = await Category.find({
      _id: { $in: byCategoryAgg.map((r) => r._id) },
    }).lean();
    const expenseByCategory = byCategoryAgg.map((r) => {
      const cat = categories.find((c) => c._id.toString() === r._id.toString());
      return {
        categoryId: r._id.toString(),
        name: cat?.name ?? "Sin categoría",
        color: cat?.color ?? "#9ca3af",
        total: r.total,
      };
    });

    // Cashflow últimos 6 meses (incluido el actual)
    const cashflowSeries: Array<{ month: string; income: number; expense: number; net: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const ref = addMonths(now, -i);
      const start = startOfMonthUTC(ref);
      const end = endOfMonthUTC(ref);
      const agg = await Transaction.aggregate<{ _id: string; total: number }>([
        { $match: { date: { $gte: start, $lte: end } } },
        { $group: { _id: "$type", total: { $sum: "$amount" } } },
      ]);
      const income = agg.find((r) => r._id === "income")?.total ?? 0;
      const expense = agg.find((r) => r._id === "expense")?.total ?? 0;
      cashflowSeries.push({
        month: toMonthKey(ref),
        income,
        expense,
        net: income - expense,
      });
    }

    // Top 10 próximas debts
    const nextDebts = await Debt.find({ paid: false })
      .sort({ dueDate: 1 })
      .limit(10)
      .lean();

    return jsonOk({
      totalBalance,
      upcomingDebtsAmount,
      upcomingDebts: upcomingDebts.slice(0, 10),
      monthIncome,
      monthExpense,
      monthNet,
      totalCards,
      cardsBreakdown,
      expenseByCategory,
      cashflowSeries,
      nextDebts,
    });
  } catch (err) {
    return handleAuthError(err) ?? handleError(err);
  }
}
