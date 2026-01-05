
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

async function main() {
    await mongoose.connect(MONGO_URI);

    const positions = await YieldPosition.find({});

    for (const pos of positions) {
        const snap = await WalletSnapshot.findOne({ merchantId: pos.merchantId }).sort({ timestamp: -1 });

        if (snap) {
            const tUsdcBN = BigInt(snap.tUsdcBalance || "0");
            const rateBN = BigInt(snap.exchangeRate || "20000000000000000");
            const currentUnderlyingBN = (tUsdcBN * rateBN) / 1000000000000000000n;

            console.log(`Fixing for ${pos.merchantId}`);
            console.log(`Current Balance: ${ethers.formatUnits(currentUnderlyingBN, 6)} USDC`);

            if (currentUnderlyingBN > 0n) {
                pos.principalAmount = currentUnderlyingBN.toString();
                pos.status = "ACTIVE";
                await pos.save();
                console.log(`✅ Synced Principal.`);
            }
        }
    }
    process.exit(0);
}

main().catch(console.error);
