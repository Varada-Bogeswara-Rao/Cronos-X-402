// demo.ts
import "dotenv/config";
import { AgentWallet } from "./AgentWallet";
import { CronosUsdcExecutor } from "./CronosUsdcExecutor";
import { x402Request } from "./x402ToolClient";

async function run() {
  // --------------------------------------------------
  // 1. TARGET = MERCHANT API (NOT gateway, NOT coingecko)
  // --------------------------------------------------

  // If merchant is running locally
  const MERCHANT_API_URL = "http://localhost:3001";

  // If merchant is deployed, use that instead:
  // const MERCHANT_API_URL = "https://<merchant-backend>.up.railway.app";

  const TARGET_PATH = "/users";
  const FULL_URL = `${MERCHANT_API_URL}${TARGET_PATH}`;

  // --------------------------------------------------
  // 2. Agent / Chain Configuration
  // --------------------------------------------------

  const RPC_URL =
    process.env.CRONOS_RPC_URL || "https://evm-t3.cronos.org";

  const USDC_ADDR =
    process.env.USDC_CONTRACT_ADDRESS ||
    "0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0";

  const PRIVATE_KEY = process.env.AGENT_WALLET_PRIVATE_KEY;

  if (!PRIVATE_KEY) {
    throw new Error("Missing AGENT_WALLET_PRIVATE_KEY in .env");
  }

  // --------------------------------------------------
  // 3. Initialize Autonomous Agent
  // --------------------------------------------------

  const executor = new CronosUsdcExecutor(
    RPC_URL,
    PRIVATE_KEY,
    USDC_ADDR
  );

  const wallet = new AgentWallet(executor);
  const agentAddress = await wallet.getAddress();

  console.log("--------------------------------------------------");
  console.log(`🤖 AGENT ONLINE: ${agentAddress}`);
  console.log(`🎯 TARGET API: ${FULL_URL}`);
  console.log("--------------------------------------------------");

  try {
    console.log(`[x402] Negotiating access for: ${TARGET_PATH}...`);

    // --------------------------------------------------
    // 4. x402 Autonomous Handshake
    // --------------------------------------------------
    // Flow:
    // 1. Agent hits Merchant API
    // 2. Merchant Middleware returns 402 + headers
    // 3. Agent pays USDC on Cronos
    // 4. Facilitator verifies
    // 5. Merchant unlocks data
    // --------------------------------------------------

    const result = await x402Request(
      FULL_URL,
      wallet,
      {
        network: "cronos-testnet",

        // IMPORTANT:
        // This merchantId MUST match the one used in
        // the merchant backend middleware configuration
        merchantId: "b9805b9e-fa6c-4640-8470-f5b230dee6d4"
      }
    );

    // --------------------------------------------------
    // 5. Display Result
    // --------------------------------------------------

    console.log("\n✅ [PAYMENT VERIFIED & DATA RECEIVED]");
    console.log("--------------------------------------------------");
    console.dir(result, { depth: null });
    console.log("--------------------------------------------------");

  } catch (error: any) {
    console.error("\n❌ [TRANSACTION FAILED]");

    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error("Message:", error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

run();
