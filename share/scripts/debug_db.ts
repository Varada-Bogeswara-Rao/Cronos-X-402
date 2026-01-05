import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/cronos-merchant-gateway";

const MerchantSchema = new mongoose.Schema({
    merchantId: String,
    wallet: {
        address: String
    }
}, { strict: false });

const Merchant = mongoose.model('Merchant', MerchantSchema);

async function main() {
    console.log("🔌 Connecting to:", MONGO_URI);
    await mongoose.connect(MONGO_URI);

    console.log("🔍 Listing ALL Merchants:");
    const merchants = await Merchant.find({});
    console.log(JSON.stringify(merchants, null, 2));

    if (merchants.length === 0) {
        console.log("⚠️ No merchants found. Seeding failed or DB mismatch.");
    }

    process.exit(0);
}

main().catch(console.error);
