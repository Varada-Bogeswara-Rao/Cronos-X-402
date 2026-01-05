
import mongoose from "mongoose";
import dotenv from "dotenv";
import readline from 'readline';

dotenv.config({ path: "server/.env" });

const MONGO_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/cronos-merchant-gateway";

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
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log("🧹 Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);

    rl.question("👉 Enter Target Wallet Address: ", async (addr) => {
        const TARGET_ADDRESS = addr.trim().toLowerCase();
        if (!TARGET_ADDRESS.startsWith('0x') || TARGET_ADDRESS.length !== 42) {
            console.error("❌ Invalid Address.");
            process.exit(1);
        }

        const MERCHANT_ID = "merchant_" + Date.now();

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
                name: "Fresh Start Merchant",
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

        console.log(`✅ RESET COMPLETE. Ready for Simulation.`);
        console.log(`🆔 New Merchant ID: ${MERCHANT_ID}`);
        console.log(`🔑 Wallet: ${TARGET_ADDRESS}`);
        console.log(`ℹ️  NEXT: Run 'npx hardhat run scripts/setup_dev_env.ts' to fund this wallet.`);

        process.exit(0);
    });
}

main().catch(console.error);
