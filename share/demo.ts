// demo.ts
import "dotenv/config";
import { AgentWallet } from "./internal/AgentWallet";
import { CronosUsdcExecutor } from "./internal/CronosUsdcExecutor";
import { x402Request } from "./internal/x402ToolClient";
import { ethers } from "ethers";
import { VvsYieldExecutor } from "./internal/VvsYieldExecutor";

async function run() {
  // --------------------------------------------------
  // 1. Merchant API
  // --------------------------------------------------

  const MERCHANT_API_URL = "http://localhost:3001";
  const TARGET_PATH = "/photos";
  const FULL_URL = `${MERCHANT_API_URL}${TARGET_PATH}`;

  // --------------------------------------------------
  // 2. RPCs
  // --------------------------------------------------

  const MAINNET_RPC = "https://evm.cronos.org";
  const TESTNET_RPC =
    process.env.CRONOS_RPC_URL || "https://evm-t3.cronos.org";

  const USDC_ADDR =
    process.env.USDC_CONTRACT_ADDRESS ||
    "0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0";

  const PRIVATE_KEY = process.env.AGENT_WALLET_PRIVATE_KEY;
  if (!PRIVATE_KEY) throw new Error("Missing AGENT_WALLET_PRIVATE_KEY");

  // --------------------------------------------------
  // 3. Agent (payments)
  // --------------------------------------------------

  const paymentExecutor = new CronosUsdcExecutor(
    TESTNET_RPC,
    PRIVATE_KEY,
    USDC_ADDR,
    338
  );

  const wallet = new AgentWallet(
    new ethers.Wallet(PRIVATE_KEY).address,
    paymentExecutor
  );

  // --------------------------------------------------
  // 4. AutoVVS Yield Sensor (Mainnet)
  // --------------------------------------------------

  const provider = new ethers.JsonRpcProvider(MAINNET_RPC);
  const ethersWallet = new ethers.Wallet(PRIVATE_KEY, provider);

  const yieldExec = new VvsYieldExecutor(provider, ethersWallet);

  console.log("--------------------------------------------------");
  console.log(`🤖 AGENT: ${ethersWallet.address}`);
  console.log("🌱 AutoVVS Vault: read-only position");
  console.log("--------------------------------------------------");

  try {
    const pos = await yieldExec.getVaultPosition();

    console.log("📊 Vault Position (RAW):", {
      shares: pos.shares.toString(),
      pricePerShare: pos.pricePerShare.toString(),
      underlyingValue: pos.underlyingValue.toString()
    });

    console.log(
      "📊 Underlying (formatted, 18d):",
      ethers.formatUnits(pos.underlyingValue, 18)
    );
  } catch (err: any) {
    console.error("❌ AutoVVS sensor error:", err.message);
  }

  // --------------------------------------------------
  // 5. x402 flow (unchanged)
  // --------------------------------------------------

  console.log(`[x402] Negotiating access for: ${TARGET_PATH}...`);

  try {
    const result = await x402Request(
      FULL_URL,
      wallet,
      {
        chainId: 338,
        merchantId: "b9805b9e-fa6c-4640-8470-f5b230dee6d4"
      },
      {}
    );

    console.log("✅ Success! Data Received:");
    console.dir(result, { depth: null });
  } catch (error: any) {
    console.error(`❌ Failed: ${error.message}`);
  }
}

run();
