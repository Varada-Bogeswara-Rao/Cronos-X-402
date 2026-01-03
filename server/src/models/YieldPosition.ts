import { Schema, model, Document } from 'mongoose';

export interface IYieldPosition extends Document {
    merchantId: string;
    protocol: string; // e.g., "TECTONIC_USDC"
    status: "OPEN" | "CLOSED";

    /** Net Principal (Deposits - Withdrawals) in underlying asset units (USDC) */
    principalAmount: string;
    principalDecimals: number;

    /** Realized Interest (Interest claimed and withdrawn) */
    realizedInterest: string;
    lastActionAt?: Date;
    lastDecisionHash?: string;

    createdAt: Date;
    updatedAt: Date;
}

const YieldPositionSchema = new Schema({
    merchantId: { type: String, required: true, index: true },
    protocol: { type: String, required: true, index: true },
    status: { type: String, enum: ["OPEN", "CLOSED"], default: "OPEN" },

    principalAmount: { type: String, required: true, default: "0" },
    principalDecimals: { type: Number, required: true, default: 6 },
    realizedInterest: { type: String, required: true, default: "0" },
    lastActionAt: { type: Date },
    lastDecisionHash: { type: String, default: "" }
}, {
    timestamps: true
});

// Compound index: A merchant usually has one open position per protocol
YieldPositionSchema.index({ merchantId: 1, protocol: 1 }, { unique: true });

export default model<IYieldPosition>('YieldPosition', YieldPositionSchema);
