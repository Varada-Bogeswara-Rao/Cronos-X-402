
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

async function main() {
    // 1. Connect to Mongo
    const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/cronos-merchant-gateway";
    const client = new MongoClient(mongoUri);
    await client.connect();

    const db = client.db();
    const collection = db.collection("walletsnapshots");

    // 2. Find latest snapshot
    const latest = await collection.findOne({}, { sort: { timestamp: -1 } });
    if (!latest) {
        console.error("❌ No snapshot found!");
        process.exit(1);
    }

    console.log("📝 Current Rate:", latest.exchangeRate);

    // 3. Hack the Rate (Increase by 0.5% = ~0.005)
    // Rate is string 1e18 scaled integer
    const currentRateBN = BigInt(latest.exchangeRate || "200000000000000000"); // fallback
    const boost = currentRateBN / 200n; // 0.5%
    const newRateBN = currentRateBN + boost;

    // Update
    await collection.updateOne(
        { _id: latest._id },
        { $set: { exchangeRate: newRateBN.toString() } }
    );

    console.log("✅ HACKED Rate:", newRateBN.toString());
    console.log("💰 Simulated Profit: ~0.5%");

    await client.close();
}

main().catch(console.error);
