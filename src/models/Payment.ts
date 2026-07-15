import mongoose, { Document, Schema } from "mongoose";

export type PaymentMethod = "cash" | "transfer" | "blaaiz" | "pos" | "other";
export type PaymentType = "deposit" | "balance" | "full" | "refund";

export interface IPayment extends Document {
  businessId: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  customerName: string;

  amount: number;
  currency: string;
  method: PaymentMethod;
  type: PaymentType;

  blaaizReference?: string;  // if collected via Blaaiz

  note?: string;
  createdAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    customerName: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "NGN" },
    method: {
      type: String,
      enum: ["cash", "transfer", "blaaiz", "pos", "other"],
      default: "cash",
    },
    type: {
      type: String,
      enum: ["deposit", "balance", "full", "refund"],
      required: true,
    },
    blaaizReference: String,
    note: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Payment = mongoose.model<IPayment>("Payment", PaymentSchema);
