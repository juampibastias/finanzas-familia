import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { MPConnection, type IMPConnection } from "@/lib/models/MPConnection";
import { Transaction } from "@/lib/models/Transaction";
import { Category } from "@/lib/models/Category";
import { Account } from "@/lib/models/Account";
import { mpGet, refreshToken, buildDescription, type MPPaymentSearchResult } from "@/lib/mp-api";
import { aiCategorize } from "@/lib/mp-categorize";

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


export async function syncMPConnection(connectionId: string, systemUserId: string): Promise<SyncResult> {
  await connectDB();

  const conn = await MPConnection.findById(connectionId);
  if (!conn || !conn.active) throw new Error("Conexión no encontrada");

  const accessToken = await ensureValidToken(conn);

  const categories = await Category.find().lean<LeanCategory[]>();
  const account = await Account.findById(conn.linkedAccountId).lean<LeanAccount>();
  if (!account) throw new Error("Cuenta vinculada no encontrada");

  const defaultExpenseCat = categories.find((c) => c.kind === "expense");
  const defaultIncomeCat = categories.find((c) => c.kind === "income");
  if (!defaultExpenseCat || !defaultIncomeCat) throw new Error("No hay categorías configuradas");

  const defaultExpenseId = defaultExpenseCat._id;
  const defaultIncomeId = defaultIncomeCat._id;

  const fromDate = conn.lastSyncAt ?? conn.syncFromDate;
  const fromStr = fromDate.toISOString().replace("Z", "-00:00");
  const toStr = new Date().toISOString().replace("Z", "-00:00");

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
    } catch (err) {
      console.error("[mp-sync] payments/search error:", err);
      result.errors++;
      break;
    }

    if (!data.results || data.results.length === 0) break;

    for (const payment of data.results) {
      if (payment.status !== "approved") continue;
      const externalRef = `mp:${payment.id}`;

      const existing = await Transaction.findOne({ externalRef }).lean();
      if (existing) { result.skipped++; continue; }

      try {
        const mpUid = Number(conn.mpUserId);
        const isIncome = payment.collector_id === mpUid;
        if (!isIncome && payment.payer_id !== mpUid) { result.skipped++; continue; }
        const txType: "income" | "expense" = isIncome ? "income" : "expense";

        const amount = Math.abs(payment.transaction_amount);
        const poiType = payment.point_of_interaction?.type;

        // Build a meaningful description (replaces generic "Varios" etc.)
        const description = buildDescription(
          payment.description ?? "",
          payment.operation_type,
          txType,
        );

        // AI-powered categorization with keyword-rule shortcut
        const defaultId = txType === "income" ? defaultIncomeId : defaultExpenseId;
        const categoryId = await aiCategorize(
          description,
          payment.operation_type,
          poiType,
          txType,
          categories.map((c) => ({ _id: String(c._id), name: c.name, kind: c.kind })),
          String(defaultId),
        );

        const txDate = new Date(payment.date_approved ?? payment.date_created);

        await Transaction.create({
          date: txDate,
          amount,
          type: txType,
          accountId: conn.linkedAccountId,
          categoryId: new Types.ObjectId(categoryId),
          description,
          notes: `MP ID: ${payment.id} | op: ${payment.operation_type}${poiType ? ` | poi: ${poiType}` : ""}`,
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
