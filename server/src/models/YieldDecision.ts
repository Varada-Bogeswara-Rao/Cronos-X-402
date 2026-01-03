import { Schema, model, Document } from 'mongoose';

export interface IYieldDecision extends Document {
    agentAddress: string;
    vaultAddress: string;
    chainId: number;

    decision: "APPROVE" | "DENY" | "HOLD" | "PARTIAL_WITHDRAW" | "EMERGENCY_EXIT" | "FORCE_GAS_REFILL";
    amount: string;     // bigint as string
    minAmountOut: string; // bigint as string (Slippage protection)

    scope: "YIELD_ONLY"; // Domain separation

    reason: string;

    nonce: string;
    issuedAt: number;
    expiresAt: number;

    signature: string; // facilitator signature

    // Status tracking (Facilitator view)
    status: "CREATED" | "DISPATCHED" | "EXECUTED" | "FAILED";
    txHash?: string;
    executionError?: string;
}

// Export the Type for Shared Usage
export type YieldDecision = {
    agentAddress: string;
    vaultAddress: string;
    chainId: number;
    decision: "APPROVE" | "DENY" | "HOLD" | "PARTIAL_WITHDRAW" | "EMERGENCY_EXIT" | "FORCE_GAS_REFILL";
    amount?: string;
    minAmountOut?: string;
    scope: "YIELD_ONLY";
    reason?: string;
    nonce: string;
    issuedAt: number;
    expiresAt: number;
    signature?: string;
};

const YieldDecisionSchema = new Schema({
    agentAddress: { type: String, required: true },
    vaultAddress: { type: String, required: true },
    chainId: { type: Number, required: true },

    decision: {
        type: String,
        required: true,
        enum: ["APPROVE", "DENY", "HOLD", "PARTIAL_WITHDRAW", "EMERGENCY_EXIT", "FORCE_GAS_REFILL"]
    },
    amount: { type: String, default: "0" },
    minAmountOut: { type: String, default: "0" },

    scope: { type: String, required: true, default: "YIELD_ONLY" },
    reason: { type: String, default: "" },

    nonce: { type: String, required: true, unique: true },
    issuedAt: { type: Number, required: true },
    expiresAt: { type: Number, required: true },

    signature: { type: String, required: true },

    status: {
        type: String,
        enum: ["CREATED", "DISPATCHED", "EXECUTED", "FAILED"],
        default: "CREATED"
    },
    txHash: { type: String },
    executionError: { type: String }
});

export default model<IYieldDecision>('YieldDecision', YieldDecisionSchema);
