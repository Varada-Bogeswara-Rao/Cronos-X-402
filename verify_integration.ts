import { AgentClient } from "./share/AgentClient";
import { AGENT_CONFIG_DEFAULTS } from "./share/config";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
    console.log("🚀 Starting Integration Verification...");

    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        throw new Error("Missing PRIVATE_KEY in .env");
    }

    // 1. Configure Client
    const config = {
        privateKey: privateKey,
        rpcUrl: "https://evm-t3.cronos.org", // Testnet
        chainId: 338,
        usdcAddress: "0xc21223249ca28397b4b6541dffaecc539bff0c59", // Testnet USDC
        anchors: AGENT_CONFIG_DEFAULTS.anchors,
        strictPolicy: false // Warn only for now
    };

    console.log("🔌 Connecting to Cronos Testnet...");
    const client = new AgentClient(config);

    console.log(`✅ Client initialized for address: ${client.getAddress()}`);
    console.log("⏳ Waiting for on-chain policy check (async)...");

    // Wait a few seconds for the async constructor check to fire logs
    await new Promise(r => setTimeout(r, 5000));

    console.log("🏁 Verification complete. Check logs above for 'Policy verified' or 'Mismatch' messages.");
}

main().catch(err => {
    console.error("❌ Verification failed:", err);
    process.exit(1);
});
