import dotenv from 'dotenv';
import { WalletWatcher } from '../server/src/services/WalletWatcher';
import { ethers } from 'ethers';

dotenv.config({ path: 'server/.env' });

// Force local RPC for this test
process.env.CRONOS_RPC_URL = "http://127.0.0.1:8545";

async function main() {
    console.log("🕵️ Debugging WalletWatcher...");
    console.log(`📡 Connecting to: ${process.env.CRONOS_RPC_URL}`);

    const watcher = new WalletWatcher();

    // The address user funded
    const TARGET = "0xe3E0ef77E5Fdd925103250d52cF6cfc25e816624";

    console.log(`🎯 Fetching snapshot for ${TARGET}...`);
    try {
        const snap = await watcher.getSnapshot(TARGET);
        console.log("✅ Snapshot Result:");
        console.log(JSON.stringify(snap, null, 2));

        const usdc = Number(ethers.formatUnits(snap.usdcBalance, 6));
        const cro = Number(ethers.formatEther(snap.croBalance));

        console.log("---------------------------------------------------");
        console.log(`💰 USDC Balance: $${usdc.toFixed(2)}`);
        console.log(`⛽ CRO Balance:  ${cro.toFixed(2)} CRO`);
        console.log("---------------------------------------------------");

        if (usdc > 4000) {
            console.log("✅ SUCCESS: Real Fork Data Detected!");
        } else {
            console.log("❌ FAILURE: Still seeing low/zero balance. Fork connection issue?");
        }

    } catch (e) {
        console.error("❌ Error fetching snapshot:", e);
    }
}

main();
