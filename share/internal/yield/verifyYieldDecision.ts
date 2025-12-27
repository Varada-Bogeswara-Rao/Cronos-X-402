import { ethers } from "ethers";
import { YieldDecision } from "./YieldDecision";

export function verifyYieldDecision(
    decision: YieldDecision,
    facilitatorAddress: string
): void {
    const now = Math.floor(Date.now() / 1000);

    // 1. Expiry Check
    if (now > decision.expiresAt) {
        throw new Error(`Decision expired. Now: ${now}, Expires: ${decision.expiresAt}`);
    }

    // 2. Scope Check (Anti-Replay)
    if (decision.scope !== "YIELD_ONLY") {
        throw new Error(`Invalid scope: ${decision.scope}`);
    }

    // 3. Construct Canonical Hash (Must match Facilitator exactly)
    const hash = ethers.solidityPackedKeccak256(
        [
            "address", // agentAddress
            "address", // vaultAddress
            "uint256", // chainId
            "string",  // decision
            "string",  // action
            "string",  // amount
            "string",  // scope
            "string",  // nonce
            "uint256"  // expiresAt
        ],
        [
            decision.agentAddress,
            decision.vaultAddress,
            decision.chainId,
            decision.decision,
            decision.action ?? "", // handle optional
            decision.amount ?? "0", // handle optional
            decision.scope,
            decision.nonce,
            decision.expiresAt
        ]
    );

    // 4. Recover Signer
    // ethers.verifyMessage handles the "Ethereum Signed Message" prefix automatically
    const recovered = ethers.verifyMessage(
        ethers.getBytes(hash), // treat as raw bytes
        decision.signature
    );

    // 5. Authorize
    if (
        recovered.toLowerCase() !== facilitatorAddress.toLowerCase()
    ) {
        throw new Error(`Invalid facilitator signature. Recovered: ${recovered}, Expected: ${facilitatorAddress}`);
    }
}
