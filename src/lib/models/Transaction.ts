import mongoose, { Schema, type Model, type Document, type Types } from "mongoose";

export type TransactionType = "income" | "expense" | "transfer";

export interface IInstallment {
  current: number;
  total: number;
}

export interface ITransaction extends Document {
  date: Date;
  amount: number;
  type: TransactionType;
  accountId: Types.ObjectId;
  categoryId: Types.ObjectId;
  description: string;
  installment: IInstallment | null;
  recurring: boolean;
  recurringMonth: string | null;
  notes: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const InstallmentSchema = new Schema<IInstallment>(
  {
    current: { type: Number, required: true, min: 1 },
    total: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const TransactionSchema = new Schema<ITransaction>(
  {
    date: { type: Date, required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    type: {
      type: String,
      enum: ["income", "expense", "transfer"],
      required: true,
      index: true,
    },
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      index: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    description: { type: String, default: "", trim: true },
    installment: { type: InstallmentSchema, default: null },
    recurring: { type: Boolean, default: false },
    recurringMonth: { type: String, default: null }, // YYYY-MM
    notes: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

TransactionSchema.index({ date: -1, accountId: 1 });
TransactionSchema.index({ date: -1, categoryId: 1 });

export const Transaction: Model<ITransaction> =
  (mongoose.models.Transaction as Model<ITransaction>) ??
  mongoose.model<ITransaction>("Transaction", TransactionSchema);
