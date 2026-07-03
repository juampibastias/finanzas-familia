import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { MPConnection, type IMPConnection } from "@/lib/models/MPConnection";
import { Transaction } from "@/lib/models/Transaction";
import { Category } from "@/lib/models/Category";
import { Account } from "@/lib/models/Account";
import { mpGet, refreshToken, guessCategory, type MPPaymentSearchResult } from "@/lib/mp-api";

interface SyncResult {
  imported: number;
  skipped: number;
  errors: number;
}

async function ensureValidToken(conn: IMPConnection): Promise<string> {
  if (conn.expiresAt > new Date()) return conn.accessToken;
  if (!conn.refreshToken) throw new Error("No refresh token available");
  const tokens = await refreshToken(conn.refreshToken);
  conn.accessToken = tokens.access_token;
  conn.refreshToken = tokens.refresh_token;
  conn.expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  await (conn as IMPConnection & { save: () => Promise<void> }).save();
  return conn.accessToken;
}

interface LeanCategory { _id: Types.ObjectId; name: string; kind: string }
interface LeanAccount { _id: Types.ObjectId; createdBy?: Types.ObjectId }

async function findCategoryId(
  hint: string,
  kind: "income" | "expense",
  categories: LeanCategory[],
  defaultExpenseId: Types.ObjectId,
  defaultIncomeId: Types.ObjectId,
): Promise<Types.ObjectId> {
  const lower = hint.toLowerCase();
  const match = categories.find(
    (c) => c.kind === kind && c.name.toLowerCase().includes(lower),
  );
  if (match) return match._id;
  return kind === "income" ? defaultIncomeId : defaultExpenseId;
}

export async function syncMPConnection(connectionId: string, systemUserId: string): Promise<SyncResult> {
  await connectDB();

  const conn = await MPConnection.findById(connectionId);
  if (!conn || !conn.active) throw new Error("Conexión no encontrada");

  const accessToken = await ensureValidToken(conn);

  // Load categories and accounts
  const categories = await Category.find().lean<LeanCategory[]>();
  const account = await Account.findById(conn.linkedAccountId).lean<LeanAccount>();
  if (!account) throw new Error("Cuenta vinculada no encontrada");

  // Default categories (fallback)
  const defaultExpenseCat = categories.find((c) => c.kind === "expense");
  const defaultIncomeCat = categories.find((c) => c.kind === "income");
  if (!defaultExpenseCat || !defaultIncomeCat) throw new Error("No hay categorías configuradas");

  const defaultExpenseId = defaultExpenseCat._id;
  const defaultIncomeId = defaultIncomeCat._id;

  // Determine date range
  const fromDate = conn.lastSyncAt ?? conn.syncFromDate;
  const fromStr = fromDate.toISOString().replace("Z", ".000-00:00");
  const toStr = new Date().toISOString().replace("Z", ".000-00:00");

  const result: SyncResult = { imported: 0, skipped: 0, errors: 0 };
  let offset = 0;
  const pageSize = 50;

  while (true) {
    let data: MPPaymentSearchResult;
    try {
      data = await mpGet<MPPaymentSearchResult>("/v1/payments/search", accessToken, {
        sort: "date_created",
        criteria: "desc",
        begin_date: fromStr,
        end_date: toStr,
        limit: String(pageSize),
        offset: String(offset),
      });
    } catch {
      break;
    }

    if (!data.results || data.results.length === 0) break;

    for (const payment of data.results) {
      if (payment.status !== "approved") continue;
      const externalRef = `mp:${payment.id}`;

      const existing = await Transaction.findOne({ externalRef }).lean();
      if (existing) { result.skipped++; continue; }

      try {
        const isIncome = payment.collector_id === Number(conn.mpUserId);
        const txType: "income" | "expense" = isIncome ? "income" : "expense";
        const amount = Math.abs(payment.transaction_amount);
        const description = payment.description || (isIncome ? "Cobro MP" : "Pago MP");

        const guess = guessCategory(description);
        const effectiveKind = guess?.kind ?? txType;
        const effectiveHint = guess?.hint ?? "";

        const categoryId = await findCategoryId(
          effectiveHint,
          effectiveKind,
          categories,
          defaultExpenseId,
          defaultIncomeId,
        );

        const txDate = new Date(payment.date_approved ?? payment.date_created);

        await Transaction.create({
          date: txDate,
          amount,
          type: txType,
          accountId: conn.linkedAccountId,
          categoryId,
          description,
          notes: `Importado desde MercadoPago (ID: ${payment.id})`,
          externalRef,
          recurring: false,
          recurringMonth: null,
          installment: null,
          createdBy: new Types.ObjectId(systemUserId),
        });

        result.imported++;
      } catch {
        result.errors++;
      }
    }

    offset += pageSize;
    if (offset >= data.paging.total) break;
  }

  conn.lastSyncAt = new Date();
  await conn.save();

  return result;
}
