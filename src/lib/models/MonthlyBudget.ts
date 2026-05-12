import mongoose, { Schema, type Model, type Document, type Types } from "mongoose";

export interface IMonthlyBudget extends Document {
  month: string; // YYYY-MM
  categoryId: Types.ObjectId;
  estimated: number;
  createdAt: Date;
  updatedAt: Date;
}

const MonthlyBudgetSchema = new Schema<IMonthlyBudget>(
  {
    month: { type: String, required: true, index: true },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    estimated: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

MonthlyBudgetSchema.index({ month: 1, categoryId: 1 }, { unique: true });

export const MonthlyBudget: Model<IMonthlyBudget> =
  (mongoose.models.MonthlyBudget as Model<IMonthlyBudget>) ??
  mongoose.model<IMonthlyBudget>("MonthlyBudget", MonthlyBudgetSchema);
