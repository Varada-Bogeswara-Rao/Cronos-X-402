
import { connectDB } from "../../server/src/config/db";
import { WalletWatcher } from "../../server/src/services/WalletWatcher";
import dotenv from "dotenv";

dotenv.config();

async function main() {
    await connectDB();
    console.log("📸 forcing snapshot refresh...");

    const watcher = new WalletWatcher();
    await watcher.snapshotAll();

    console.log("✅ Snapshot Refreshed.");
    process.exit(0);
}

main().catch(console.error);
