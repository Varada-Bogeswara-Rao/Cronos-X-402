import "dotenv/config";
import { ethers } from "ethers";
import { TectonicExecutor } from "./internal/TectonicExecutor";

async function main() {
    const RPC_URL = "https://evm.cronos.org";
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // Random Key (ReadOnly) or Agent Key
    const wallet = ethers.Wallet.createRandom(provider) as any;

    console.log("--------------------------------------------------");
    console.log("🌋 Tectonic Yield Sensor (Cronos)");
    console.log("--------------------------------------------------");

    const executor = new TectonicExecutor(provider, wallet);

    try {
        const pos = await executor.getVaultPosition();

        console.log("Global Metrics:");
        console.log(`> Price Per Share (Exchange Rate): ${ethers.formatUnits(pos.pricePerShare, 18)}`);

        const blocksPerYear = 5439000n;
        const apy = (pos.supplyRatePerBlock * blocksPerYear * 100n) / 10n ** 18n;

        console.log(`> Supply Rate Per Block: ${pos.supplyRatePerBlock}`);
        console.log(`> Estimated APY: ~${apy}% (Simple Interest approximation)`);

        console.log("\n--------------------------------------------------");
        console.log("💼 My Portfolio (from tectonic_position.json):");
        console.log(`> Principal:    ${ethers.formatUnits(pos.principal, 6)} USDC`);
        console.log(`> Wallet Shares: ${pos.shares}`);
        console.log(`> Current Val:  ${ethers.formatUnits(pos.underlyingValue, 6)} USDC`);
        console.log(`> Earned Yield: ${ethers.formatUnits(pos.earnedYield, 6)} USDC`);
        console.log("--------------------------------------------------");

        console.log("\n(Note: Since this demo uses a Random Wallet, 'Shares' is 0, so Current Val is 0, regardless of Principal in JSON)");

    } catch (e: any) {
        console.error("❌ Error:", e.message);
    }
}

main();
