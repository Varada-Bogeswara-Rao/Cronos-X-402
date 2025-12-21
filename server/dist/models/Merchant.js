"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const MerchantSchema = new mongoose_1.Schema({
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
exports.default = mongoose_1.default.model('Merchant', MerchantSchema);
