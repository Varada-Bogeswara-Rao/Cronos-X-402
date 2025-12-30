import { ethers } from "ethers";
import { YieldSource } from "../../models/YieldSource";

const T_USDC_ADDRESS = "0xB3bbf1bE947b245Aef26e3B6a9D777d7703F4c8e";
const RPC_URL = "https://evm.cronos.org";
const CRONOS_CHAIN_ID = 25;

// Constants for Sanity Checks
const RATE_SANITY_MIN = BigInt(10) ** BigInt(14); // 0.0001
const RATE_SANITY_MAX = (BigInt(10) ** BigInt(18)) * BigInt(3) / BigInt(2); // 1.5

const ABI = [
    "function exchangeRateStored() view returns (uint256)",
    "function exchangeRateCurrent() returns (uint256)", // State-changing, usage via staticCall
    "function supplyRatePerBlock() view returns (uint256)"
];

export class TectonicAdapter {
    private provider: ethers.JsonRpcProvider;
    private tToken: ethers.Contract;
    private checksDone: boolean = false;

    constructor() {
        this.provider = new ethers.JsonRpcProvider(RPC_URL);
        this.tToken = new ethers.Contract(T_USDC_ADDRESS, ABI, this.provider);
    }

    private async ensureNetwork() {
        if (this.checksDone) return;
        const net = await this.provider.getNetwork();
        if (Number(net.chainId) !== CRONOS_CHAIN_ID) {
            throw new Error(`[Tectonic] Wrong ChainID! Expected ${CRONOS_CHAIN_ID}, got ${net.chainId}`);
        }
        this.checksDone = true;
    }

    async fetchAndSync(): Promise<void> {
        try {
            await this.ensureNetwork();

            // 1. Accurate Exchange Rate using staticCall (Simulate accureInterest)
            // Fallback to stored if staticCall fails
            let exchangeRate = BigInt(0);
            try {
                // @ts-ignore - staticCall check
                exchangeRate = await this.tToken.exchangeRateCurrent.staticCall();
            } catch (e: any) {
                console.warn(`[Tectonic] exchangeRateCurrent staticCall failed (${e.message}), falling back to stored.`);
                exchangeRate = await this.tToken.exchangeRateStored();
            }

            // Sanity Check Rate
            if (exchangeRate < RATE_SANITY_MIN || exchangeRate > RATE_SANITY_MAX) {
                throw new Error(`[Tectonic] Abnormal Exchange Rate detected: ${exchangeRate}. Aborting Sync.`);
            }

            const supplyRate = await this.tToken.supplyRatePerBlock();

            const now = Math.floor(Date.now() / 1000);

            // Active if providing any APY
            const status = supplyRate > BigInt(0) ? "ACTIVE" : "INACTIVE";

            // Annualized APY estimate (Block time ~5.7s on Cronos => ~5.5M blocks/year)
            const blocksPerYear = BigInt(5531914);
            const apyMantissa = BigInt(supplyRate) * blocksPerYear;
            const apyPercent = Number(apyMantissa) / 1e16; // 1e18 scale -> percent (100 = 1e18, 1 = 1e16)

            await YieldSource.findOneAndUpdate(
                { id: "TECTONIC_USDC" },
                {
                    id: "TECTONIC_USDC",
                    chainId: CRONOS_CHAIN_ID,
                    vaultAddress: T_USDC_ADDRESS,
                    type: "LENDING",
                    status: status,
                    executable: true, // It is executable (Supply/Redeem)
                    lastHarvestedAt: now,
                    pricePerShare: exchangeRate.toString(),

                    // New Fields for Hardening
                    supplyRatePerBlock: supplyRate.toString(),
                    estimatedAPY: `${apyPercent.toFixed(2)}%`,

                    // Realized Growth is technically supplyRate * 24h Blocks?
                    // But schema expects "growth since last check". 
                    // For lending, realizedGrowth24h implies simple interest for now.
                    realizedGrowth24h: apyPercent.toFixed(4),

                    pendingRewards: "0", // Auto-compounding
                    stakedAmount: "0", // Adapter doesn't know user stake, Executor handles that.
                    updatedAt: now
                },
                { upsert: true, new: true }
            );

            console.log(`✅ [Tectonic] Synced. Status: ${status}, APY: ${apyPercent.toFixed(2)}%`);
        } catch (error: any) {
            console.error("❌ [Tectonic] Sync Failed:", error.message);
        }
    }
}
