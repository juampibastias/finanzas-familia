import mongoose, { Schema, type Model, type Document } from "mongoose";

export type DebtPriority = "high" | "medium" | "low";

export interface IDebt extends Document {
  name: string;
  amount: number;
  dueDate: Date;
  paid: boolean;
  paidDate: Date | null;
  priority: DebtPriority;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const DebtSchema = new Schema<IDebt>(
  {
    name: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    dueDate: { type: Date, required: true, index: true },
    paid: { type: Boolean, default: false, index: true },
    paidDate: { type: Date, default: null },
    priority: {
      type: String,
      enum: ["high", "medium", "low"],
      default: "medium",
    },
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

export const Debt: Model<IDebt> =
  (mongoose.models.Debt as Model<IDebt>) ??
  mongoose.model<IDebt>("Debt", DebtSchema);
