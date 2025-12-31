
import { ethers } from "ethers";

export interface RiskConfig {
    /**
     * Max percentage of CURRENT wallet balance to allocate in a single move.
     * Range: 0.0 - 1.0 (e.g., 0.5 for 50%)
     */
    maxYieldAllocationPercent: number;

    /**
     * Absolute minimum balance to keep in wallet.
     * Expressed in SMALLEST token units (e.g., 6 decimals for USDC, 18 for ETH/CRO).
     * Acts as a 'Gas Buffer' or 'Emergency Fund'.
     */
    minIdleBalance: bigint;

    /**
     * Maximum number of yield supply/withdraw actions permitted per day.
     * Prevents runaway loops.
     */
    maxDailyYieldMoves: number;
}

export const DEFAULT_RISK_CONFIG: RiskConfig = {
    maxYieldAllocationPercent: 0.5, // Conservative 50%
    minIdleBalance: 100n * (10n ** 6n), // 100 USDC (assuming 6 decimals)
    maxDailyYieldMoves: 10
};

export class RiskManager {
    constructor(private config: RiskConfig = DEFAULT_RISK_CONFIG) {
        // 🛡️ Sanity Checks on Startup
        if (config.maxYieldAllocationPercent <= 0 || config.maxYieldAllocationPercent > 1) {
            throw new Error("Invalid RiskConfig: maxYieldAllocationPercent must be (0, 1]");
        }
        if (config.maxDailyYieldMoves < 1) {
            throw new Error("Invalid RiskConfig: maxDailyYieldMoves must be >= 1");
        }
    }

    public getConfig(): RiskConfig {
        return { ...this.config };
    }

    /**
     * Assess if a proposed Yield Move is safe.
     * @param totalWalletBalance Total USDC balance currently in wallet
     * @param proposedAllocation Amount wanting to supply
     * @param movesToday Number of moves already executed today
     * @throws Error if risk check fails
     */
    assessSupplyRisk(
        totalWalletBalance: bigint,
        proposedAllocation: bigint,
        movesToday: number
    ): void {
        // 1. Rate Check
        if (movesToday >= this.config.maxDailyYieldMoves) {
            throw new Error(`Risk: Daily Limit Reached (${movesToday}/${this.config.maxDailyYieldMoves})`);
        }

        // 2. Insolvency Check (Min Idle)
        // If we supply this amount, what is left?
        if (proposedAllocation > totalWalletBalance) {
            throw new Error(`Risk: Insolvency! Proposed ${proposedAllocation} > Balance ${totalWalletBalance}`);
        }

        const remainingBalance = totalWalletBalance - proposedAllocation;
        if (remainingBalance < this.config.minIdleBalance) {
            throw new Error(`Risk: Min Idle Violation! Remaining ${remainingBalance} < Min ${this.config.minIdleBalance}`);
        }

        // 3. Concentration Check (Max %)
        // NOTE: This rule limits per-move cash allocation. 
        // It does NOT represent total portfolio exposure (handled separately).

        // We allow a small "Dust Tolerance" (0.1%) to prevent failures on tiny rounding errors.
        const toleranceMultiplier = 1.001;
        const adjustedPercent = this.config.maxYieldAllocationPercent * toleranceMultiplier;

        // Formula: allocation * 10000 <= total * (percent * 10000)
        const multiplier = BigInt(Math.floor(adjustedPercent * 10000));
        const maxAllowed = (totalWalletBalance * multiplier) / 10000n;

        if (proposedAllocation > maxAllowed) {
            throw new Error(`Risk: Allocation Limit! ${proposedAllocation} > ${maxAllowed} (${(adjustedPercent * 100).toFixed(2)}% of Balance)`);
        }
    }
}
