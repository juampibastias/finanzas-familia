import mongoose, { Schema, type Model, type Document } from "mongoose";

export type AccountType = "card" | "bank" | "cash" | "wallet";
export type Bank =
  | "Francés"
  | "Galicia"
  | "Nación"
  | "MercadoPago"
  | "Otro"
  | null;

export interface IAccount extends Document {
  name: string;
  type: AccountType;
  bank: Bank;
  closingDay: number | null;
  dueDay: number | null;
  active: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const AccountSchema = new Schema<IAccount>(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["card", "bank", "cash", "wallet"],
      required: true,
    },
    bank: {
      type: String,
      enum: ["Francés", "Galicia", "Nación", "MercadoPago", "Otro", null],
      default: null,
    },
    closingDay: { type: Number, min: 1, max: 31, default: null },
    dueDay: { type: Number, min: 1, max: 31, default: null },
    active: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const Account: Model<IAccount> =
  (mongoose.models.Account as Model<IAccount>) ??
  mongoose.model<IAccount>("Account", AccountSchema);
