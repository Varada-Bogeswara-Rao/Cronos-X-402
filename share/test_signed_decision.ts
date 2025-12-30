
import { StrategyEngine } from "../server/src/services/StrategyEngine";
import { verifyDecision } from "./checks/verifyDecision";
import { YieldSource } from "../server/src/models/YieldSource";
import { ethers } from "ethers";

async function main() {
    console.log("=========================================");
    console.log("🔐 Signed Decision Trust Test");
    console.log("=========================================");

    // 1. Setup Engine (Generates Random Key)
    const engine = new StrategyEngine({ minApy: 0.1 });

    // Hack to get the wallet address (since it's private)
    // In production, this would be config.FACILITATOR_ADDRESS
    const facilitatorAddress = (engine as any).wallet.address;
    console.log(`> Facilitator: ${facilitatorAddress}`);

    // Mock DB
    (YieldSource as any).findOne = async () => ({
        id: "TEST_SOURCE",
        vaultAddress: ethers.Wallet.createRandom().address, // VALID address
        chainId: 25,
        status: "ACTIVE",
        estimatedAPY: "0.15%",
        updatedAt: Math.floor(Date.now() / 1000)
    });
    (YieldSource as any).find = async () => [];

    // 2. Generate Decision
    console.log("\n📝 Generating Signed Decision...");
    const agent = ethers.Wallet.createRandom().address; // Use VALID address
    const decision = await engine.evaluate("TEST_SOURCE", agent);

    console.log(`> Signature: ${decision.signature.substring(0, 30)}...`);

    // 3. Verify Valid Decision
    console.log("\n🕵️ Verifying Valid Decision...");
    try {
        verifyDecision(decision, facilitatorAddress, agent);
        console.log("✅ verification PASSED");
    } catch (e: any) {
        console.error("❌ Valid check FAILED:", e.message);
    }

    // 4. Attack: Tamper with Logic (Man-in-the-Middle)
    console.log("\n🦹 Attack: Tampering with Payload...");
    const fakeDecision = { ...decision, decision: "APPROVE" as any }; // If it was DENY/HOLD
    // Or changing amount/reason
    fakeDecision.reason = "I hacked this";

    try {
        verifyDecision(fakeDecision, facilitatorAddress, agent);
        console.error("❌ Tamper check FAILED (Should have thrown)");
    } catch (e: any) {
        console.log("✅ Tamper check PASSED (Caught attack):", e.message);
    }

    // 5. Attack: Replay to wrong Agent
    console.log("\n🦹 Attack: Replay to wrong Agent...");
    try {
        verifyDecision(decision, facilitatorAddress, "0xEvilAgent");
        console.error("❌ Replay check FAILED (Should have thrown)");
    } catch (e: any) {
        console.log("✅ Replay check PASSED (Caught attack):", e.message);
    }

    // 6. Attack: Expired Decision
    console.log("\n🦹 Attack: Expired Decision...");
    const expiredDecision = { ...decision, expiresAt: Date.now() - 1000 };
    // Re-sign it? No, attacker can't re-sign. 
    // If they just change the date, signature is invalid.
    // If they submit an OLD valid decision, verify checks date.

    try {
        verifyDecision(expiredDecision, facilitatorAddress, agent);
        console.error("❌ Expiry check FAILED");
    } catch (e: any) {
        console.log("✅ Expiry check PASSED:", e.message);
    }
}

main();
