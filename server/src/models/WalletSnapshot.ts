import { Schema, model, Document } from 'mongoose';

export interface IWalletSnapshot extends Document {
    merchantId: string;
    usdcBalance: string;
    croBalance: string;
    timestamp: number;
    version: number;
}

const WalletSnapshotSchema = new Schema({
    merchantId: { type: String, required: true, index: true },
    usdcBalance: { type: String, required: true },
    croBalance: { type: String, required: true },
    timestamp: { type: Number, required: true, default: Date.now },
    version: { type: Number, default: 1 }
});

// Compound index for quick latest lookup
WalletSnapshotSchema.index({ merchantId: 1, timestamp: -1 });

export default model<IWalletSnapshot>('WalletSnapshot', WalletSnapshotSchema);
