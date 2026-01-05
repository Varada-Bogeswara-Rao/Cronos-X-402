
import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

// Standard Compound V2 ABI for Rate/Balance
const CTOKEN_ABI = [
    "function exchangeRateStored() view returns (uint)",
    "function supplyRatePerBlock() view returns (uint)",
    "function balanceOf(address owner) view returns (uint)",
    "function decimals() view returns (uint8)"
];

async function main() {
    // 1. Setup Provider
    const rpcUrl = process.env.CRONOS_RPC_URL || "http://127.0.0.1:8545";
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // 2. Constants
    const tUSDC_ADDR = "0xB3bbf1bE947b245Aef26e3B6a9D777d7703F4c8e";
    const WALLET = "0xb6f018bF96e680a4E6FF3759CDCba43BA897b6Dc"; // Your wallet

    const tUsdc = new ethers.Contract(tUSDC_ADDR, CTOKEN_ABI, provider);

    // 3. Fetch On-Chain Data
    console.log("🔍 Fetching Tectonic Data...");
    const exchangeRateRaw = await tUsdc.exchangeRateStored();
    const supplyRateRaw = await tUsdc.supplyRatePerBlock();
    const balanceRaw = await tUsdc.balanceOf(WALLET);

    // 4. Calculate Values
    // Exchange Rate is mantissa (18 + diff decimals). 
    // Normalized: Rate / 1e18 (if decimals match) or / 1e(18-8+6) = 1e16?
    // Let's just assume normalized 1e18 logic for relative growth.

    const balanceNum = Number(ethers.formatUnits(balanceRaw, 8));

    // Calculate Current Underlying Value
    // Value = (Balance * Rate) / 1e18
    const currentUnderlyingBN = (BigInt(balanceRaw) * BigInt(exchangeRateRaw)) / 1000000000000000000n;
    const currentUsd = Number(ethers.formatUnits(currentUnderlyingBN, 6));

    console.log("\n--- 📊 YIELD DIAGNOSTICS (STANDALONE) ---");
    console.log(`⏱️  Block Number: ${await provider.getBlockNumber()}`);
    console.log(`📈 Exchange Rate: ${exchangeRateRaw.toString()}`);
    console.log(`💸 Supply Rate/Blk: ${supplyRateRaw.toString()}`);
    console.log("-");
    console.log(`🏦 tUSDC Balance: ${ethers.formatUnits(balanceRaw, 8)}`);
    console.log(`💰 Current Val (Chain): $${currentUsd.toFixed(6)}`);

    // supplyRatePerBlock of 206026939 = ~0.2% APY
    // If supplyRateRaw is 0, that's the problem.
    if (supplyRateRaw == 0n) {
        console.log("\n⚠️  PROBLEM: Supply Rate is ZERO.");
        console.log("Cause: No Borrowers in the Fork.");
        console.log("Solution: We need to mock interaction or simulate a borrower.");
    } else {
        console.log("\n✅ Supply Rate is POSITIVE. Yield IS accruing.");
        console.log(`Expected Growth per Day: ~$${(currentUsd * Number(supplyRateRaw) * 5760 / 1e18).toFixed(4)}`);
    }
}

main().then(() => process.exit(0)).catch(console.error);
