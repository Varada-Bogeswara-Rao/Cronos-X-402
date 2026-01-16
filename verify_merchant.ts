import { ethers } from "ethers";

// 1. Config
const REGISTRY_ADDRESS = "0x1948175dDB81DA08a4cf17BE4E0C95B97dD11F5c"; // Cronos Testnet
const RPC_URL = "https://evm-t3.cronos.org";

// 2. ABI
const ABI = [
    "function getMerchant(string calldata merchantId) external view returns (address wallet, bool isActive, string memory metadataURI)"
];

async function main() {
    const merchantId = process.argv[2] || "merchant_01"; // Default to merchant_01

    console.log(`🔍 Verifying Merchant ID: '${merchantId}' on Cronos Testnet...`);

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const registry = new ethers.Contract(REGISTRY_ADDRESS, ABI, provider);

    try {
        const result = await registry.getMerchant(merchantId);

        if (result.wallet === ethers.ZeroAddress) {
            console.log(`❌ Merchant '${merchantId}' is NOT registered.`);
        } else {
            console.log(`✅ Found Merchant '${merchantId}'`);
            console.log(`   - Wallet: ${result.wallet}`);
            console.log(`   - Active: ${result.isActive}`);
            console.log(`   - Metadata: ${result.metadataURI}`);
        }
    } catch (err) {
        console.error("❌ Error fetching merchant:", err);
    }
}

main();
