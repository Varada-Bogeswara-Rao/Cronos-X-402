import { ethers } from "ethers";
import YieldPosition from "../models/YieldPosition";
import WalletSnapshot from "../models/WalletSnapshot";
import { GasEstimator } from "./GasEstimator";
import { StrategyEngine } from "./StrategyEngine"; // For types/config if needed, or decouple

export interface ProfitMetric {
    merchantId: string;
    protocol: string;

    // Financials (USD)
    principal: number;
    currentValue: number;
    unrealizedGain: number;       // Raw Growth
    projectedWithdrawCost: number; // Gas Cost
    netProfit: number;            // Gain - Cost

    // Decision Support
    roiPercent: number;
    isProfitable: boolean;
    recommendation: "HOLD" | "WITHDRAW" | "EMERGENCY_EXIT" | "APPROVE" | "FORCE_GAS_REFILL";
    amount?: string; // Optional amount suggestion
}

export class ProfitEngine {
    private gasEstimator: GasEstimator;

    constructor() {
        this.gasEstimator = new GasEstimator();
    }

    async analyze(merchantId: string): Promise<ProfitMetric | null> {
        // 1. Fetch Data
        const snapshot = await WalletSnapshot.findOne({ merchantId }).sort({ timestamp: -1 });
        // NOTE: We might want to create a position if none exists, but for now strict.
        // Query for either OPEN or ACTIVE
        let position = await YieldPosition.findOne({
            merchantId,
            status: { $in: ["OPEN", "ACTIVE"] }
        });
        if (!position) {
            // Treat as 0 principal position for investment analysis
            // But for MVP, assume position exists or we create one? 
            // Logic: If we have Idle funds, we should INVEST.
            // If we don't handle this, we never start.
            // Let's mock a phantom position for analysis if snapshot exists.
            if (snapshot) {
                position = { principalAmount: "0", protocol: "TECTONIC_USDC" } as any;
            }
        }

        if (!snapshot || !position) return null;

        // 2. Fetch Gas Costs
        const costs = await this.gasEstimator.getEstimates();

        // 3. Calculate Math
        const principalBN = BigInt(position.principalAmount || "0");
        const principalUsd = Number(ethers.formatUnits(principalBN, 6));

        console.log(`DEBUG: Merchant ${merchantId} | Principal: $${principalUsd} | RAW: ${position.principalAmount}`);
        const tUsdcBN = BigInt(snapshot.tUsdcBalance || "0");
        const rateBN = BigInt(snapshot.exchangeRate || "1000000000000000000"); // 1e18
        const currentUnderlyingBN = (tUsdcBN * rateBN) / 1000000000000000000n;
        const currentValueUsd = Number(ethers.formatUnits(currentUnderlyingBN, 6));

        console.log(`DEBUG: [ProfitLogic] CurrentVal: $${currentValueUsd} | Diff: $${(currentValueUsd - principalUsd).toFixed(6)}`);

        // 4. Profitability
        const unrealizedGain = currentValueUsd - principalUsd;
        const netProfit = unrealizedGain - costs.withdraw;
        const roi = principalUsd > 0 ? (netProfit / principalUsd) * 100 : 0;

        // 5. Decision Logic
        let rec: "HOLD" | "WITHDRAW" | "EMERGENCY_EXIT" | "APPROVE" | "FORCE_GAS_REFILL" = "HOLD"; // Default

        const minBufferUsd = 5.0; // Operational Buffer
        const gasBufferCro = 5.0; // 5 CRO (approx) - using simple count

        const walletUsdc = Number(ethers.formatUnits(snapshot.usdcBalance, 6));
        const walletCro = Number(ethers.formatEther(snapshot.croBalance));

        // PRIORITY 1: GAS SURVIVAL
        if (walletCro < gasBufferCro) {
            // Only refill if we have enough USDC (> $5)
            if (walletUsdc > 5) {
                rec = "FORCE_GAS_REFILL";
            }
        }
        // PRIORITY 2: EMERGENCY OP FUNDS
        else if (walletUsdc < minBufferUsd && currentValueUsd > 10) {
            // Starving for USDC, kill yield position to survive
            rec = "EMERGENCY_EXIT";
        }
        // PRIORITY 3: PROFIT TAKING
        else if (netProfit > (costs.withdraw * 2)) {
            rec = "WITHDRAW";
        }
        // PRIORITY 4: INVESTMENT (Surplus)
        else {
            if (walletUsdc > 1000.0) { // Prod: Only invest if > $1,000 (Gas Efficiency)
                rec = "APPROVE";
            }
        }

        // 6. Calculate Amount based on Rec
        let amount = "0";
        if (rec === "FORCE_GAS_REFILL") {
            amount = "5000000"; // 5 USDC (Fixed for MVP)
        } else if (rec === "APPROVE") {
            // Invest 50% of surplus above 10
            const surplus = walletUsdc - 10.0;
            if (surplus > 0) {
                const investAmt = Math.floor(surplus * 0.5 * 1000000);
                amount = investAmt.toString();
            }
        } else if (rec === "WITHDRAW") {
            // Withdraw Net Profit
            const profitAmt = Math.floor(netProfit * 1000000);
            amount = profitAmt.toString();
        }

        return {
            merchantId,
            protocol: position.protocol || "TECTONIC_USDC",
            principal: principalUsd,
            currentValue: currentValueUsd,
            unrealizedGain,
            projectedWithdrawCost: costs.withdraw,
            netProfit,
            roiPercent: roi,
            isProfitable: netProfit > 0,
            recommendation: rec as any,
            amount: amount
        };
    }
}
