import mongoose, { Schema, type Model, type Document, type Types } from "mongoose";

export type CategoryKind = "income" | "expense";

export interface ICategory extends Document {
  name: string;
  kind: CategoryKind;
  fixed: boolean;
  color: string;
  icon: string;
  parentId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, trim: true },
    kind: { type: String, enum: ["income", "expense"], required: true, index: true },
    fixed: { type: Boolean, default: false },
    color: { type: String, default: "#6366f1" },
    icon: { type: String, default: "Circle" },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      index: true,
    },
  },
  { timestamps: true },
);

export const Category: Model<ICategory> =
  (mongoose.models.Category as Model<ICategory>) ??
  mongoose.model<ICategory>("Category", CategorySchema);
