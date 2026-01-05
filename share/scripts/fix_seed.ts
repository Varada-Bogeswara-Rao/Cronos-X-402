import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/cronos-merchant-gateway";
const TARGET_ADDRESS = "0xE1626123eD96D64D4d81F77c1045Bc2e37543024".toLowerCase();
const MERCHANT_ID = "fix_script_merchant_" + Date.now();

// Schemas (simplified)
const MerchantSchema = new mongoose.Schema({
    merchantId: String,
    wallet: {
        address: { type: String, lowercase: true },
        network: String
    },
    business: Object,
    api: Object,
    status: Object
}, { strict: false });
const Merchant = mongoose.model('Merchant', MerchantSchema);

const WalletSnapshotSchema = new mongoose.Schema({
    merchantId: String,
    timestamp: Number,
    usdcBalance: String,
    croBalance: String,
    tUsdcBalance: String,
    exchangeRate: String
}, { strict: false });
const WalletSnapshot = mongoose.model('WalletSnapshot', WalletSnapshotSchema);

async function main() {
    console.log("🔌 Connecting to DB...");
    await mongoose.connect(MONGO_URI);

    console.log(`🧹 Cleaning up old records for ${TARGET_ADDRESS}...`);
    // Find old merchant IDs for this address to clean up related data
    const oldMerchants = await Merchant.find({ "wallet.address": TARGET_ADDRESS });
    for (const m of oldMerchants) {
        console.log(`   - Removing old merchant: ${m.merchantId}`);
        await WalletSnapshot.deleteMany({ merchantId: m.merchantId });
    }
    await Merchant.deleteMany({ "wallet.address": TARGET_ADDRESS });

    console.log(`🆕 Creating fresh Merchant record...`);
    await Merchant.create({
        merchantId: MERCHANT_ID,
        wallet: {
            address: TARGET_ADDRESS,
            network: 'cronos-mainnet'
        },
        business: {
            name: "Fixed Demo Merchant",
            contactEmail: "fixed@demo.com"
        },
        api: {
            baseUrl: "https://api.fixed.com",
            routes: []
        },
        status: { active: true }
    });

    console.log(`💰 Seeding Balance Snapshot...`);
    await WalletSnapshot.create({
        merchantId: MERCHANT_ID,
        timestamp: Date.now(),
        usdcBalance: "12500000", // 12.50 USDC
        croBalance: "45000000000000000000", // 45.0 CRO
        tUsdcBalance: "0",
        exchangeRate: "20000000000000000" // 0.02
    });

    console.log("✅ FIX COMPLETE. Merchant ID:", MERCHANT_ID);
    console.log("👉 Please Refresh Frontend.");

    process.exit(0);
}

main().catch(console.error);
