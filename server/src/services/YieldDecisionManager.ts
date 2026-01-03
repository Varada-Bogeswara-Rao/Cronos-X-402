import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import { YieldDecision } from "../models/YieldDecision";
import { ProfitMetric } from "./ProfitEngine";

export class YieldDecisionManager {
    private signer: ethers.Wallet;
    private facilitatorAddress: string;

    constructor(privateKey: string) {
        this.signer = new ethers.Wallet(privateKey);
        this.facilitatorAddress = this.signer.address;
    }

    /**
     * Factory: Converts Analysis -> Unsigned Decision
     */
    buildDecision(
        metric: ProfitMetric,
        agentAddress: string
    ): Partial<YieldDecision> {
        const now = Math.floor(Date.now() / 1000);

        // Map Recommendation -> Decision Type
        // Note: APPROVE -> APPROVE
        // WITHDRAW -> PARTIAL_WITHDRAW ? (Assume Partial unless Emergency)

        let decisionType = metric.recommendation;
        let amount = metric.amount || "0";
        let minAmountOut = "0";

        // Logic Mapping
        if (decisionType === "WITHDRAW") {
            // "WITHDRAW" recommendation usually maps to "PARTIAL_WITHDRAW"
            // unless we want to exit fully.
            // For now, assume ProfitEngine returns "WITHDRAW" for profit taking.
            decisionType = "PARTIAL_WITHDRAW" as any;
            if (amount === "0") {
                // Fallback if ProfitEngine didn't specify? 
                // We should probably THROW or default safe.
                // Ideally ProfitEngine provides it.
                console.warn("[YieldDecisionManager] WITHDRAW recommendation missing amount. Defaulting to 0 (No-Op).");
            }
        }
        else if (decisionType === "EMERGENCY_EXIT") {
            amount = "0"; // Ignored by Executor
        }
        else if (decisionType === "FORCE_GAS_REFILL") {
            // Check for slippage
            // Phase E MVP: 0 minAmountOut (Simulated)
            // But we created the field, so we populate it.
            minAmountOut = "0";
        }

        return {
            agentAddress: agentAddress,
            // Mock Tectonic Address for now - MUST be valid hex for signing
            vaultAddress: "0x1234567890123456789012345678901234567890",
            chainId: 25,
            decision: decisionType as any,
            amount: amount,
            minAmountOut: minAmountOut,
            scope: "YIELD_ONLY",
            nonce: uuidv4(),
            issuedAt: now,
            expiresAt: now + (15 * 60) // 15 Minutes
        };
    }

    /**
     * Hash: Deterministic ID for Idempotency
     * Uses SHA256 of the critical fields.
     */
    hashDecision(decision: Partial<YieldDecision>): string {
        // We hash the SAME fields we sign, to ensure 1:1 mapping
        const payload = JSON.stringify({
            agent: decision.agentAddress,
            vault: decision.vaultAddress,
            chain: decision.chainId,
            dec: decision.decision,
            amt: decision.amount,
            min: decision.minAmountOut,
            scope: decision.scope,
            nonce: decision.nonce, // Nonce makes it unique per issuance
            iss: decision.issuedAt,
            exp: decision.expiresAt
        });
        return ethers.keccak256(ethers.toUtf8Bytes(payload));
    }

    /**
     * Sign: EIP-712 Signature
     */
    async signDecision(decision: Partial<YieldDecision>): Promise<YieldDecision> {
        const domain = {
            name: "Cronos Merchant Facilitator",
            version: "1",
            chainId: 25
        };

        const types = {
            YieldDecision: [
                { name: "agentAddress", type: "address" },
                { name: "vaultAddress", type: "address" },
                { name: "chainId", type: "uint256" },
                { name: "decision", type: "string" },
                { name: "amount", type: "string" },
                { name: "minAmountOut", type: "string" },
                { name: "scope", type: "string" },
                // NO REASON
                { name: "nonce", type: "string" },
                { name: "issuedAt", type: "uint256" },
                { name: "expiresAt", type: "uint256" }
            ]
        };

        const value = {
            agentAddress: decision.agentAddress,
            vaultAddress: decision.vaultAddress,
            chainId: decision.chainId,
            decision: decision.decision,
            amount: decision.amount || "0",
            minAmountOut: decision.minAmountOut || "0",
            scope: decision.scope,
            nonce: decision.nonce,
            issuedAt: decision.issuedAt,
            expiresAt: decision.expiresAt
        };

        const signature = await this.signer.signTypedData(domain, types, value);

        return {
            ...decision,
            signature,
            reason: "Automated via YieldDecisionManager"
        } as YieldDecision;
    }
}
