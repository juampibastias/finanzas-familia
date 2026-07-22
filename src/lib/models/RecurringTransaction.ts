import mongoose, { Schema, type Model, type Document, type Types } from "mongoose";

export interface IRecurringTransaction extends Document {
  description: string;
  amount: number;
  type: "income" | "expense";
  accountId: Types.ObjectId;
  categoryId: Types.ObjectId;
  dayOfMonth: number; // 1-28
  active: boolean;
  lastCreatedMonth: string | null; // "YYYY-MM" to avoid creating twice in same month
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const RecurringTransactionSchema = new Schema<IRecurringTransaction>(
  {
    description: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    type: { type: String, enum: ["income", "expense"], required: true },
    accountId: { type: Schema.Types.ObjectId, ref: "Account", required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    dayOfMonth: { type: Number, required: true, min: 1, max: 28 },
    active: { type: Boolean, default: true },
    lastCreatedMonth: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

export const RecurringTransaction: Model<IRecurringTransaction> =
  (mongoose.models.RecurringTransaction as Model<IRecurringTransaction>) ??
  mongoose.model<IRecurringTransaction>("RecurringTransaction", RecurringTransactionSchema);
