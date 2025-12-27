
import { ethers } from "ethers";
import { verifyYieldDecision } from "./internal/yield/verifyYieldDecision";
import { YieldDecision } from "./internal/yield/YieldDecision";

// --------------------------------------------------
// CONFIG
// --------------------------------------------------
const FACILITATOR_PRIVATE_KEY = "0x0123456789012345678901234567890123456789012345678901234567890123";
const ATTACKER_PRIVATE_KEY = "0x9999999999999999999999999999999999999999999999999999999999999999";

const wallet = new ethers.Wallet(FACILITATOR_PRIVATE_KEY);
const attacker = new ethers.Wallet(ATTACKER_PRIVATE_KEY);
const FACILITATOR_ADDR = wallet.address;

console.log("--------------------------------------------------");
console.log("🛡️  SECURITY TEST SUITE: Decision Verification");
console.log("--------------------------------------------------");

async function createDecision(
    overrides: Partial<YieldDecision>,
    signer: ethers.Wallet = wallet
): Promise<YieldDecision> {

    const defaults: YieldDecision = {
        agentAddress: "0x1234567890123456789012345678901234567890", // Valid 40-char hex
        vaultAddress: "0xABCDEF0123456789ABCDEF0123456789ABCDEF01", // Valid 40-char hex
        chainId: 25,
        decision: "APPROVE",
        action: "WITHDRAW",
        amount: "100",
        scope: "YIELD_ONLY",
        reason: "Test",
        nonce: `test-${Date.now()}-${Math.random()}`,
        issuedAt: Math.floor(Date.now() / 1000),
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        signature: "0x"
    };

    const d = { ...defaults, ...overrides };

    // Canonical Hash
    const hash = ethers.solidityPackedKeccak256(
        [
            "address", "address", "uint256", "string", "string", "string", "string", "string", "uint256"
        ],
        [
            d.agentAddress, d.vaultAddress, d.chainId, d.decision, d.action || "", d.amount || "0",
            d.scope, d.nonce, d.expiresAt
        ]
    );

    d.signature = await signer.signMessage(ethers.getBytes(hash));
    return d;
}

async function runTests() {
    // --------------------------------------------------
    // TEST 1: Happy Path
    // --------------------------------------------------
    try {
        const valid = await createDecision({});
        verifyYieldDecision(valid, FACILITATOR_ADDR);
        console.log("✅ Test 1 Passed: Valid decision accepted.");
    } catch (e: any) {
        console.error("❌ Test 1 Failed: Valid decision rejected.", e.message);
    }

    // --------------------------------------------------
    // TEST 2: Expired Decision
    // --------------------------------------------------
    try {
        const expired = await createDecision({
            expiresAt: Math.floor(Date.now() / 1000) - 10
        });
        verifyYieldDecision(expired, FACILITATOR_ADDR);
        console.error("❌ Test 2 Failed: Expired decision accepted!");
    } catch (e: any) {
        if (e.message.includes("Decision expired")) {
            console.log("✅ Test 2 Passed: Expired decision rejected.");
        } else {
            console.error("❌ Test 2 Failed: Wrong error message.", e.message);
        }
    }

    // --------------------------------------------------
    // TEST 3: Invalid Scope
    // --------------------------------------------------
    try {
        // Force cast because TS prevents typing it, but we want to test runtime check
        const wrongScope = await createDecision({ scope: "GAS_ONLY" } as any);
        verifyYieldDecision(wrongScope, FACILITATOR_ADDR);
        console.error("❌ Test 3 Failed: Wrong scope accepted!");
    } catch (e: any) {
        if (e.message.includes("Invalid scope")) {
            console.log("✅ Test 3 Passed: Wrong scope rejected.");
        } else {
            console.error("❌ Test 3 Failed: Wrong error message.", e.message);
        }
    }

    // --------------------------------------------------
    // TEST 4: Tampered Payload
    // --------------------------------------------------
    try {
        const tampered = await createDecision({ amount: "100" });
        tampered.amount = "999999"; // Attack! Change amount after signing
        verifyYieldDecision(tampered, FACILITATOR_ADDR);
        console.error("❌ Test 4 Failed: Tampered decision accepted!");
    } catch (e: any) {
        if (e.message.includes("Invalid facilitator signature")) {
            console.log("✅ Test 4 Passed: Tampered decision rejected (Signature Mismatch).");
        } else {
            console.error("❌ Test 4 Failed: Wrong error message.", e.message);
        }
    }

    // --------------------------------------------------
    // TEST 5: Wrong Signer (Attacker)
    // --------------------------------------------------
    try {
        const attack = await createDecision({}, attacker);
        verifyYieldDecision(attack, FACILITATOR_ADDR);
        console.error("❌ Test 5 Failed: Attacker signature accepted!");
    } catch (e: any) {
        if (e.message.includes("Invalid facilitator signature")) {
            console.log("✅ Test 5 Passed: Attacker signature rejected.");
        } else {
            console.error("❌ Test 5 Failed: Wrong error message.", e.message);
        }
    }
}

runTests();
