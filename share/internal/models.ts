import { Schema, model, Document } from "mongoose";

interface IAgentWalletState extends Document {
    address: string;
    lastResetDate: string;
    spentToday: number;
    paidRequests: Map<string, number>;
}

const AgentWalletStateSchema = new Schema<IAgentWalletState>({
    address: { type: String, required: true, unique: true },
    lastResetDate: { type: String, required: true },
    spentToday: { type: Number, required: true, default: 0 },
    paidRequests: {
        type: Map,
        of: Number,
        default: new Map()
    }
});

export const AgentWalletModel = model<IAgentWalletState>("AgentWalletState", AgentWalletStateSchema);
