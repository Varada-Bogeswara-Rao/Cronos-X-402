import { ethers } from "ethers";
import { WalletWatcher } from "./WalletWatcher";
import { ProfitEngine } from "./ProfitEngine";
import YieldPosition from "../models/YieldPosition";
import YieldDecisionModel, { YieldDecision } from "../models/YieldDecision";
import { YieldDecisionManager } from "./YieldDecisionManager";

export class FacilitatorLoop {
    private profitEngine: ProfitEngine;
    private walletWatcher: WalletWatcher;
    private facilitatorSigner: ethers.Wallet;
    // private yieldAgent: YieldAgent; // The "Receiver" or "Client" to the agent
    private yieldAgentAddress: string;

    // In a real microservice, this might be an RPC client. 
    // Here we have direct access to the Agent instance for simplicity.

    constructor(
        watcher: WalletWatcher,
        signerKey: string,
        agentAddress: string, // Needed for verifying decision target
        engine?: ProfitEngine
    ) {
        this.walletWatcher = watcher;
        this.profitEngine = engine || new ProfitEngine();
        this.facilitatorSigner = new ethers.Wallet(signerKey);
        this.yieldAgentAddress = agentAddress;

        // Instantiate Agent (acting as both Facilitator dispatch and Agent receiver in this monolithic server)
        // In production, Agent might be separate process.
        // this.yieldAgent = new YieldAgent(this.facilitatorSigner.address, DEFAULT_RISK_CONFIG);
    }

    /**
     * Main Cycle. Called by Scheduler.
     */
    async runCycle(merchantId: string, dryRun = true) {
        if (!process.env.ENABLE_AUTONOMY && !dryRun) {
            console.log("⏸️ [Facilitator] Autonomy DISABLED. Skipping.");
            return;
        }

        try {
            // 1. Evaluate (Brain)
            const metric = await this.profitEngine.analyze(merchantId);
            if (!metric) {
                console.warn("⚠️ [Facilitator] No Metrics. Skipping.");
                return;
            }

            console.log(`🧠 [Recommend] ${metric.recommendation} | Profit: $${metric.netProfit.toFixed(2)} | Amt: ${metric.amount}`);

            if (metric.recommendation === "HOLD") {
                console.log("⏸️ [Facilitator] Holding.");
                return;
            }

            // 2. Build Decision (Manager)
            const decisionManager = new YieldDecisionManager(this.facilitatorSigner.privateKey);
            const decisionUnsigned = decisionManager.buildDecision(metric, this.yieldAgentAddress);

            // 3. Idempotency Check (Manager)
            const decisionHash = decisionManager.hashDecision(decisionUnsigned);

            const position = await YieldPosition.findOne({ merchantId, protocol: metric.protocol });
            if (position && position.lastDecisionHash === decisionHash) {
                console.log("🔁 [Facilitator] SKIPPED_DUPLICATE:", decisionHash);
                return;
            }

            // 4. Sign (Manager - EIP-712)
            const signedDecision = await decisionManager.signDecision(decisionUnsigned);

            // 5. Persist (Activity Log)
            await YieldDecisionModel.create({
                ...signedDecision,
                status: "DISPATCHED" // Optimistic for now (monolith)
            });

            // 6. Execute
            if (dryRun) {
                console.log("🧪 [DRY_RUN_ONLY] Signed Payload:", JSON.stringify(signedDecision, null, 2));
            } else {
                console.log("🚀 [DISPATCHED] Sending to Agent...");
                // In production: await this.agentClient.send(signedDecision);
                // For MVP Monolith:
                const agentKey = process.env.AGENT_PRIVATE_KEY;
                if (!agentKey) {
                    console.error("❌ [Facilitator] Missing Agent Key for Execution.");
                    return;
                }
                // Mock Execution call ...
            }

            // 7. Update State (Idempotency)
            if (!dryRun && position) {
                position.lastDecisionHash = decisionHash;
                position.lastActionAt = new Date();
                await position.save();
            }

        } catch (error: any) {
            console.error("❌ [Facilitator] Cycle Error:", error.message);
        }
    }
}
