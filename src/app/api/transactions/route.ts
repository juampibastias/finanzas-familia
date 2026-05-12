import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Transaction } from "@/lib/models/Transaction";
import { transactionSchema } from "@/lib/validations";
import { addMonths, toMonthKey } from "@/lib/format";
import { handleAuthError, handleError, jsonOk, requireAuth } from "@/lib/api-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  try {
    await requireAuth();
    await connectDB();

    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const accountId = url.searchParams.get("accountId");
    const categoryId = url.searchParams.get("categoryId");
    const type = url.searchParams.get("type");
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      200,
      Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10)),
    );

    const filter: Record<string, unknown> = {};
    if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) dateFilter.$gte = new Date(from + "T00:00:00.000Z");
      if (to) dateFilter.$lte = new Date(to + "T23:59:59.999Z");
      filter.date = dateFilter;
    }
    if (accountId && Types.ObjectId.isValid(accountId)) {
      filter.accountId = new Types.ObjectId(accountId);
    }
    if (categoryId && Types.ObjectId.isValid(categoryId)) {
      filter.categoryId = new Types.ObjectId(categoryId);
    }
    if (type && ["income", "expense", "transfer"].includes(type)) {
      filter.type = type;
    }

    const [items, total] = await Promise.all([
      Transaction.find(filter)
        .sort({ date: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("accountId", "name type")
        .populate("categoryId", "name kind color icon")
        .lean(),
      Transaction.countDocuments(filter),
    ]);

    return jsonOk({ items, total, page, limit });
  } catch (err) {
    return handleAuthError(err) ?? handleError(err);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const body = (await req.json()) as { generateInstallments?: boolean } & Record<string, unknown>;
    const generate = body.generateInstallments === true;
    const recurringMonths = typeof body.recurringMonths === "number" ? body.recurringMonths : 0;

    const data = transactionSchema.parse(body);
    await connectDB();

    const baseDate = data.date;
    const docs: Array<typeof data & { createdBy: Types.ObjectId; recurringMonth: string | null }> = [];

    if (generate && data.installment && data.installment.total > 1) {
      // Generar N cuotas: la actual + (total - current) futuras
      const remaining = data.installment.total - data.installment.current + 1;
      for (let i = 0; i < remaining; i++) {
        const cuotaIdx = data.installment.current + i;
        docs.push({
          ...data,
          date: addMonths(baseDate, i),
          installment: { current: cuotaIdx, total: data.installment.total },
          createdBy: new Types.ObjectId(userId),
          recurringMonth: null,
        });
      }
    } else if (data.recurring && recurringMonths > 0) {
      // 12 meses por default (o el N que pase el cliente)
      for (let i = 0; i < recurringMonths; i++) {
        const d = addMonths(baseDate, i);
        docs.push({
          ...data,
          date: d,
          recurringMonth: toMonthKey(d),
          createdBy: new Types.ObjectId(userId),
          installment: null,
        });
      }
    } else {
      docs.push({
        ...data,
        createdBy: new Types.ObjectId(userId),
        recurringMonth: data.recurring ? toMonthKey(baseDate) : null,
        installment: data.installment ?? null,
      });
    }

    const created = await Transaction.insertMany(docs);
    return jsonOk({ count: created.length, items: created }, 201);
  } catch (err) {
    return handleAuthError(err) ?? handleError(err);
  }
}
