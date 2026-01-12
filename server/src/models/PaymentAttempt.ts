
import mongoose, { Schema, Document } from "mongoose";

export interface IPaymentAttempt extends Document {
    agentAddress: string;
    timestamp: Date;
    url: string;
    merchantId: string;
    amount: number;
    currency: string;
    decision: "APPROVED" | "BLOCKED";
    reason?: string;
    txHash?: string;
    chainId: number;
}

const PaymentAttemptSchema: Schema = new Schema({
    agentAddress: { type: String, required: true, index: true },
    timestamp: { type: Date, default: Date.now, index: true },
    url: { type: String, required: true },
    merchantId: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    decision: { type: String, enum: ["APPROVED", "BLOCKED"], required: true },
    reason: { type: String }, // e.g., "Daily limit exceeded"
    txHash: { type: String }, // Only if APPROVED
    chainId: { type: Number, required: true }
});

export default mongoose.model<IPaymentAttempt>("PaymentAttempt", PaymentAttemptSchema);
