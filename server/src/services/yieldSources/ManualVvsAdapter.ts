import { ethers } from "ethers";
import { YieldSource } from "../../models/YieldSource";

const CRAFTSMAN_ADDR = "0xDccd6455AE04b03d785F12196B492b18129564bc"; // VVS Craftsman V3
const WHALE_ADDR = "0xA6fF77fC8E839679D4F7408E8988B564dE1A2dcD"; // AutoVault (has balance in PID 0)
const RPC_URL = "https://evm.cronos.org";
const POOL_ID = 0;

const ABI = [
    "function pendingVVS(uint256 pid, address user) view returns (uint256)",
    "function userInfo(uint256 pid, address user) view returns (uint256 amount, uint256 rewardDebt)"
];

export class ManualVvsAdapter {
    private provider: ethers.JsonRpcProvider;
    private craftsman: ethers.Contract;

    constructor() {
        this.provider = new ethers.JsonRpcProvider(RPC_URL);
        this.craftsman = new ethers.Contract(CRAFTSMAN_ADDR, ABI, this.provider);
    }

    async fetchAndSync(): Promise<void> {
        try {
            console.log(`🔍 [ManualVVS] Fetching data for Whale ${WHALE_ADDR}...`);

            const [pending, userInfo] = await Promise.all([
                this.craftsman.pendingVVS(POOL_ID, WHALE_ADDR).catch((e: any) => {
                    console.error("❌ pendingVVS error:", e.message);
                    return BigInt(0);
                }),
                this.craftsman.userInfo(POOL_ID, WHALE_ADDR).catch((e: any) => {
                    console.error("❌ userInfo error:", e.message);
                    return [BigInt(0), BigInt(0)];
                })
            ]);

            console.log(`   Pending: ${pending}, Staked: ${userInfo[0]}`);

            const stakedAmount = userInfo[0]; // amount is first return value
            const pendingBigInt = BigInt(pending);
            const now = Math.floor(Date.now() / 1000);

            // Get previous state to calculate delta
            const previousState = await YieldSource.findOne({ id: "MANUAL_VVS" });

            let status = "INACTIVE";
            let delta = BigInt(0);

            if (previousState) {
                const prevPending = BigInt(previousState.pendingRewards);
                delta = pendingBigInt - prevPending;

                // Mark ACTIVE if rewards grew since last check
                if (delta > BigInt(0)) {
                    status = "ACTIVE";
                } else if (previousState.status === "ACTIVE" && delta === BigInt(0)) {
                    // Keep active if flat for one cycle, or logic can be stricter
                    // For now, strict: if not growing, inactive. Or maybe "ACTIVE" if total > 0?
                    // User Request: "ACTIVE based on delta growth"
                    status = delta > BigInt(0) ? "ACTIVE" : "INACTIVE";
                }
            } else {
                // First run, can't measure growth yet
                status = "INACTIVE";
            }

            await YieldSource.findOneAndUpdate(
                { id: "MANUAL_VVS" },
                {
                    id: "MANUAL_VVS",
                    chainId: 25,
                    vaultAddress: CRAFTSMAN_ADDR,
                    type: "FARM",
                    status: status,
                    executable: false, // Read-only baseline
                    // Manual VVS doesn't have "harvest" time on contract in same way, 
                    // usually we track when user last acted. For monitoring, we just use 'now' or 0.
                    lastHarvestedAt: 0,
                    pricePerShare: "1000000000000000000", // 1:1 for manual staking usually
                    realizedGrowth24h: delta.toString(), // Storing delta in this field for visibility
                    pendingRewards: pendingBigInt.toString(),
                    stakedAmount: stakedAmount.toString(),
                    updatedAt: now
                },
                { upsert: true, new: true }
            );

            console.log(`✅ [ManualVVS] Synced. Status: ${status}, Delta: ${ethers.formatEther(delta)} VVS`);
        } catch (error: any) {
            console.error("❌ [ManualVVS] Sync Failed:", error.message);
        }
    }
}
