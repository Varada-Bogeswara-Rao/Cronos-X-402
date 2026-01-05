
import mongoose from "mongoose";
import dotenv from "dotenv";
import { ethers } from "ethers";

dotenv.config({ path: "server/.env" });

const MONGO_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/cronos-merchant-gateway";

// --- INLINE SCHEMAS TO AVOID PATH HELL ---

const YieldPositionSchema = new mongoose.Schema({
    merchantId: { type: String, required: true },
    protocol: { type: String, required: true },
    status: { type: String, enum: ['OPEN', 'ACTIVE', 'CLOSED'], default: 'OPEN' },
    principalAmount: { type: String, default: "0" },
    lastDecisionHash: { type: String },
    lastActionAt: { type: Date }
});
// Use existing model if defined or compile new
const YieldPosition = mongoose.models.YieldPosition || mongoose.model("YieldPosition", YieldPositionSchema);

// ------------------------------------------

async function main() {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Brute Force Fix
    const positions = await YieldPosition.find({});
    for (const pos of positions) {
        if (pos.status === "ACTIVE" && pos.principalAmount === "0") {
            console.log(`Force Fixing ${pos.merchantId}`);
            pos.principalAmount = "9980000000"; // $9980 * 1e6
            await pos.save();
            console.log("Fixed.");
        }
    }

    console.log("Done.");
    process.exit(0);
}

main().catch(console.error);
