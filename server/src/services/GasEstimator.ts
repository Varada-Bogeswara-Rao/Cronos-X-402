import { ethers } from "ethers";

/**
 * NOTE:
 * GasEstimator uses conservative fixed gas unit estimates.
 * It is designed for decision-making heuristics,
 * NOT exact accounting or billing.
 */

export interface GasCosts {
    approve: number;  // USD
    deposit: number;  // USD
    withdraw: number; // USD
    swap: number;     // USD
    gasPrice: string; // Wei
    croPrice: number; // USD
}

export class GasEstimator {
    private provider: ethers.JsonRpcProvider;

    // Fixed estimates for standard operations (Gas Units)
    private readonly UNITS = {
        APPROVE: 45_000n,
        DEPOSIT: 150_000n,
        WITHDRAW: 150_000n,
        SWAP: 180_000n
    };

    // Stub for CRO Price (Mock Oracle)
    // In production, fetch from Band/Chainlink or API
    private readonly CRO_PRICE_USD = 0.10;

    constructor() {
        const rpcUrl = process.env.CRONOS_RPC_URL || "https://evm-t3.cronos.org";
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
    }

    /**
     * Get estimated cost for all action types in USD
     */
    async getEstimates(): Promise<GasCosts> {
        let gasPrice = 5000000000000n; // Fallback 5000 Gwei (TCRO is expensive, Cronos is cheap)

        try {
            const feeData = await this.provider.getFeeData();
            if (feeData.gasPrice) {
                gasPrice = feeData.gasPrice;
            }
        } catch (e) {
            console.warn("[GasEstimator] Failed to fetch gas price, using fallback", e);
        }

        // Formula: (Units * GasPrice * CroPrice) / 1e18
        const calculateUsd = (units: bigint) => {
            const costInWei = units * gasPrice;
            const costInCro = Number(ethers.formatEther(costInWei));
            return costInCro * this.CRO_PRICE_USD;
        };

        return {
            approve: calculateUsd(this.UNITS.APPROVE),
            deposit: calculateUsd(this.UNITS.DEPOSIT),
            withdraw: calculateUsd(this.UNITS.WITHDRAW),
            swap: calculateUsd(this.UNITS.SWAP),
            gasPrice: gasPrice.toString(),
            croPrice: this.CRO_PRICE_USD
        };
    }
}
