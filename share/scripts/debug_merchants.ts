
import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config({ path: "server/.env" });

const MONGO_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/cronos-merchant-gateway";

const MerchantSchema = new mongoose.Schema({
    merchantId: String,
    wallet: {
        address: String
    }
}, { strict: false });
const Merchant = mongoose.models.Merchant || mongoose.model("Merchant", MerchantSchema);

async function main() {
    await mongoose.connect(MONGO_URI);
    let output = "--- MERCHANTS ---\n";

    const merchs = await Merchant.find({});
    for (const m of merchs) {
        output += `ID: ${m.merchantId} | Address: ${m.wallet?.address}\n`;
    }

    fs.writeFileSync("share/debug_merchants.txt", output);
    console.log("Wrote report to share/debug_merchants.txt");
    process.exit(0);
}

main().catch(console.error);
