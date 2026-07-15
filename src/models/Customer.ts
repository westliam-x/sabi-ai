import mongoose, { Document, Schema } from "mongoose";

export interface ICustomer extends Document {
  businessId: mongoose.Types.ObjectId;
  name: string;
  phoneNumber?: string;
  email?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    name: { type: String, required: true },
    phoneNumber: String,
    email: String,
    notes: String,
  },
  { timestamps: true }
);

export const Customer = mongoose.model<ICustomer>("Customer", CustomerSchema);
