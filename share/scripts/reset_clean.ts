
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config({ path: "server/.env" });

const MONGO_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/cronos-merchant-gateway";
const TARGET_ADDRESS = "0xE1626123eD96D64D4d81F77c1045Bc2e37543024".toLowerCase();
const MERCHANT_ID = "merchant_" + Date.now();

// --- SCHEMAS ---
const MerchantSchema = new mongoose.Schema({}, { strict: false });
const Merchant = mongoose.models.Merchant || mongoose.model("Merchant", MerchantSchema);

const WalletSnapshotSchema = new mongoose.Schema({}, { strict: false });
const WalletSnapshot = mongoose.models.WalletSnapshot || mongoose.model("WalletSnapshot", WalletSnapshotSchema);

const YieldPositionSchema = new mongoose.Schema({}, { strict: false });
const YieldPosition = mongoose.models.YieldPosition || mongoose.model("YieldPosition", YieldPositionSchema);

const YieldDecisionSchema = new mongoose.Schema({}, { strict: false });
const YieldDecision = mongoose.models.YieldDecision || mongoose.model("YieldDecision", YieldDecisionSchema);

async function main() {
    console.log("🧹 Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);

    console.log("🔥 DROPPING ALL COLLECTIONS...");
    await Merchant.deleteMany({});
    await WalletSnapshot.deleteMany({});
    await YieldPosition.deleteMany({});
    await YieldDecision.deleteMany({});
    console.log("✅ Database Wiped.");

    console.log(`🌱 Seeding Single Merchant for ${TARGET_ADDRESS}...`);

    // 1. Create Merchant
    await Merchant.create({
        merchantId: MERCHANT_ID,
        wallet: {
            address: TARGET_ADDRESS,
            network: 'cronos-mainnet'
        },
        business: {
            name: "Clean Slate Merchant",
            contactEmail: "admin@cronas.com"
        },
        api: { baseUrl: "http://localhost:3000", routes: [] },
        status: { active: true }
    });

    // 2. Create Initial Snapshot (Zeroed - Watcher will update)
    await WalletSnapshot.create({
        merchantId: MERCHANT_ID,
        timestamp: Date.now(),
        usdcBalance: "0",
        croBalance: "0",
        tUsdcBalance: "0",
        exchangeRate: "0"
    });

    // 3. Create Yield Position (Initialized to avoid 100% profit bug)
    // Actually, let's NOT create one. Let the engine handle it or create if needed.
    // The ProfitEngine logic checks: if (!position) ... mock it.
    // BUT if we want to track principal correctly from the start, we should probably modify NO principal until they invest.

    console.log(`✅ RESET COMPLETE.`);
    console.log(`🆔 New Merchant ID: ${MERCHANT_ID}`);
    console.log(`🔑 Wallet: ${TARGET_ADDRESS}`);

    process.exit(0);
}

main().catch(console.error);
