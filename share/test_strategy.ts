
import { StrategyEngine } from "../server/src/services/StrategyEngine";
import { YieldSource } from "../server/src/models/YieldSource";

async function main() {
    console.log("=========================================");
    console.log("🧠 Strategy Engine Decision Verification");
    console.log("=========================================");

    const engine = new StrategyEngine({
        minApy: 0.12, // Set strict threshold (0.12%)
        minConfidence: 0.7
    });

    // --- MOCKS ---
    const MOCK_USDC = {
        id: "TECTONIC_USDC",
        vaultAddress: "0xMockUSDC",
        chainId: 25,
        status: "ACTIVE",
        estimatedAPY: "0.15%", // Good
        lastHarvestedAt: Math.floor(Date.now() / 1000) - 60, // 1 min ago (Fresh)
        updatedAt: Math.floor(Date.now() / 1000) - 60
    };

    const MOCK_CRO = {
        id: "TECTONIC_CRO",
        vaultAddress: "0xMockCRO",
        chainId: 25,
        status: "ACTIVE",
        estimatedAPY: "0.10%", // Low
        lastHarvestedAt: Math.floor(Date.now() / 1000) - 60, // 1 min ago
        updatedAt: Math.floor(Date.now() / 1000) - 60
    };

    const MOCK_OLD = {
        id: "OLD_SOURCE",
        vaultAddress: "0xOld",
        chainId: 25,
        status: "ACTIVE",
        estimatedAPY: "50.00%", // High APY but...
        lastHarvestedAt: Math.floor(Date.now() / 1000) - (7 * 3600), // 7 hours ago (Stale)
        updatedAt: Math.floor(Date.now() / 1000) - (7 * 3600)
    };

    // Override Mongoose
    (YieldSource as any).findOne = async (query: any) => {
        if (query.id === "TECTONIC_USDC") return MOCK_USDC;
        if (query.id === "TECTONIC_CRO") return MOCK_CRO;
        if (query.id === "OLD_SOURCE") return MOCK_OLD;
        return null;
    };

    (YieldSource as any).find = async () => {
        return [MOCK_USDC, MOCK_CRO, MOCK_OLD];
    };

    // --- TESTS ---

    console.log("\n🧪 1. Testing High APY & Fresh (USDC > 0.12%)...");
    const d1 = await engine.evaluate("TECTONIC_USDC", "0xAgent");
    console.log(`   > Decision: ${d1.decision} (${d1.reason})`);
    if (d1.decision !== "APPROVE") console.error("   ❌ Expected APPROVE");

    console.log("\n🧪 2. Testing Low APY (CRO 0.10% < 0.12%)...");
    const d2 = await engine.evaluate("TECTONIC_CRO", "0xAgent");
    console.log(`   > Decision: ${d2.decision} (${d2.reason})`);
    if (d2.decision !== "HOLD") console.error("   ❌ Expected HOLD");

    console.log("\n🧪 3. Testing Stale Data (7 hours old)...");
    const d3 = await engine.evaluate("OLD_SOURCE", "0xAgent");
    console.log(`   > Decision: ${d3.decision} (${d3.reason})`);
    if (d3.decision !== "DENY") console.error("   ❌ Expected DENY");

    // Output Payload Sample
    console.log("\n📜 Sample Payload (USDC):");
    console.log(JSON.stringify(d1, null, 2));
}

main();
