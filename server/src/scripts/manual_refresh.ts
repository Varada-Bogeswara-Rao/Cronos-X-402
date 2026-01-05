
import { connectDB } from "../config/db";
import { WalletWatcher } from "../services/WalletWatcher";
import dotenv from "dotenv";

dotenv.config();

async function main() {
    await connectDB();
    console.log("📸 forcing snapshot refresh from SERVER context...");

    const watcher = new WalletWatcher();
    await watcher.snapshotAll();

    console.log("✅ Snapshot Refreshed.");
    process.exit(0);
}

main().catch(console.error);
