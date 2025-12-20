// demo.ts
import "dotenv/config";
import { AgentWallet } from "./AgentWallet";
import { CronosUsdcExecutor } from "./CronosUsdcExecutor";
import { x402Request } from "./x402ToolClient";

async function run() {
  // ---- 1. Safety checks ----
  const RPC_URL = process.env.CRONOS_RPC_URL || "https://evm-t3.cronos.org";
  const USDC_ADDR = process.env.USDC_CONTRACT_ADDRESS || "0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0";
  const PRIVATE_KEY = process.env.AGENT_WALLET_PRIVATE_KEY;

  if (!PRIVATE_KEY) {
    throw new Error("Missing AGENT_WALLET_PRIVATE_KEY in .env");
  }

  // ---- 2. Initialize the "Economic Agent" ----
  const executor = new CronosUsdcExecutor(
    RPC_URL,
    PRIVATE_KEY,
    USDC_ADDR
  );

  const wallet = new AgentWallet(executor);
  const agentAddress = await wallet.getAddress();

  console.log("--------------------------------------------------");
  console.log(`🤖 AGENT ACTIVE: ${agentAddress}`);
  console.log(`🌐 NETWORK: Cronos Testnet (338)`);
  console.log("--------------------------------------------------");

  // ---- 3. Target the Merchant's Monetized API ----
  // UPDATE THIS: Use the exact path you registered in your Merchant Form
  const targetUrl = "http://localhost:5000/api/v3/simple/price";

  console.log(`[x402] Attempting to fetch: ${targetUrl}`);

  // ---- 4. Execute the Autonomous Handshake ----
  // This function will:
  // 1. Try GET -> Receive 402
  // 2. Extract price/payTo from headers
  // 3. Use CronosUsdcExecutor to pay on-chain
  // 4. Retry GET with X-Payment-Proof & X-Payment-Payer
  const result = await x402Request(
    targetUrl,
    wallet,
    { network: "cronos-testnet" },
    { "X-Merchant-Id": "f0647c81-f93a-4fb9-8b66-062c61e7820f" }
  );

  // ---- 5. Display Results ----
  console.log("\n✅ [DEMO SUCCESS]");
  console.log("--------------------------------------------------");
  console.log("PAYMENT VERIFIED BY FACILITATOR");
  console.log("DATA RECEIVED:");
  console.table(result); // Pretty print the price data
  console.log("--------------------------------------------------");

  console.log("\n🚀 Check your Merchant Dashboard! You should see +0.05 USDC.");
}

run().catch((err) => {
  console.error("\n❌ [DEMO ERROR]");
  if (err.response) {
    console.error("Status:", err.response.status);
    console.error("Data:", JSON.stringify(err.response.data, null, 2));
  } else {
    console.error(err.message);
  }
  process.exit(1);
});