import mongoose, { Document, Schema } from "mongoose";

export type OrderStatus = "pending" | "in_progress" | "ready" | "delivered" | "cancelled";

export interface IOrder extends Document {
  businessId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  customerName: string;           // denormalized for quick display

  // Tailor-specific (optional for other verticals)
  description: string;            // "2 native, 1 kaftan"
  measurements?: string;          // free-text measurements note
  fabric?: string;                // "ankara from customer" / "satin"

  totalAmount: number;            // in NGN
  depositPaid: number;            // amount paid so far
  balanceDue: number;             // totalAmount - depositPaid

  status: OrderStatus;
  deliveryDate?: Date;
  deliveredAt?: Date;

  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OrderSchema = new Schema<IOrder>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    customerName: { type: String, required: true },
    description: { type: String, required: true },
    measurements: String,
    fabric: String,
    totalAmount: { type: Number, required: true, min: 0 },
    depositPaid: { type: Number, default: 0, min: 0 },
    balanceDue: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["pending", "in_progress", "ready", "delivered", "cancelled"],
      default: "pending",
    },
    deliveryDate: Date,
    deliveredAt: Date,
    notes: String,
  },
  { timestamps: true }
);

// Auto-compute balance before save
OrderSchema.pre("save", function () {
  this.balanceDue = Math.max(0, this.totalAmount - this.depositPaid);
});

export const Order = mongoose.model<IOrder>("Order", OrderSchema);
