import mongoose, { Schema, Document } from "mongoose";

export interface IYieldSource extends Document {
    id: string; // "AUTO_VVS"
    chainId: number; // 25
    vaultAddress: string;
    type: "AUTO_COMPOUND";
    status: "ACTIVE" | "INACTIVE";
    executable: boolean; // false for AutoVVS
    lastHarvestedAt: number; // timestamp in seconds
    pricePerShare: string; // RAW BigInt string
    realizedGrowth24h: string; // RAW BigInt string (from actual PPS growth)
    pendingRewards: string; // RAW BigInt string (unrealized)
    stakedAmount: string; // RAW BigInt string
    updatedAt: number;
}

const YieldSourceSchema: Schema = new Schema({
    id: { type: String, required: true, unique: true },
    chainId: { type: Number, required: true },
    vaultAddress: { type: String, required: true },
    type: { type: String, required: true, default: "AUTO_COMPOUND" },
    status: { type: String, required: true, enum: ["ACTIVE", "INACTIVE"] },
    executable: { type: Boolean, required: true, default: false },
    lastHarvestedAt: { type: Number, required: true },
    pricePerShare: { type: String, required: true },
    realizedGrowth24h: { type: String, required: true, default: "0" },
    pendingRewards: { type: String, required: true, default: "0" },
    stakedAmount: { type: String, required: true, default: "0" },
    updatedAt: { type: Number, required: true }
});

export const YieldSource = mongoose.model<IYieldSource>("YieldSource", YieldSourceSchema);
