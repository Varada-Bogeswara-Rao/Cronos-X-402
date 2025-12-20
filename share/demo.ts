// demo.ts
import "dotenv/config";
import { AgentWallet } from "./AgentWallet";
import { CronosUsdcExecutor } from "./CronosUsdcExecutor";
import { x402Request } from "./x402ToolClient";

async function run() {
  // ---- 1. Configuration ----
  // Use your live Railway URL as the base
  const GATEWAY_URL = "https://cronos-x-402-production.up.railway.app";

  // The specific API path you want to buy (must be registered in your DB)
  const TARGET_PATH = "/api/v3/simple/price?ids=bitcoin&vs_currencies=usd";
  const FULL_URL = `${GATEWAY_URL}${TARGET_PATH}`;

  const RPC_URL = process.env.CRONOS_RPC_URL || "https://evm-t3.cronos.org";
  const USDC_ADDR = process.env.USDC_CONTRACT_ADDRESS || "0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0";
  const PRIVATE_KEY = process.env.AGENT_WALLET_PRIVATE_KEY;

  if (!PRIVATE_KEY) {
    throw new Error("Missing AGENT_WALLET_PRIVATE_KEY in .env");
  }

  // ---- 2. Initialize the Autonomous Agent ----
  const executor = new CronosUsdcExecutor(
    RPC_URL,
    PRIVATE_KEY,
    USDC_ADDR
  );

  const wallet = new AgentWallet(executor);
  const agentAddress = await wallet.getAddress();

  console.log("--------------------------------------------------");
  console.log(`🤖 AGENT ONLINE: ${agentAddress}`);
  console.log(`📡 CONNECTED TO: ${GATEWAY_URL}`);
  console.log("--------------------------------------------------");

  try {
    console.log(`[x402] Negotiating access for: ${TARGET_PATH}...`);

    // ---- 3. The Autonomous Handshake ----
    // This will:
    // 1. Hit Railway -> Receive 402 Payment Required
    // 2. Sign & Send USDC on Cronos Testnet
    // 3. Retry with Proof -> Railway verifies on-chain -> Data released
    const result = await x402Request(
      FULL_URL,
      wallet,
      {
        network: "cronos-testnet",
        // Pass the merchantId so the Gateway knows which config to use
        // Replace 'YOUR_MERCHANT_ID' with the UUID from your registration
        merchantId: "f0647c81-f93a-4fb9-8b66-062c61e7820f"
      }
          
    );

    // ---- 4. Result Display ----
    console.log("\n✅ [PAYMENT VERIFIED & DATA RECEIVED]");
    console.log("--------------------------------------------------");
    console.table(result);
    console.log("--------------------------------------------------");

  } catch (error: any) {
    console.error("\n❌ [TRANSACTION FAILED]");
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Message:`, error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

run();