
import { ethers } from "ethers";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const CTOKEN_ABI = ["function exchangeRateStored() view returns (uint)"];
const TUSDC_ADDR = "0xB3bbf1bE947b245Aef26e3B6a9D777d7703F4c8e";

async function main() {
    // 1. Get On-Chain Rate
    const rpcUrl = process.env.CRONOS_RPC_URL || "http://127.0.0.1:8545";
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const tUsdc = new ethers.Contract(TUSDC_ADDR, CTOKEN_ABI, provider);

    console.log("🔍 Fetching On-Chain Rate...");
    const rate = await tUsdc.exchangeRateStored();
    console.log("👉 Chain Rate:", rate.toString());

    // 2. Connect to Mongo
    const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/cronos-merchant-gateway";
    const client = new MongoClient(mongoUri);
    await client.connect();

    const db = client.db();
    const collection = db.collection("walletsnapshots");

    // 3. Update Latest Snapshot
    // Find latest
    const latest = await collection.findOne({}, { sort: { timestamp: -1 } });
    if (!latest) {
        console.error("❌ No snapshot found!");
        process.exit(1);
    }

    console.log("📝 DB Rate (Before):", latest.exchangeRate);

    // Update
    await collection.updateOne(
        { _id: latest._id },
        { $set: { exchangeRate: rate.toString() } }
    );

    console.log("✅ DB Updated with Rate:", rate.toString());

    await client.close();
}

main().catch(console.error);
