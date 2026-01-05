
import mongoose from "mongoose";
import dotenv from "dotenv";
import { ethers } from "ethers";

dotenv.config({ path: "server/.env" });

const MONGO_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/cronos-merchant-gateway";

const YieldPositionSchema = new mongoose.Schema({
    merchantId: { type: String, required: true },
    protocol: { type: String, required: true },
    status: { type: String, enum: ['OPEN', 'ACTIVE', 'CLOSED'], default: 'OPEN' },
    principalAmount: { type: String, default: "0" },
    lastDecisionHash: { type: String },
    lastActionAt: { type: Date }
});
const YieldPosition = mongoose.models.YieldPosition || mongoose.model("YieldPosition", YieldPositionSchema);

const WalletSnapshotSchema = new mongoose.Schema({
    merchantId: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    croBalance: { type: String },
    usdcBalance: { type: String },
    tUsdcBalance: { type: String },
    exchangeRate: { type: String },
});
const WalletSnapshot = mongoose.models.WalletSnapshot || mongoose.model("WalletSnapshot", WalletSnapshotSchema);

const MerchantSchema = new mongoose.Schema({
    merchantId: String
}, { strict: false });
const Merchant = mongoose.models.Merchant || mongoose.model("Merchant", MerchantSchema);

async function main() {
    await mongoose.connect(MONGO_URI);

    // 1. Get All Merchants
    const merchants = await Merchant.find({});

    for (const m of merchants) {
        console.log(`Processing Merchant: ${m.merchantId}`);

        // 2. Get Snapshot
        const snap = await WalletSnapshot.findOne({ merchantId: m.merchantId }).sort({ timestamp: -1 });

        if (snap) {
            // Calculate Current Value
            const tUsdcBN = BigInt(snap.tUsdcBalance || "0");
            const rateBN = BigInt(snap.exchangeRate || "20000000000000000");
            const currentUnderlyingBN = (tUsdcBN * rateBN) / 1000000000000000000n;

            console.log(`   Balance: ${ethers.formatUnits(currentUnderlyingBN, 6)} USDC`);

            if (currentUnderlyingBN > 0n) {
                // 3. UPSERT Position
                await YieldPosition.findOneAndUpdate(
                    { merchantId: m.merchantId, protocol: "TECTONIC_USDC" },
                    {
                        $set: {
                            status: "ACTIVE",
                            principalAmount: currentUnderlyingBN.toString(),
                            lastActionAt: new Date()
                        }
                    },
                    { upsert: true, new: true }
                );
                console.log(`   ✅ Synced Principal & Created Position.`);
            } else {
                console.log(`   No balance, skipping.`);
            }
        } else {
            console.log(`   No snapshot found.`);
        }
    }
    process.exit(0);
}

main().catch(console.error);
