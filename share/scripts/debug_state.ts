
import mongoose from "mongoose";
import dotenv from "dotenv";
import { ethers } from "ethers";
import fs from "fs";

dotenv.config({ path: "server/.env" });

const MONGO_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/cronos-merchant-gateway";

const YieldPositionSchema = new mongoose.Schema({
    merchantId: { type: String, required: true },
    protocol: { type: String, required: true },
    status: { type: String },
    principalAmount: { type: String },
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
    let output = "--- SNAPSHOTS ---\n";

    const snaps = await WalletSnapshot.find({});
    for (const snap of snaps) {
        output += `Merchant: ${snap.merchantId}\n`;
        output += `   USDC: ${ethers.formatUnits(snap.usdcBalance || "0", 6)}\n`;
        output += `   tUSDC: ${snap.tUsdcBalance}\n`;
        output += `   Updated: ${snap.timestamp}\n`;
    }

    output += "\n--- POSITIONS ---\n";
    const pos = await YieldPosition.find({});
    for (const p of pos) {
        output += `Merchant: ${p.merchantId}\n`;
        output += `   Principal: ${p.principalAmount}\n`;
        output += `   Status: ${p.status}\n`;
    }

    fs.writeFileSync("share/debug_report.txt", output);
    console.log("Wrote report to share/debug_report.txt");
    process.exit(0);
}

main().catch(console.error);
