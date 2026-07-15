import mongoose, { Document, Schema } from "mongoose";

export type BusinessVertical = "tailor" | "caterer" | "logistics" | "other";
export type OnboardingState = "awaiting_name" | "awaiting_vertical" | "awaiting_business_name" | "complete";

export interface IBusiness extends Document {
  phoneNumber: string;          // WhatsApp phone number (E.164)
  ownerName: string;
  businessName: string;
  vertical: BusinessVertical;
  onboardingState: OnboardingState;

  // Blaaiz
  blaaizCustomerId?: string;
  blaaizWalletId?: string;
  blaaizVirtualAccountNumber?: string;
  blaaizVirtualAccountBank?: string;

  createdAt: Date;
  updatedAt: Date;
}

const BusinessSchema = new Schema<IBusiness>(
  {
    phoneNumber: { type: String, required: true, unique: true, index: true },
    ownerName: { type: String, default: "" },
    businessName: { type: String, default: "" },
    vertical: { type: String, enum: ["tailor", "caterer", "logistics", "other"], default: "other" },
    onboardingState: {
      type: String,
      enum: ["awaiting_name", "awaiting_vertical", "awaiting_business_name", "complete"],
      default: "awaiting_name",
    },
    blaaizCustomerId: String,
    blaaizWalletId: String,
    blaaizVirtualAccountNumber: String,
    blaaizVirtualAccountBank: String,
  },
  { timestamps: true }
);

export const Business = mongoose.model<IBusiness>("Business", BusinessSchema);
