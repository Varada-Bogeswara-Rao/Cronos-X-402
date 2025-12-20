import mongoose, { Schema, Document } from 'mongoose';

export interface ITransaction extends Document {
    txHash: string;
    merchantId: string;
    payer: string;
    amount: string;
    currency: string;
    path: string;
    method: string;
    createdAt: Date;
}

const TransactionSchema: Schema = new Schema({
    txHash: {
        type: String,
        required: true,
        unique: true, // 🛡️ Replay Protection
        lowercase: true,
        index: true
    },
    merchantId: {
        type: String,
        required: true,
        index: true // 📈 Speeds up Dashboard Earnings queries
    },
    payer: { type: String, required: true, lowercase: true, index: true },
    amount: { type: String, required: true },
    currency: { type: String, required: true },
    path: { type: String, required: true },
    method: { type: String, required: true }
}, {
    timestamps: true // ⚡️ Track when sales happened automatically
});

// ⚡️ INDEX FOR REVENUE AGGREGATION
// This makes calculating "Total Revenue" for the merchant dashboard very fast
TransactionSchema.index({ merchantId: 1, createdAt: -1 });

export const Transaction = mongoose.model<ITransaction>('Transaction', TransactionSchema);
export default Transaction;