import { ethers } from "ethers";
import { YieldSource } from "../../models/YieldSource";

const T_USDC_ADDRESS = "0xB3bbf1bE947b245Aef26e3B6a9D777d7703F4c8e";
const RPC_URL = "https://evm.cronos.org";

const ABI = [
    "function exchangeRateStored() view returns (uint256)",
    "function supplyRatePerBlock() view returns (uint256)"
];

export class TectonicAdapter {
    private provider: ethers.JsonRpcProvider;
    private tToken: ethers.Contract;

    constructor() {
        this.provider = new ethers.JsonRpcProvider(RPC_URL);
        this.tToken = new ethers.Contract(T_USDC_ADDRESS, ABI, this.provider);
    }

    async fetchAndSync(): Promise<void> {
        try {
            console.log("🔍 [Tectonic] Fetching global supply data...");

            const [exchangeRate, supplyRate] = await Promise.all([
                this.tToken.exchangeRateStored(),
                this.tToken.supplyRatePerBlock()
            ]);

            const now = Math.floor(Date.now() / 1000);

            // Active if providing any APY
            const status = supplyRate > BigInt(0) ? "ACTIVE" : "INACTIVE";

            // Annualized APY estimate (Block time ~5.7s on Cronos)
            // Rate * BlocksPerYear
            // This is just metadata for the UI/System

            await YieldSource.findOneAndUpdate(
                { id: "TECTONIC_USDC" },
                {
                    id: "TECTONIC_USDC",
                    chainId: 25,
                    vaultAddress: T_USDC_ADDRESS,
                    type: "LENDING",
                    status: status,
                    executable: true, // It is executable (Supply/Redeem)
                    lastHarvestedAt: now, // Continuous, so "now"
                    pricePerShare: exchangeRate.toString(),
                    // Realized growth is continuous, we track the rate here
                    realizedGrowth24h: supplyRate.toString(),
                    pendingRewards: "0", // Base yield is auto-compounding
                    updatedAt: now
                },
                { upsert: true, new: true }
            );

            console.log(`✅ [Tectonic] Synced. Status: ${status}, SupplyRate: ${supplyRate}`);
        } catch (error: any) {
            console.error("❌ [Tectonic] Sync Failed:", error.message);
        }
    }
}
