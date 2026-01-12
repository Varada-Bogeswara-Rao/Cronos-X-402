
import mongoose from "mongoose";
import dotenv from "dotenv";
import PaymentAttempt from "../models/PaymentAttempt";
import path from "path";

// Load env from server root
dotenv.config({ path: path.join(__dirname, "../../.env") });

const TARGET_WALLET = "0xe3E0ef77E5Fdd925103250d52cF6cfc25e816624"; // User's wallet from logs

async function seed() {
    console.log("🌱 Seeding Analytics Data for wallet:", TARGET_WALLET);

    if (!process.env.MONGODB_URI) {
        console.error("❌ MONGODB_URI not found in env");
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Clear existing logs for this wallet to avoid duplicates/mess (optional, but cleaner)
    await PaymentAttempt.deleteMany({ agentAddress: TARGET_WALLET });
    console.log("🧹 Cleared previous logs");

    const records = [];
    const now = Date.now();
    const ONE_HOUR = 3600 * 1000;

    // 1. Successful payments
    for (let i = 0; i < 8; i++) {
        records.push({
            agentAddress: TARGET_WALLET,
            timestamp: new Date(now - i * ONE_HOUR * 2), // Spread over 16h
            url: i % 2 === 0 ? "https://api.weather.io/v1/forecast" : "https://llm.provider.net/v1/chat",
            merchantId: i % 2 === 0 ? "weather-dao" : "llm-provider-inc",
            amount: (Math.random() * 2 + 0.1).toFixed(2),
            currency: "USDC",
            decision: "APPROVED",
            txHash: "0x" + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(""),
            chainId: 25
        });
    }

    // 2. Blocked: Daily Limit
    records.push({
        agentAddress: TARGET_WALLET,
        timestamp: new Date(now - 30 * 60 * 1000), // 30 mins ago
        url: "https://expensive.api/premium",
        merchantId: "premium-services",
        amount: 50.00,
        currency: "USDC",
        decision: "BLOCKED",
        reason: "Daily spending limit exceeded (Limit: $10.00)",
        chainId: 25
    });

    // 3. Blocked: Merchant Not Allowed
    records.push({
        agentAddress: TARGET_WALLET,
        timestamp: new Date(now - 4 * ONE_HOUR), // 4 hours ago
        url: "https://suspicious-site.com/api",
        merchantId: "unknown-hacker",
        amount: 1.00,
        currency: "USDC",
        decision: "BLOCKED",
        reason: "Merchant domain not in allowlist",
        chainId: 25
    });

    // 4. Blocked: Low Balance (Simulated)
    records.push({
        agentAddress: TARGET_WALLET,
        timestamp: new Date(now - 12 * ONE_HOUR),
        url: "https://defi.aggregator/swap",
        merchantId: "defi-agg",
        amount: 5.50,
        currency: "USDC",
        decision: "BLOCKED",
        reason: "Insufficient funds for gas estimation",
        chainId: 25
    });

    await PaymentAttempt.insertMany(records);
    console.log(`✅ Inserted ${records.length} records.`);

    await mongoose.disconnect();
}

seed().catch(console.error);
