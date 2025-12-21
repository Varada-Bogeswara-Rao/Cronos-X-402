import mongoose, { Schema, Document } from 'mongoose';

export interface IMerchant extends Document {
    merchantId?: string;
    business: {
        name: string;
        description: string;
        contactEmail: string;
    };
    wallet: {
        address: string;
        network: 'cronos-mainnet' | 'cronos-testnet';
    };
    api: {
        baseUrl: string;
        routes: {
            method: 'GET' | 'POST' | 'PUT' | 'DELETE';
            path: string;
            price: string;
            currency: 'USDC' | 'CRO';
            description: string;
            active: boolean;
        }[];
    };
    limits: {
        maxRequestsPerMinute: number;
    };
    security: {
        ipWhitelist: string[];
        apiKeyHash?: string;
    };
    status: {
        active: boolean;
        suspended: boolean;
    };
    metadata: {
        createdAt: Date;
        updatedAt: Date;
    };
}

const MerchantSchema: Schema = new Schema({
    merchantId: {
        type: String,
        required: true,
        unique: true,
        index: true // ⚡️ Primary lookup key
    },
    business: {
        name: { type: String, required: true, trim: true },
        description: { type: String },
        contactEmail: { type: String, required: true, lowercase: true }
    },
    wallet: {
        address: {
            type: String,
            required: true,
            lowercase: true,
            index: true // ⚡️ High performance lookup for owner-based stats
        },
        network: { type: String, enum: ['cronos-mainnet', 'cronos-testnet'], default: 'cronos-testnet' }
    },
    api: {
        baseUrl: { type: String, required: true },
        routes: [{
            method: { type: String, enum: ['GET', 'POST', 'PUT', 'DELETE'], required: true },
            path: { type: String, required: true },
            price: { type: String, required: true },
            currency: { type: String, enum: ['USDC', 'CRO'], required: true },
            description: { type: String },
            active: { type: Boolean, default: true }
        }]
    },
    limits: {
        maxRequestsPerMinute: { type: Number, default: 60 }
    },
    security: {
        ipWhitelist: [{ type: String }],
        apiKeyHash: { type: String }
    },
    status: {
        active: { type: Boolean, default: true, index: true },
        suspended: { type: Boolean, default: false }
    }
}, {
    timestamps: true // ⚡️ Automatically manages createdAt and updatedAt
});

MerchantSchema.index({ "merchantId": 1, "api.routes.path": 1, "api.routes.method": 1 });

export default mongoose.model<IMerchant>('Merchant', MerchantSchema);