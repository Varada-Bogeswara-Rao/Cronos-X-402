
import "dotenv/config";
import fs from "fs";
import path from "path";
import { ethers } from "ethers";

// Types
import { StoredDecision } from "./internal/yield/YieldDecision";
import { verifyYieldDecision } from "./internal/yield/verifyYieldDecision";
import { VvsYieldExecutor } from "./internal/VvsYieldExecutor";

// Config (Should match demo/env)
const MAINNET_RPC = "https://evm.cronos.org";
const DECISIONS_FILE = path.join(process.cwd(), "yield_decisions.json");
const FACILITATOR_ADDR = "0x14791697260E4c9A71f18484C9f997B308e59325"; // Demo Facilitator
const AGENT_PRIVATE_KEY = process.env.AGENT_WALLET_PRIVATE_KEY; // Only needed here for execution

if (!AGENT_PRIVATE_KEY) {
    console.error("❌ Missing AGENT_WALLET_PRIVATE_KEY in .env");
    process.exit(1);
}

// --------------------------------------------------
// HELPERS
// --------------------------------------------------
function loadDecisions(): StoredDecision[] {
    if (!fs.existsSync(DECISIONS_FILE)) return [];
    return JSON.parse(fs.readFileSync(DECISIONS_FILE, "utf-8"));
}

function updateDecision(nonce: string, txHash: string) {
    const decisions = loadDecisions();
    const index = decisions.findIndex(d => d.nonce === nonce);
    if (index === -1) return;

    decisions[index].status = "EXECUTED";
    decisions[index].txHash = txHash;
    decisions[index].executedAt = Math.floor(Date.now() / 1000);

    fs.writeFileSync(DECISIONS_FILE, JSON.stringify(decisions, null, 2));
    console.log(`💾 Decision ${nonce} marked as EXECUTED.`);
}

// --------------------------------------------------
// MAIN MOTOR
// --------------------------------------------------
async function run() {
    console.log("--------------------------------------------------");
    console.log("⚙️  PHASE 6: AUTHORIZED EXECUTION MOTOR");
    console.log("--------------------------------------------------");

    // 1. Setup Executor
    const provider = new ethers.JsonRpcProvider(MAINNET_RPC);
    const wallet = new ethers.Wallet(AGENT_PRIVATE_KEY!, provider);
    const executor = new VvsYieldExecutor(provider, wallet);

    console.log(`🤖 Agent: ${wallet.address}`);

    // 2. Load Decisions
    const allDecisions = loadDecisions();
    const candidates = allDecisions.filter(d =>
        d.status === "INGESTED" &&
        d.decision === "APPROVE" &&
        d.action === "WITHDRAW" &&
        d.expiresAt > Math.floor(Date.now() / 1000)
    );

    if (candidates.length === 0) {
        console.log("zzz No actionable decisions found.");
        return;
    }

    console.log(`🔍 Found ${candidates.length} candidate(s). Processing first one...`);
    const decision = candidates[0];

    // 3. THE GUARD (Verify Again)
    try {
        console.log(`🛡️  Verifying Nonce: ${decision.nonce}`);
        verifyYieldDecision(decision, FACILITATOR_ADDR); // Checks expiry, scope, signature

        if (decision.chainId !== 25) throw new Error("Chain ID Mismatch (Expected 25)");

        // Note: Vault Address check is implicit in VvsYieldExecutor constructor default, 
        // but strictly we should check it against the decision.vaultAddress if dynamic.
        // For Phase 6 fixed scope, we assume consistency.

    } catch (error: any) {
        console.error(`❌ GUARD BLOCK: Decision invalid. Skipping execution.`, error.message);
        return; // Do NOT execute. Do NOT mark executed. Leav INGESTED (or mark FAILED if we had that state).
    }

    // 4. EXECUTE
    try {
        console.log(`🚀 Executing WITHDRAW: ${decision.amount} SHARES`);

        // Critical: amount is treated as BigInt SHARES
        const txHash = await executor.withdraw(BigInt(decision.amount!));

        console.log(`✅ Execution Successful! Hash: ${txHash}`);

        // 5. UPDATE STATE
        updateDecision(decision.nonce, txHash);

    } catch (error: any) {
        console.error(`⚠️  Execution Failed (Logic Revert or Network Error).`);
        console.error(`   Reason: ${error.message}`);
        console.error(`   State remains INGESTED. No changes persisted.`);
    }
}

run();
