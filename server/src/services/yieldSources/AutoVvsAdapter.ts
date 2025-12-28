import { ethers } from "ethers";
import { YieldSource } from "../../models/YieldSource";

const AUTO_VVS_VAULT = "0xA6fF77fC8E839679D4F7408E8988B564dE1A2dcD";
const RPC_URL = "https://evm.cronos.org";

// Minimal Read-Only ABI
const ABI = [
    "function getPricePerFullShare() view returns (uint256)",
    "function lastHarvestedTime() view returns (uint256)",
    "function calculateTotalPendingVVSRewards() view returns (uint256)"
];

export class AutoVvsAdapter {
    private provider: ethers.JsonRpcProvider;
    private vault: ethers.Contract;

    constructor() {
        this.provider = new ethers.JsonRpcProvider(RPC_URL);
        this.vault = new ethers.Contract(AUTO_VVS_VAULT, ABI, this.provider);
    }

    async fetchAndSync(): Promise<void> {
        try {
            console.log("🔍 [AutoVVS] Fetching vault data...");

            const [pps, lastHarvested, pending] = await Promise.all([
                this.vault.getPricePerFullShare(),
                this.vault.lastHarvestedTime(),
                this.vault.calculateTotalPendingVVSRewards().catch(() => BigInt(0)) // Handle revert gracefully
            ]);

            const now = Math.floor(Date.now() / 1000);

            // Check inactive (Threshold: 24 hours without harvest)
            const INACTIVE_THRESHOLD = 24 * 60 * 60;
            const timeSinceHarvest = now - Number(lastHarvested);
            const status = timeSinceHarvest > INACTIVE_THRESHOLD ? "INACTIVE" : "ACTIVE";

            // Calculate Realized Growth (vs stored snapshot)
            // ideally we would query previous snapshots here, but for now we just store 0 or query 24h ago
            // For MVP, simplistic: Realized Growth is 0 if status is inactive.
            const realizedGrowth = "0";

            await YieldSource.findOneAndUpdate(
                { id: "AUTO_VVS" },
                {
                    id: "AUTO_VVS",
                    chainId: 25,
                    vaultAddress: AUTO_VVS_VAULT,
                    type: "AUTO_COMPOUND",
                    status: status,
                    executable: false,
                    lastHarvestedAt: Number(lastHarvested),
                    pricePerShare: pps.toString(),
                    realizedGrowth24h: realizedGrowth,
                    pendingRewards: pending.toString(),
                    updatedAt: now
                },
                { upsert: true, new: true }
            );

            console.log(`✅ [AutoVVS] Synced. Status: ${status}, Last Harvest: ${timeSinceHarvest}s ago`);
        } catch (error: any) {
            console.error("❌ [AutoVVS] Sync Failed:", error.message);
        }
    }
}
