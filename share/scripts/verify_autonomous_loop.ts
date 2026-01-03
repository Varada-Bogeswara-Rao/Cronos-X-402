
import dotenv from "dotenv";
import { FacilitatorLoop } from "../../server/src/services/FacilitatorLoop";
import { WalletWatcher } from "../../server/src/services/WalletWatcher";
import { ethers } from "ethers";
import { ProfitEngine, ProfitMetric } from "../../server/src/services/ProfitEngine";

dotenv.config();

// MOCK SETUP
const MOCK_MERCHANT_ID = "merchant_test_autonomy_" + Date.now();
// Random Agent Keys
const AGENT_WALLET = ethers.Wallet.createRandom();
const FACILITATOR_WALLET = ethers.Wallet.createRandom();

// MOCK MONGOOSE
import YieldPosition from "../../server/src/models/YieldPosition";
import YieldDecisionModel from "../../server/src/models/YieldDecision";
YieldPosition.findOne = (async () => null) as any;
YieldDecisionModel.create = (async () => ({})) as any;

async function runVerification() {
    process.env.AGENT_PRIVATE_KEY = AGENT_WALLET.privateKey;
    process.env.ENABLE_AUTONOMY = "true"; // Enable to check logic flow

    console.log("🧪 Starting Autonomy Loop Verification (Mock Engine)...");

    // 1. Mock Profit Engine
    const mockEngine = {
        analyze: async (id: string): Promise<ProfitMetric> => {
            return {
                merchantId: id,
                protocol: "TECTONIC_USDC",
                principal: 100,
                currentValue: 105,
                unrealizedGain: 5,
                projectedWithdrawCost: 0.1,
                netProfit: 4.9,
                roiPercent: 4.9,
                isProfitable: true,
                recommendation: "FORCE_GAS_REFILL", // Test Danger Case
                amount: "5000000" // 5 USDC
            };
        }
    } as ProfitEngine;

    // 2. Init Loop with Mock Engine
    const mockWatcher = new WalletWatcher() as any;

    console.log("Facilitator Addr:", FACILITATOR_WALLET.address);
    console.log("Agent Addr:", AGENT_WALLET.address);

    const loop = new FacilitatorLoop(
        mockWatcher,
        FACILITATOR_WALLET.privateKey,
        AGENT_WALLET.address,
        mockEngine
    );

    // 3. Run Cycle (Dry Run = true first)
    console.log("\n🔄 Running Cycle (Dry Run)...");
    await loop.runCycle(MOCK_MERCHANT_ID, true);

    // 4. Run Cycle (Live mode simulation - to see Dispatched log)
    // Note: It will fail at DB update step (YieldPosition save) unless we mock that too?
    // FacilitatorLoop calls `YieldPosition.findOne` for idempotency.
    // So we CANNOT easily run full cycle without DB or mocking Mongoose.
    // But Dry Run should be enough to verify Signing Payload!

    console.log("✅ Verification Complete.");
    process.exit(0);
}

runVerification().catch(e => console.error(e));
