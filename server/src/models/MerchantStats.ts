import mongoose, { Schema, Document } from 'mongoose';

export interface IMerchantStats extends Document {
    merchantId: string;
    totalRevenue: {
        USDC: number;
        CRO: number;
    };
    totalRequests: number;
    lastActive: Date;
}

const MerchantStatsSchema: Schema = new Schema({
    merchantId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    totalRevenue: {
        USDC: { type: Number, default: 0 },
        CRO: { type: Number, default: 0 }
    },
    totalRequests: { type: Number, default: 0 },
    lastActive: { type: Date, default: Date.now }
});

export default mongoose.model<IMerchantStats>('MerchantStats', MerchantStatsSchema);
