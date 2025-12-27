
import { ethers } from "ethers";

// --------------------------------------------------
// CONFIG
// --------------------------------------------------
// In a real server, this private key is secret.
// For testing, we use a random one or a fixed test one.
// Let's use a fixed one so the Agent can verify it consistently.
const FACILITATOR_PRIVATE_KEY = "0x0123456789012345678901234567890123456789012345678901234567890123";

async function generate() {
    const wallet = new ethers.Wallet(FACILITATOR_PRIVATE_KEY);
    console.log(`🔑 Facilitator Address: ${wallet.address}`);

    // The Payload
    const agentAddress = "0xb0F8b79a06662D6c165Bf67B4A7DE963aaf9ec50"; // The 'Whale' we are mimicking
    const vaultAddress = "0xA6fF77fC8E839679D4F7408E8988B564dE1A2dcD";
    const chainId = 25; // Cronos Mainnet
    const decision = "APPROVE";
    const action = "WITHDRAW"; // Proposed future action
    const amount = "1000000000000000000"; // 1 VVS (example)
    const scope = "YIELD_ONLY";
    const nonce = `test-${Date.now()}`;
    const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

    // Canonical Hash Construction (Must match verifyYieldDecision.ts EXACTLY)
    const hash = ethers.solidityPackedKeccak256(
        [
            "address",
            "address",
            "uint256",
            "string",
            "string",
            "string",
            "string",
            "string",
            "uint256"
        ],
        [
            agentAddress,
            vaultAddress,
            chainId,
            decision,
            action,
            amount,
            scope,
            nonce,
            expiresAt
        ]
    );

    // Sign
    const signature = await wallet.signMessage(ethers.getBytes(hash));

    const payload = {
        agentAddress,
        vaultAddress,
        chainId,
        decision,
        action,
        amount,
        scope,
        reason: "Test Ingestion",
        nonce,
        issuedAt: Math.floor(Date.now() / 1000),
        expiresAt,
        signature
    };

    const fs = require("fs");
    fs.writeFileSync("decision.json", JSON.stringify(payload, null, 2));
    console.log("✅ Saved to decision.json");
}

generate();
