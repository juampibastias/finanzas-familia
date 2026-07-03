import mongoose, { Schema, type Model, type Document, type Types } from "mongoose";

export interface IMPConnection extends Document {
  userId: Types.ObjectId;
  mpUserId: string;
  mpNickname: string;
  mpEmail: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  linkedAccountId: Types.ObjectId;
  lastSyncAt: Date | null;
  syncFromDate: Date;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MPConnectionSchema = new Schema<IMPConnection>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    mpUserId: { type: String, required: true },
    mpNickname: { type: String, default: "" },
    mpEmail: { type: String, default: "" },
    accessToken: { type: String, required: true },
    refreshToken: { type: String, default: "" },
    expiresAt: { type: Date, required: true },
    linkedAccountId: { type: Schema.Types.ObjectId, ref: "Account", required: true },
    lastSyncAt: { type: Date, default: null },
    syncFromDate: { type: Date, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

MPConnectionSchema.index({ userId: 1, mpUserId: 1 }, { unique: true });

export const MPConnection: Model<IMPConnection> =
  (mongoose.models.MPConnection as Model<IMPConnection>) ??
  mongoose.model<IMPConnection>("MPConnection", MPConnectionSchema);
