
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
    let output = "--- DIAGNOSTIC REPORT ---\n";

    const snaps = await WalletSnapshot.find({});
    for (const snap of snaps) {
        output += `Merchant: ${snap.merchantId}\n`;
        output += `   tUSDC Balance: ${snap.tUsdcBalance}\n`;
        output += `   Exchange Rate: ${snap.exchangeRate}\n`;

        // Find Position
        const pos = await YieldPosition.findOne({ merchantId: snap.merchantId });
        output += `   Position Data:\n`;
        if (pos) {
            output += `      Principal: ${pos.principalAmount} (Type: ${typeof pos.principalAmount})\n`;
            output += `      Status: ${pos.status}\n`;
        } else {
            output += `      [NO POSITION FOUND]\n`;
        }
        output += "--------------------------\n";
    }

    fs.writeFileSync("share/diag_report.txt", output);
    console.log("Report written.");
    process.exit(0);
}

main().catch(console.error);
