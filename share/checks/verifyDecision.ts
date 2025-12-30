
import { ethers } from "ethers";
import { YieldDecision } from "../../server/src/models/YieldDecision";

/**
 * VERIFY FACILITATOR DECISION (Agent-Side)
 * 
 * @param decision The full signed decision object
 * @param facilitatorAddress The expected public key of the Facilitator
 * @param myAddress The Agent's own address (to prevent replay on other agents)
 * @returns true if valid, throws error if invalid
 */
export function verifyDecision(
    decision: YieldDecision,
    facilitatorAddress: string,
    myAddress: string
): boolean {
    // 1. Check Expiration first (Cheap)
    if (Date.now() > decision.expiresAt) {
        throw new Error(`❌ Decision Expired! (Expired at ${new Date(decision.expiresAt).toISOString()})`);
    }

    // 2. Check Agent Match (Prevent replay)
    if (decision.agentAddress.toLowerCase() !== myAddress.toLowerCase()) {
        throw new Error(`❌ Decision meant for another agent! (${decision.agentAddress})`);
    }

    // 🟡 3. Strict Scope Check (Production Requirement)
    if (decision.scope !== "YIELD_ONLY") {
        throw new Error(`❌ Invalid Scope! Expected YIELD_ONLY, got ${decision.scope}`);
    }

    // 4. EIP-712 Verification
    const domain = {
        name: "Cronos Merchant Facilitator",
        version: "1",
        chainId: 25
    };

    // 🟡 4b. Explicit ChainID Check (though domain check handles it, explicit is better)
    if (decision.chainId !== domain.chainId) {
        throw new Error(`❌ Chain Mismatch! Decision for chain ${decision.chainId}, expected ${domain.chainId}`);
    }

    // 🔴 5. Reconstruct Payload (EXCLUDING REASON)
    // Must match StrategyEngine exactly
    const signingPayload = {
        agentAddress: decision.agentAddress,
        vaultAddress: decision.vaultAddress,
        chainId: decision.chainId,
        decision: decision.decision,
        scope: decision.scope,
        // reason excluded
        nonce: decision.nonce,
        issuedAt: decision.issuedAt,
        expiresAt: decision.expiresAt
    };

    const types = {
        YieldDecision: [
            { name: "agentAddress", type: "address" },
            { name: "vaultAddress", type: "address" },
            { name: "chainId", type: "uint256" },
            { name: "decision", type: "string" },
            { name: "scope", type: "string" },
            // reason excluded
            { name: "nonce", type: "string" },
            { name: "issuedAt", type: "uint256" },
            { name: "expiresAt", type: "uint256" }
        ]
    };

    // Verify Typed Data
    const recovered = ethers.verifyTypedData(domain, types, signingPayload, decision.signature);

    if (recovered.toLowerCase() !== facilitatorAddress.toLowerCase()) {
        throw new Error(`❌ Invalid Signature! Signed by ${recovered}, expected ${facilitatorAddress}`);
    }

    return true;
}
