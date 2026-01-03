import { AutoVvsAdapter } from "./yieldSources/AutoVvsAdapter";
import { ManualVvsAdapter } from "./yieldSources/ManualVvsAdapter";
import { TectonicAdapter } from "./yieldSources/TectonicAdapter";
import { TectonicCroAdapter } from "./yieldSources/TectonicCroAdapter";
import { WalletWatcher } from "./WalletWatcher";
import { FacilitatorLoop } from "./FacilitatorLoop";
import WalletSnapshot from "../models/WalletSnapshot";

export class YieldScheduler {
    private autoAdapter: AutoVvsAdapter;
    private manualAdapter: ManualVvsAdapter;
    private tectonicAdapter: TectonicAdapter;
    private tectonicCroAdapter: TectonicCroAdapter;
    private walletWatcher: WalletWatcher;
    private facilitatorLoop: FacilitatorLoop | null = null;
    private intervalId: NodeJS.Timeout | null = null;
    private intervalMs: number = 5 * 60 * 1000; // 5 minutes

    constructor() {
        this.autoAdapter = new AutoVvsAdapter();
        this.manualAdapter = new ManualVvsAdapter();
        this.tectonicAdapter = new TectonicAdapter();
        this.tectonicCroAdapter = new TectonicCroAdapter();
        this.walletWatcher = new WalletWatcher();

        const privateKey = process.env.FACILITATOR_PRIVATE_KEY;
        const agentAddr = process.env.AGENT_ADDRESS || "0x0000000000000000000000000000000000000000";

        if (privateKey) {
            this.facilitatorLoop = new FacilitatorLoop(this.walletWatcher, privateKey, agentAddr);
        } else {
            console.warn("⚠️ [YieldScheduler] Missing FACILITATOR_PRIVATE_KEY. Autonomy Disabled.");
        }
    }

    start() {
        if (this.intervalId) return;

        console.log("🕒 [YieldScheduler] Starting yield monitoring...");
        this.runSync();

        this.intervalId = setInterval(() => {
            this.runSync();
        }, this.intervalMs);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log("🛑 [YieldScheduler] Stopped.");
        }
    }

    private async runSync() {
        try {
            // 1. Sync Market Data & Wallet Snapshots
            await Promise.all([
                this.autoAdapter.fetchAndSync(),
                this.manualAdapter.fetchAndSync(),
                this.tectonicAdapter.fetchAndSync(),
                this.tectonicCroAdapter.fetchAndSync(),
                this.walletWatcher.snapshotAll()
            ]);

            // 2. Run Autonomy Loop (Brain)
            if (this.facilitatorLoop) {
                // Determine active merchants from recent snapshots
                const activeMerchants = await WalletSnapshot.distinct("merchantId");

                for (const merchantId of activeMerchants) {
                    await this.facilitatorLoop.runCycle(merchantId, false); // Live mode logic handled inside by Env flag
                }
            }

        } catch (error) {
            console.error("❌ [YieldScheduler] Sync Error:", error);
        }
    }
}
