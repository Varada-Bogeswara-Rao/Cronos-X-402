import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

// 1. Config
const REGISTRY_ADDRESS = "0x1948175dDB81DA08a4cf17BE4E0C95B97dD11F5c"; // Cronos Testnet
const RPC_URL = "https://evm-t3.cronos.org";

// 2. ABI
const ABI = [
    "function registerMerchant(string calldata merchantId, string calldata metadataURI) external",
    "function getMerchant(string calldata merchantId) external view returns (address, bool, string)"
];

async function main() {
    const merchantId = process.argv[2];
    if (!merchantId) {
        throw new Error("❌ Usage: npx ts-node register_merchant.ts <MERCHANT_ID>");
    }

    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        throw new Error("❌ Missing PRIVATE_KEY in .env");
    }

    console.log(`🚀 Registering Merchant ID: '${merchantId}' on Cronos Testnet...`);

    // Connect
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(privateKey, provider);
    const registry = new ethers.Contract(REGISTRY_ADDRESS, ABI, wallet);

    // Check if already registered
    const existing = await registry.getMerchant(merchantId);
    if (existing[0] !== ethers.ZeroAddress) {
        console.log(`⚠️ Merchant '${merchantId}' is already registered to ${existing[0]}`);
        return;
    }

    // Register
    try {
        console.log(`📝 Sending transaction from ${wallet.address}...`);
        const tx = await registry.registerMerchant(merchantId, "ipfs://placeholder-metadata");
        console.log(`⏳ Transaction sent: ${tx.hash}`);
        console.log("   Waiting for confirmation...");

        await tx.wait();
        console.log(`✅ successfully registered merchant '${merchantId}'!`);
    } catch (err: any) {
        console.error("❌ Registration failed:", err.message || err);
    }
}

main();
