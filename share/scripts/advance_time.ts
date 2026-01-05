
import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

async function main() {
    const rpcUrl = process.env.CRONOS_RPC_URL || "http://127.0.0.1:8545";
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    console.log("⏳ Current Block:", await provider.getBlockNumber());

    // Advance time by 60 Days (60 * 60 * 24 * 60)
    const ACCEL_SECONDS = 60 * 60 * 24 * 60;

    console.log(`⏩ Warping chain forward by ${ACCEL_SECONDS} seconds (60 Days)...`);

    await provider.send("evm_increaseTime", [ACCEL_SECONDS]);
    await provider.send("evm_mine", []); // Mine a block to solidify the new time

    console.log("✅ Time Travel Complete.");
    console.log("⏳ New Block:", await provider.getBlockNumber());
    console.log("💡 Yield should now be visible on the Dashboard.");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
