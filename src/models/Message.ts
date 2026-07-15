import mongoose, { Document, Schema } from "mongoose";

export type MessageRole = "user" | "assistant";

export interface IMessage extends Document {
  businessId: mongoose.Types.ObjectId;
  role: MessageRole;
  content: string;
  isVoice?: boolean;
  createdAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    isVoice: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Message = mongoose.model<IMessage>("Message", MessageSchema);
