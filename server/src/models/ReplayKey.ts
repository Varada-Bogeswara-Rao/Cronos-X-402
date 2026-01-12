import mongoose, { Schema, Document } from 'mongoose';

export interface IReplayKey extends Document {
    keyHash: string;
    txHash: string;
    createdAt: Date;
}

const ReplayKeySchema: Schema = new Schema({
    // keyHash = sha256(merchantId + method + path + nonce)
    keyHash: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    txHash: { type: String, required: true },
    expiresAt: {
        type: Date,
        default: Date.now,
        expires: '24h' // Automatically delete after 24 hours
    }
}, {
    timestamps: true
});

export default mongoose.model<IReplayKey>('ReplayKey', ReplayKeySchema);
