import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { AGENT_CONFIG_DEFAULTS, AgentConfig } from "./share/config";

dotenv.config();

// 1. Config
const REGISTRY_ADDRESS = AGENT_CONFIG_DEFAULTS.anchors.agentPolicyRegistry;
const RPC_URL = "https://evm-t3.cronos.org";

// 2. ABI
const ABI = [
    "function setPolicy(uint256 dailySpendLimit, uint256 maxPerTransaction, bytes32 policyHash) external",
    "function getPolicy(address agentAddress) external view returns (uint256, uint256, bytes32, bool, uint256)"
];

// Helper to hash policy (Must match AgentWallet.ts logic)
function hashPolicy(dailyLimit: number, maxPerTransaction: number): string {
    const policyData = {
        dailyLimit: dailyLimit || 0,
        maxPerTransaction: maxPerTransaction || 0
    };
    // Ensure deterministic JSON stringify order if expanding, but for these 2 keys it's stable enough usually
    return ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(policyData)));
}

async function main() {
    // ---- EDIT YOUR LIMITS HERE ----
    const DAILY_LIMIT = 0.5;      // USDC
    const MAX_PER_TX = 0.5;       // USDC
    // -------------------------------

    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) throw new Error("❌ Missing PRIVATE_KEY in .env");

    console.log(`🚀 Setting On-Chain Policy...`);
    console.log(`   - Daily Limit: ${DAILY_LIMIT} USDC`);
    console.log(`   - Max Per Tx: ${MAX_PER_TX} USDC`);

    // Connect
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(privateKey, provider);
    const registry = new ethers.Contract(REGISTRY_ADDRESS, ABI, wallet);

    // Calculate Hash
    const policyHash = hashPolicy(DAILY_LIMIT, MAX_PER_TX);
    console.log(`   - Calculated Hash: ${policyHash}`);

    try {
        // Convert to logic units (e.g. 18 decimals or 6 decimals depending on your standard)
        // Note: The registry stores reference values. The SDK usually compares raw numbers or BN.
        // For simplicity here, we verify what the SDK expects. 
        // AgentWallet.ts uses number comparisons directly, so we store inputs as integers/fixed-point if needed?
        // Wait, AgentWallet.ts casts config.dailyLimit (number) to the hash.
        // Let's stick to the exact values used in the hash logic.

        // However, the contract expects uint256. If we pass 0.5 it will crash.
        // We must decide on a unit.
        // If the SDK treats 0.5 as 0.5 USDC, the contract logic is just storage.
        // To store '0.5' in uint256, we usually scale it (e.g. * 10^6 for USDC).
        // BUT strict hash matching relies on `JSON.stringify({ dailyLimit: 0.5 ... })`.
        // The contract storage `dailySpendLimit` is separate from `policyHash`.
        // We will store scaled units (1e18) for the uint256 fields, but the HASH must match the config JSON.

        const SCALER = BigInt(1e18); // Assume standard 18 decimals for "value" display on chain
        const dailyLimitFn = BigInt(DAILY_LIMIT * 1e18);
        const maxPerTxFn = BigInt(MAX_PER_TX * 1e18);

        console.log(`📝 Sending transaction from ${wallet.address}...`);

        const tx = await registry.setPolicy(
            dailyLimitFn, // Stored for other viewers
            maxPerTxFn,   // Stored for other viewers
            policyHash    // CRITICAL: Used for SDK verification
        );

        console.log(`⏳ Transaction sent: ${tx.hash}`);
        await tx.wait();
        console.log(`✅ Policy updated successfully!`);

        // Verify
        const result = await registry.getPolicy(wallet.address);
        console.log("\n🔍 Verification Look-up:");
        console.log("   - On-Chain Hash:", result[2]);
        console.log("   - Matches Local?", result[2] === policyHash ? "✅ YES" : "❌ NO");

    } catch (err: any) {
        console.error("❌ Failed to set policy:", err.message || err);
    }
}

main();
