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

  // 🐳 IMPERSONATION FOR TESTING (User Request)
  // We use this top-tier staker to see real non-zero yield numbers
  const WHALE_ADDR = "0xb0F8b79a06662D6c165Bf67B4A7DE963aaf9ec50";
  const mockWhaleWallet = { address: WHALE_ADDR } as any as ethers.Wallet;

  const yieldExec = new VvsYieldExecutor(provider, mockWhaleWallet);

  console.log("--------------------------------------------------");
  console.log(`🤖 AGENT: ${ethersWallet.address}`);
  console.log(`🕵️  YIELD SENSOR MIMIC: ${WHALE_ADDR}`);
  console.log("🌱 AutoVVS Vault: read-only position");
  console.log("--------------------------------------------------");

  try {
    const pos = await yieldExec.getVaultPosition();

    console.log("📊 Vault Position (RAW):", {
      shares: pos.shares.toString(),
      pricePerShare: pos.pricePerShare.toString(),
      underlyingValue: pos.underlyingValue.toString()
    });


    // --------------------------------------------------
    // Snapshot & Delta Logic (Phase 5B Prep)
    // --------------------------------------------------
    const { saveSnapshot, loadSnapshots } = await import("./internal/yield/SnapshotStore");
    const { computeYieldDelta } = await import("./internal/yield/computeDelta");

    const snapshot = {
      agentAddress: mockWhaleWallet.address,
      vaultAddress: "0xA6fF77fC8E839679D4F7408E8988B564dE1A2dcD",
      shares: pos.shares,
      underlyingValue: pos.underlyingValue,
      timestamp: Math.floor(Date.now() / 1000)
    };

    saveSnapshot(snapshot);

    const snapshots = loadSnapshots();
    if (snapshots.length >= 2) {
      const prev = snapshots[snapshots.length - 2];
      const delta = computeYieldDelta(prev, snapshot);

      const deltaReadable = ethers.formatUnits(delta.deltaUnderlying, 18);
      console.log("--------------------------------------------------");
      console.log(`✨ New Yield Earned: ${deltaReadable} VVS`);
      console.log(`⏱️  Time Elapsed:     ${delta.deltaTimeSec}s`);
      console.log("--------------------------------------------------");
    } else {
      console.log("ℹ️  First snapshot recorded. Run again to see yield growth.");
    }

    // --------------------------------------------------
    // Decision Ingestion (Phase 5B)
    // --------------------------------------------------
    const { verifyYieldDecision } = await import("./internal/yield/verifyYieldDecision");
    const { saveDecision } = await import("./internal/yield/DecisionStore");
    const fs = await import("fs");
    const path = await import("path");

    const DECISION_FILE = path.join(process.cwd(), "decision.json");
    const FACILITATOR_ADDR = "0x14791697260E4c9A71f18484C9f997B308e59325"; // Hardcoded for Demo

    if (fs.existsSync(DECISION_FILE)) {
      console.log("--------------------------------------------------");
      console.log("📥 Ingesting Decision from decision.json...");

      try {
        const raw = fs.readFileSync(DECISION_FILE, "utf-8");
        const decision = JSON.parse(raw);

        // 1. Verify
        verifyYieldDecision(decision, FACILITATOR_ADDR);
        console.log("✅ Signature Verified against Facilitator");

        // 2. Store (State = INGESTED)
        saveDecision(decision);
        console.log("✅ Decision Stored (Status: INGESTED)");
        console.log("   Action:", decision.action);
        console.log("   Amount:", decision.amount);

        // Clean up to prevent duplicate processing in this demo loop
        // In real app, we might move/archive it.
        // fs.unlinkSync(DECISION_FILE); 

      } catch (error: any) {
        console.error("❌ Decision Rejected:", error.message);
      }
      console.log("--------------------------------------------------");
    }

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
