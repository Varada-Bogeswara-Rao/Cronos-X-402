// demo.ts
import "dotenv/config";
import { AgentWallet } from "./internal/AgentWallet";
import { CronosUsdcExecutor } from "./internal/CronosUsdcExecutor";
import { x402Request } from "./internal/x402ToolClient";

async function run() {
  // --------------------------------------------------
  // 1. TARGET = MERCHANT API (NOT gateway, NOT coingecko)
  // --------------------------------------------------

  // If merchant is running locally
  const MERCHANT_API_URL = "http://localhost:3001";

  // If merchant is deployed, use that instead:
  // const MERCHANT_API_URL = "https://<merchant-backend>.up.railway.app";

  const TARGET_PATH = "/photos";
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
    USDC_ADDR,
    338 // Expected Chain ID (Cronos Testnet)
  );

  // Derive address from private key for the wallet config
  // (In a real scenario, the executor might expose this, but we'll re-derive here for simplicity)
  // or add a getter to executor.
  // Actually, CronosUsdcExecutor has a wallet but it's private.
  // Let's just create a quick separate wallet instance to get the address, 
  // OR since we are inside demo.ts, we can just use ethers directly if we import it, 
  // OR we can assume we know it.

  // Cleanest way without importing ethers in demo.ts if not needed:
  // Add `getWalletAddress()` to CronosUsdcExecutor.
  // BUT I don't want to edit Executor again if I can avoid it.

  // Wait, I can just use a helper or trust the user knows it? No.
  // Let's import ethers here properly.

  const { ethers } = require("ethers");
  const tempWallet = new ethers.Wallet(PRIVATE_KEY);
  const agentAddress = tempWallet.address;

  const wallet = new AgentWallet(agentAddress, executor);

  console.log("--------------------------------------------------");
  console.log(`🤖 AGENT ONLINE: ${agentAddress}`);
  console.log(`🎯 TARGET API: ${FULL_URL}`);
  console.log("--------------------------------------------------");

  console.log(`[x402] Negotiating access for: ${TARGET_PATH}...`);

  // --------------------------------------------------
  // 4. x402 Autonomous Handshake
  // --------------------------------------------------

  // --------------------------------------------------
  // 4. x402 Autonomous Handshake
  // --------------------------------------------------

  try {
    const result = await x402Request(
      FULL_URL,
      wallet,
      {
        chainId: 338,
        merchantId: "b9805b9e-fa6c-4640-8470-f5b230dee6d4"
      },
      {} // Empty options/headers
    );
    console.log(`✅ Success! Data Received:`);
    console.dir(result, { depth: null });
  } catch (error: any) {
    console.error(`❌ Failed: ${error.message}`);
  }
}

run();
