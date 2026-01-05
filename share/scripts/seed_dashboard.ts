import mongoose from 'mongoose';
import dotenv from 'dotenv';
import readline from 'readline';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/cronos-merchant-gateway";

// --- INLINE MODEL DEFINITIONS (To avoid Mongoose Instance Mismatch) ---

// 1. Merchant Model
const MerchantSchema = new mongoose.Schema({
    merchantId: { type: String, required: true, unique: true },
    business: {
        name: { type: String },
        description: { type: String },
        contactEmail: { type: String }
    },
    wallet: {
        address: { type: String, required: true, lowercase: true, index: true },
        network: { type: String, default: 'cronos-mainnet' }
    },
    api: {
        baseUrl: { type: String },
        routes: [{ type: Object }] // Simplified for seeding
    },
    status: {
        active: { type: Boolean, default: true }
    }
}, { timestamps: true, bufferCommands: false }); // Disable buffering to fail fast if no connection
const Merchant = mongoose.models.Merchant || mongoose.model('Merchant', MerchantSchema);

// 2. Wallet Snapshot Model
const WalletSnapshotSchema = new mongoose.Schema({
    merchantId: { type: String, required: true, index: true },
    timestamp: { type: Number, required: true, index: true },
    usdcBalance: { type: String, required: true },
    croBalance: { type: String, required: true },
    tUsdcBalance: { type: String, required: true }
});
const WalletSnapshot = mongoose.models.WalletSnapshot || mongoose.model('WalletSnapshot', WalletSnapshotSchema);

// 3. Yield Position Model
const YieldPositionSchema = new mongoose.Schema({
    merchantId: { type: String, required: true, unique: true },
    protocol: { type: String, required: true },
    status: { type: String, required: true },
    principalAmount: { type: String, required: true },
    principalDecimals: { type: Number, default: 6 },
    lastHarvestDate: { type: Date },
    lastDecisionHash: { type: String }
}, { timestamps: true });
const YieldPosition = mongoose.models.YieldPosition || mongoose.model('YieldPosition', YieldPositionSchema);

// 4. Yield Decision Model
const YieldDecisionSchema = new mongoose.Schema({
    agentAddress: { type: String },
    vaultAddress: { type: String },
    chainId: { type: Number },
    decision: { type: String },
    amount: { type: String },
    reason: { type: String },
    nonce: { type: String },
    issuedAt: { type: Number },
    expiresAt: { type: Number },
    signature: { type: String },
    status: { type: String },
    txHash: { type: String },
    metadata: { type: Object }
}, { timestamps: true });
const YieldDecision = mongoose.models.YieldDecision || mongoose.model('YieldDecision', YieldDecisionSchema);

async function main() {
    console.log("🔌 Connecting to MongoDB...");
    try {
        await mongoose.connect(MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
            family: 4 // Force IPv4
        });
        console.log("✅ Connected:", mongoose.connection.host);
    } catch (err) {
        console.error("❌ Connection Failed:", err);
        process.exit(1);
    }

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    // 1. Ask for Wallet Address (simulating user login)
    rl.question("👉 Enter your connected Wallet Address (or Merchant ID): ", async (input) => {
        let merchantId = input.trim();
        let walletAddress = input.trim();

        // Check if input is address or ID (simple check: length or 0x)
        const isAddress = input.startsWith("0x");

        if (isAddress) {
            console.log(`🔍 Looking up Merchant for address: ${walletAddress}...`);
            const merchant = await Merchant.findOne({ 'wallet.address': new RegExp(walletAddress, 'i') });
            if (!merchant) {
                console.log("❌ Merchant not found! Creating a temporary Mock Merchant...");
                merchantId = `mock_merchant_${uuidv4().substring(0, 8)}`;
                await Merchant.create({
                    merchantId: merchantId,
                    wallet: {
                        address: walletAddress.toLowerCase(),
                        network: 'cronos-mainnet'
                    },
                    business: {
                        name: "Demo Merchant",
                        description: "Automated Seed",
                        contactEmail: "demo@example.com"
                    },
                    api: {
                        baseUrl: "https://api.demo.com",
                        routes: []
                    },
                    status: { active: true }
                });
                console.log(`✅ Created Mock Merchant ID: ${merchantId}`);
            } else {
                merchantId = merchant.get('merchantId') || merchant._id.toString();
                console.log(`✅ Found Merchant ID: ${merchantId}`);
            }
        } else {
            console.log(`ℹ️ Assuming input is Merchant ID: ${merchantId}`);
        }

        // 2. Seed WalletSnapshot (Balances)
        console.log("🌱 Seeding Wallet Snapshot...");
        // Clear old ones for cleanliness
        await WalletSnapshot.deleteMany({ merchantId });
        await WalletSnapshot.create({
            merchantId,
            timestamp: Date.now(),
            usdcBalance: "12500000", // 12.50 USDC
            croBalance: "45000000000000000000", // 45.0 CRO
            tUsdcBalance: "500000000000" // 5000 tTokens 
        });

        // 3. Seed Yield Position (Profit Logic)
        console.log("🌱 Seeding Yield Position...");
        await YieldPosition.findOneAndUpdate(
            { merchantId },
            {
                merchantId,
                protocol: "TECTONIC_USDC",
                status: "ACTIVE",
                principalAmount: "100000000", // 100 USDC Principal
                principalDecimals: 6,
                lastHarvestDate: new Date(),
                lastDecisionHash: "0xseed"
            },
            { upsert: true }
        );

        // 4. Seed Decision History
        console.log("🌱 Seeding Decision Log...");
        await YieldDecision.deleteMany({ 'metadata.merchantId': merchantId }); // Assuming relation
        // Actually schema above doesn't have merchantId directly on root, usually in metadata or inferred.
        // But for dashboard display, we just push some executed decisions.
        await YieldDecision.create([
            {
                agentAddress: "0xAgent",
                vaultAddress: "0xVault",
                chainId: 25,
                decision: "APPROVE",
                amount: "10000000", // 10 USDC
                reason: "Surplus funds > 10 USDC. Investing.",
                nonce: uuidv4(),
                issuedAt: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
                expiresAt: Math.floor(Date.now() / 1000) + 3600,
                signature: "0xmockSig",
                status: "EXECUTED",
                txHash: "0x1234...",
                metadata: { merchantId }
            },
            {
                agentAddress: "0xAgent",
                vaultAddress: "0xVault",
                chainId: 25,
                decision: "FORCE_GAS_REFILL",
                amount: "5000000", // 5 USDC
                reason: "Gas level critical (< 5 CRO). Refilling.",
                nonce: uuidv4(),
                issuedAt: Math.floor(Date.now() / 1000) - 86400, // 1 day ago
                expiresAt: Math.floor(Date.now() / 1000) - 80000,
                signature: "0xmockSig2",
                status: "EXECUTED",
                txHash: "0x5678...",
                metadata: { merchantId }
            }
        ]);


        console.log("\n✅ Seed Complete! Refresh the dashboard.");
        process.exit(0);
    });
}

main().catch(console.error);
