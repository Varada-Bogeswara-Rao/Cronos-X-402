import dotenv from 'dotenv';
import { WalletWatcher } from '../services/WalletWatcher';
import { ethers } from 'ethers';
import path from 'path';

// Explicitly load .env from root of server
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Force local RPC for this test
process.env.CRONOS_RPC_URL = "http://127.0.0.1:8545";

async function main() {
    console.log("🕵️ Debugging WalletWatcher (Server Context)...");
    console.log(`📡 Connecting to: ${process.env.CRONOS_RPC_URL}`);

    const watcher = new WalletWatcher();

    const TARGET = "0xe3E0ef77E5Fdd925103250d52cF6cfc25e816624";

    console.log(`🎯 Fetching snapshot for ${TARGET}...`);
    try {
        const snap = await watcher.getSnapshot(TARGET);

        console.log("✅ Snapshot Result:");
        // Plain logging to avoid circular structures
        console.log(snap);

        const usdc = Number(ethers.formatUnits(snap.usdcBalance, 6));
        const cro = Number(ethers.formatEther(snap.croBalance));

        console.log("---------------------------------------------------");
        console.log(`💰 USDC Balance: $${usdc.toFixed(2)}`);
        console.log(`⛽ CRO Balance:  ${cro.toFixed(2)} CRO`);
        console.log("---------------------------------------------------");

        if (usdc > 4000) {
            console.log("✅ SUCCESS: Real Fork Data Detected!");
        } else {
            console.log("❌ FAILURE: Low/Zero balance. Fork connection issue?");
        }

    } catch (e) {
        console.error("❌ Error fetching snapshot:", e);
    }
}

main();
