
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
    withdraw(amount: bigint): Promise<string>;
}

// Interface for muscle capable of swapping
// (Subset of VVSExecutor)
interface RefillExecutor {
    swapToGas(amountIn: bigint, minAmountOut: bigint): Promise<string>;
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
        currentBalance: bigint, // USDC Balance
        currentGasBalance: bigint, // Native Balance (CRO)
        movesToday: number,
        executor: SafeExecutor,
        refillExecutor?: RefillExecutor // New optional capability
    ): Promise<ExecutionResult> {
        try {
            // ---------------------------------------------------------
            // 1. Trust Verification
            // ---------------------------------------------------------
            verifyDecision(decision, this.facilitatorAddress, agentAddress);

            // ---------------------------------------------------------
            // 2. Decision Logic
            // ---------------------------------------------------------
            if (decision.decision === "DENY" || decision.decision === "HOLD") {
                return { executed: false, reason: `Decision was ${decision.decision}` };
            }

            // CASE A: SUPPLY (APPROVE)
            if (decision.decision === "APPROVE") {
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
                    return { executed: false, reason: "Safe Supply <= 0" };
                }

                // ---------------------------------------------------------
                // 3. Risk Gate
                // ---------------------------------------------------------
                // Double check with the official assessor
                this.riskManager.assessSupplyRisk(currentBalance, amountToSupply, movesToday);

                // ---------------------------------------------------------
                // 4. Execution
                // ---------------------------------------------------------
                console.log(`[YieldAgent] Executing Supply: ${amountToSupply}...`);
                const tx = await executor.supply(amountToSupply);
                return { executed: true, txHash: tx, reason: "Success" };
            }

            // CASE B: PARTIAL WITHDRAW
            if (decision.decision === "PARTIAL_WITHDRAW") {
                if (!decision.amount) {
                    return { executed: false, reason: "No Amount" };
                }
                const amount = BigInt(decision.amount);
                console.log(`[YieldAgent] Executing Partial Withdraw: ${amount}...`);

                // No Risk Assessment needed for withdrawal (it increases safety), 
                // but we could add "Min Held" checks if needed.
                const tx = await executor.withdraw(amount);
                return { executed: true, txHash: tx, reason: "Success" };
            }

            // CASE C: EMERGENCY EXIT or FULL WITHDRAW
            if (decision.decision === "EMERGENCY_EXIT") {
                console.log(`[YieldAgent] EMERGENCY EXIT triggered!`);
                // For now, withdrawYield() is our "Redeem All / Panic" button
                const tx = await executor.withdrawYield();
                return { executed: true, txHash: tx, reason: "Success" };
            }

            // CASE D: FORCE GAS REFILL
            if (decision.decision === "FORCE_GAS_REFILL") {
                if (!refillExecutor) {
                    return { executed: false, reason: "No RefillExecutor" };
                }
                if (!decision.amount) {
                    return { executed: false, reason: "No Amount" };
                }
                if (!decision.minAmountOut) {
                    return { executed: false, reason: "Slippage Protection Missing (minAmountOut)" };
                }

                const amount = BigInt(decision.amount);
                const minOut = BigInt(decision.minAmountOut);
                const config = this.riskManager.getConfig();

                // 1. Balance Check (Can we afford it?)
                if (currentBalance < amount) {
                    return { executed: false, reason: "Insufficient USDC for Refill" };
                }

                // 2. Need Check (Do we really need gas?)
                // If Gas > Buffer, REJECT/SKIP (Don't waste USDC)
                if (currentGasBalance >= config.gasBufferCro) {
                    return { executed: false, reason: "Gas Balance Sufficient (Skipped Refill)" };
                }

                console.log(`[YieldAgent] Gas Low (${currentGasBalance} < ${config.gasBufferCro}). Swapping ${amount} USDC -> CRO...`);
                const tx = await refillExecutor.swapToGas(amount, minOut);
                return { executed: true, txHash: tx, reason: "Refill Success" };
            }

            return { executed: false, reason: "Unknown Decision" };

        } catch (error: any) {
            console.error(`[YieldAgent] Execution Blocked: ${error.message}`);
            return { executed: false, reason: error.message };
        }
    }
}
