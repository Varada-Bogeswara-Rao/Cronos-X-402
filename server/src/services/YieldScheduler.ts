
import { AutoVvsAdapter } from "./yieldSources/AutoVvsAdapter";

export class YieldScheduler {
    private adapter: AutoVvsAdapter;
    private intervalId: NodeJS.Timeout | null = null;
    private intervalMs: number = 5 * 60 * 1000; // 5 minutes

    constructor() {
        this.adapter = new AutoVvsAdapter();
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
            await this.adapter.fetchAndSync();
        } catch (error) {
            console.error("❌ [YieldScheduler] Sync Error:", error);
        }
    }
}
