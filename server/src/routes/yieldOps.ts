import express, { Request, Response } from 'express';
import { ProfitEngine } from '../services/ProfitEngine';
import YieldPosition from '../models/YieldPosition';
import YieldDecisionModel from '../models/YieldDecision';
import WalletSnapshot from '../models/WalletSnapshot';

const router = express.Router();
const profitEngine = new ProfitEngine();

// GET /api/yield/status
// Returns current logic state and metrics
router.get('/status', async (req: Request, res: Response) => {
    try {
        const { merchantId } = req.query;
        if (!merchantId) {
            res.status(400).json({ error: "Missing merchantId" });
            return;
        }

        // 1. Run Live Analysis (Dry Run)
        const metric = await profitEngine.analyze(merchantId as string);

        // 2. Get Config Status
        const config = {
            autonomyEnabled: process.env.ENABLE_AUTONOMY === "true",
            dryRun: false, // FORCE LIVE FOR SIMULATION
            // Hardcoded thresholds for display
            minProfitUsd: 5.0,
            gasBufferCro: 5.0
        };

        // 3. Get Snapshots
        const snapshot = await WalletSnapshot.findOne({ merchantId }).sort({ timestamp: -1 });
        const balances = snapshot ? {
            usdc: Number(snapshot.usdcBalance) / 1e6,
            cro: Number(snapshot.croBalance) / 1e18,
            tUsdc: Number(snapshot.tUsdcBalance) / 1e8
        } : { usdc: 0, cro: 0, tUsdc: 0 };

        if (!metric) {
            // Fallback: If live analysis failed, try to construct a partial view from Snapshot?
            if (snapshot) {
                // We have data, but maybe chain is down or position is new.
                // Return a "Monitoring" state with zeroed profit but valid balances.
                res.json({
                    status: "MONITORING",
                    reason: "Tracking active position. Live profit analysis unavailable (Node/Chain connectivity).",
                    metrics: {
                        totalValue: balances.usdc + (balances.tUsdc * 0.02), // Rough Est
                        unrealizedGain: 0,
                        netProfit: 0,
                        roi: 0,
                        withdrawCost: 0
                    },
                    balances,
                    config
                });
                return;
            }

            // Position might not exist or snapshot missing
            res.json({
                status: "UNKNOWN",
                reason: "Insufficient data. Please wait for the Yield Scheduler to run its first cycle.",
                metrics: null,
                balances,
                config
            });
            return;
        }

        // 4. Construct Logic Explanation
        let status = "HOLDING";
        let reason = "";

        if (metric.recommendation === "FORCE_GAS_REFILL") {
            status = "DANGER_LOW_GAS";
            reason = "Gas balance below safety buffer. Need refill.";
        } else if (metric.recommendation === "APPROVE") {
            status = "INVESTING";
            reason = `Surplus funds found. Recommending deposit of ${Number(metric.amount || 0) / 1e6} USDC.`;
        } else if (metric.recommendation === "WITHDRAW") {
            status = "WITHDRAWING";
            reason = `Profit target met! Net Profit $${metric.netProfit.toFixed(2)} > Withdraw Cost.`;
        } else if (metric.recommendation === "HOLD") {
            status = "HOLDING";
            if (metric.netProfit < 0) {
                reason = `Accumulating yield. Current Net Profit ($${metric.netProfit.toFixed(2)}) is negative due to gas costs.`;
            } else {
                reason = `Accumulating yield. Net Profit ($${metric.netProfit.toFixed(2)}) is below minimum threshold ($5.00).`;
            }
        } else if (metric.recommendation === "EMERGENCY_EXIT") {
            status = "EMERGENCY_EXIT";
            reason = "Operational funds critical. Liquidating position.";
        }

        res.json({
            status,
            metricRecommendation: metric.recommendation,
            reason,
            metrics: {
                totalValue: metric.currentValue,
                unrealizedGain: metric.unrealizedGain,
                netProfit: metric.netProfit,
                roi: metric.roiPercent,
                withdrawCost: metric.projectedWithdrawCost
            },
            balances,
            config
        });

    } catch (error: any) {
        console.error("Yield Status Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/yield/history
// Returns logs
router.get('/history', async (req: Request, res: Response) => {
    try {
        const { merchantId, limit = "20" } = req.query;
        // In singular Agent mode, we might not filter by merchantId on Decision if Agent is shared?
        // But YieldDecisionModel doesn't strictly have merchantId... wait.
        // YieldDecision has `agentAddress` and `vaultAddress`.
        // Ideally we filter by `scope` or link agentAddress to merchant.
        // For Phase F MVP, we return ALL decisions (assuming single merchant context for now) OR filter by time.
        // User request says "This data comes from YieldDecision collection".
        // Let's return recent 50.

        const decisions = await YieldDecisionModel.find()
            .sort({ issuedAt: -1 })
            .limit(Number(limit));

        res.json(decisions);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
