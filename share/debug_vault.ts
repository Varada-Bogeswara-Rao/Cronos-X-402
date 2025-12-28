
import "dotenv/config";
import { ethers } from "ethers";

const MAINNET_RPC = "https://evm.cronos.org";
const VAULT_ADDR = "0xA6fF77fC8E839679D4F7408E8988B564dE1A2dcD";

async function main() {
    const provider = new ethers.JsonRpcProvider(MAINNET_RPC);

    // Minimal ABI to get strategy
    const ABI = [
        "function strategy() view returns (address)",
        "function owner() view returns (address)"
    ];

    const vault = new ethers.Contract(VAULT_ADDR, ABI, provider);

    console.log(`🔍 Inspecting Vault: ${VAULT_ADDR}`);

    try {
        const strat = await vault.strategy();
        console.log("--------------------------------------------------");
        console.log("🎯 STRATEGY ADDRESS FOUND:", strat);
        console.log("--------------------------------------------------");
        console.log(`👉 check this address on Cronoscan for 'harvest' or 'panic' transactions.`);
    } catch (e) {
        console.log("❌ Could not read strategy(). This might not be a standard Beefy vault.");
    }

    try {
        const owner = await vault.owner();
        console.log("Vault Owner:", owner);
    } catch (e) { }
}

main().catch(console.error);
