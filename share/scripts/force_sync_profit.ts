
import mongoose from "mongoose";
import dotenv from "dotenv";
import { ethers } from "ethers";

dotenv.config({ path: "server/.env" });

const MONGO_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/cronos-merchant-gateway";

const YieldPositionSchema = new mongoose.Schema({
    merchantId: { type: String, required: true },
    protocol: { type: String, required: true },
    status: { type: String, enum: ['OPEN', 'ACTIVE', 'CLOSED'], default: 'OPEN' },
    principalAmount: { type: String, default: "0" }, // This is what we need to fix
    lastDecisionHash: { type: String },
    lastActionAt: { type: Date }
});
const YieldPosition = mongoose.models.YieldPosition || mongoose.model("YieldPosition", YieldPositionSchema);

const WalletSnapshotSchema = new mongoose.Schema({
    merchantId: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    croBalance: { type: String },
    usdcBalance: { type: String },
    tUsdcBalance: { type: String }, // tUSDC amount
    exchangeRate: { type: String }, // Exchange Rate
});
const WalletSnapshot = mongoose.models.WalletSnapshot || mongoose.model("WalletSnapshot", WalletSnapshotSchema);

async function main() {
    await mongoose.connect(MONGO_URI);

    // Find the most recent snapshot (likely the active user)
    const latestSnap = await WalletSnapshot.findOne({}).sort({ timestamp: -1 });

    if (!latestSnap) {
        console.log("❌ No snapshots found. Cannot sync.");
        process.exit(1);
    }

    const merchantId = latestSnap.merchantId;
    console.log(`🎯 Target Merchant: ${merchantId}`);
    console.log(`   tUSDC Balance: ${latestSnap.tUsdcBalance}`);

    // Calculate Real Underlying Value
    const tUsdcBN = BigInt(latestSnap.tUsdcBalance || "0");
    const rateBN = BigInt(latestSnap.exchangeRate || "20000000000000000"); // 0.02 fallback
    const currentUnderlyingBN = (tUsdcBN * rateBN) / 1000000000000000000n;

    console.log(`   Real Value (USDC): ${ethers.formatUnits(currentUnderlyingBN, 6)}`);

    if (currentUnderlyingBN === 0n) {
        console.log("⚠️ Balance is 0. Nothing to sync.");
        process.exit(0);
    }

    // Force Update Principal
    console.log(`💾 Updating Principal to ${currentUnderlyingBN.toString()}...`);

    await YieldPosition.findOneAndUpdate(
        { merchantId: merchantId, protocol: "TECTONIC_USDC" },
        {
            $set: {
                principalAmount: currentUnderlyingBN.toString(),
                status: "ACTIVE",
                lastActionAt: new Date()
            }
        },
        { upsert: true, new: true }
    );

    console.log("✅ Principal Synced. Net Profit should now be ~0.");
    process.exit(0);
}

main().catch(console.error);
