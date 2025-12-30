import "dotenv/config";
import { TectonicAdapter } from "../server/src/services/yieldSources/TectonicAdapter";
import { TectonicCroAdapter } from "../server/src/services/yieldSources/TectonicCroAdapter";
import { YieldSource } from "../server/src/models/YieldSource";

/**
 * ADAPTER TEST SUITE
 * Verifies that the server-side adapters can:
 * 1. Connect to Cronos Mainnet
 * 2. Fetch accurate Exchange Rates (using staticCall)
 * 3. Calculate APY
 * 4. Pass Sanity Checks
 */
async function main() {
    console.log("=========================================");
    console.log("🛰️  Tectonic Yield Comparison Test");
    console.log("=========================================");

    // 1. MOCK DATABASE (Bypass Real Mongo)
    // We overwrite the findOneAndUpdate method to just log the data instead of saving it.
    console.log("ℹ️  Mocking Database Layer...");

    (YieldSource as any).findOneAndUpdate = async (query: any, update: any, options: any) => {
        const id = update.id;
        const apy = update.estimatedAPY;
        const status = update.status;
        console.log(`\n💾 [DB MOCK] Saving ${id}:`);
        console.log(`   > Status: ${status}`);
        console.log(`   > APY:    ${apy}`);
        console.log(`   > Rate:   ${update.pricePerShare}`);
        console.log(`   > ID:     ${update.id}`);
        return {};
    };

    // 2. TEST TECTONIC USDC
    console.log("\n-----------------------------------------");
    console.log("1️⃣  Testing TECTONIC USDC...");
    const usdcAdapter = new TectonicAdapter();
    try {
        await usdcAdapter.fetchAndSync();
    } catch (e: any) {
        console.error("❌ USDC Adapter Failed:", e.message);
    }

    // 3. TEST TECTONIC CRO
    console.log("\n-----------------------------------------");
    console.log("2️⃣  Testing TECTONIC CRO...");
    const croAdapter = new TectonicCroAdapter();
    try {
        await croAdapter.fetchAndSync();
    } catch (e: any) {
        console.error("❌ CRO Adapter Failed:", e.message);
    }

    console.log("\n-----------------------------------------");
    console.log("✅ Comparison Complete.");
    process.exit(0);
}

main();
