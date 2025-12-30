import { AutoVvsAdapter } from "./yieldSources/AutoVvsAdapter";
import { ManualVvsAdapter } from "./yieldSources/ManualVvsAdapter";
import { TectonicAdapter } from "./yieldSources/TectonicAdapter";
import { TectonicCroAdapter } from "./yieldSources/TectonicCroAdapter";

export class YieldScheduler {
    private autoAdapter: AutoVvsAdapter;
    private manualAdapter: ManualVvsAdapter;
    private tectonicAdapter: TectonicAdapter;
    private tectonicCroAdapter: TectonicCroAdapter;
    private intervalId: NodeJS.Timeout | null = null;
    private intervalMs: number = 5 * 60 * 1000; // 5 minutes

    constructor() {
        this.autoAdapter = new AutoVvsAdapter();
        this.manualAdapter = new ManualVvsAdapter();
        this.tectonicAdapter = new TectonicAdapter();
        this.tectonicCroAdapter = new TectonicCroAdapter();
    }

    start() {
        if (this.intervalId) return;

        console.log("🕒 [YieldScheduler] Starting yield monitoring...");
        // initial run
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
            await Promise.all([
                this.autoAdapter.fetchAndSync(),
                this.manualAdapter.fetchAndSync(),
                this.tectonicAdapter.fetchAndSync(),
                this.tectonicCroAdapter.fetchAndSync()
            ]);
        } catch (error) {
            console.error("❌ [YieldScheduler] Sync Error:", error);
        }
    }
}
