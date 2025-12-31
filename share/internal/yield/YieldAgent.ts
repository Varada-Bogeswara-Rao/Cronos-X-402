
import { YieldDecision } from "./YieldDecision";
import { RiskManager, DEFAULT_RISK_CONFIG } from "./RiskManager";
import { verifyDecision } from "../../checks/verifyDecision";
import { ethers } from "ethers";

// Standardized Execution Result
export interface ExecutionResult {
    executed: boolean;
    reason?: string;
    txHash?: string;
}

// Interface for muscle capable of executing the decision
// (Subset of TectonicExecutor)
interface SafeExecutor {
    supply(amount: bigint): Promise<string>;
    withdrawYield(): Promise<string>;
}

export class YieldAgent {
    private riskManager: RiskManager;
    private facilitatorAddress: string;

    constructor(
        facilitatorAddress: string,
        riskConfig = DEFAULT_RISK_CONFIG
    ) {
        this.facilitatorAddress = facilitatorAddress;
        this.riskManager = new RiskManager(riskConfig);
    }

    /**
     * The Guarded Execution Gate
     * 1. Verify Trust (Signature)
     * 2. Assess Risk (Capital Guardrails)
     * 3. Execute (Muscle)
     */
    async executeDecision(
        decision: YieldDecision,
        agentAddress: string,
        currentBalance: bigint, // Needed for Risk Check
        movesToday: number,
        executor: SafeExecutor
    ): Promise<ExecutionResult> {
        try {
            // ---------------------------------------------------------
            // 1. Trust Verification
            // ---------------------------------------------------------
            verifyDecision(decision, this.facilitatorAddress, agentAddress);

            // ---------------------------------------------------------
            // 2. Decision Logic
            // ---------------------------------------------------------
            if (decision.decision === "DENY") {
                return { executed: false, reason: "Decision was DENY" };
            }
            if (decision.decision === "HOLD") {
                return { executed: false, reason: "Decision was HOLD" };
            }

            // If we are here, it's APPROVE.
            // Let's calculate the "Max Safe Amount" we CAN supply.
            // MaxAlloc = Balance * 50%
            // MaxLiquidity = Balance - MinIdle
            // SafeAmount = Min(MaxAlloc, MaxLiquidity)

            const config = this.riskManager.getConfig();
            const maxAlloc = (currentBalance * BigInt(Math.floor(config.maxYieldAllocationPercent * 10000))) / 10000n;
            const liquidityLimit = currentBalance - config.minIdleBalance;

            let amountToSupply = maxAlloc < liquidityLimit ? maxAlloc : liquidityLimit;

            // ⚠️ Apply Dust Tolerance (0.1% Slack)
            // If we aim exactly at the limit, tiny rounding or fee simulation in check might assume we are over.
            // We reduce our target by 0.1% to be safely INSIDE the limit.
            const DUST_SLACK_BPS = 10n; // 0.1%
            amountToSupply = (amountToSupply * (10000n - DUST_SLACK_BPS)) / 10000n;

            if (amountToSupply <= 0n) {
                return { executed: false, reason: "Calculated Safe Supply amount is <= 0" };
            }

            // ---------------------------------------------------------
            // 3. Risk Gate
            // ---------------------------------------------------------
            // Double check with the official assessor
            this.riskManager.assessSupplyRisk(currentBalance, amountToSupply, movesToday);

            // ---------------------------------------------------------
            // 4. Execution
            // ---------------------------------------------------------
            if (decision.scope === "YIELD_ONLY") {
                console.log(`[YieldAgent] Executing Supply: ${amountToSupply} units...`);
                const tx = await executor.supply(amountToSupply);
                return { executed: true, txHash: tx, reason: "Success" };
            }

            return { executed: false, reason: "Unknown Scope" };

        } catch (error: any) {
            console.error(`[YieldAgent] Execution Blocked: ${error.message}`);
            return { executed: false, reason: error.message };
        }
    }
}
