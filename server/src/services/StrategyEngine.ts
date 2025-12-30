import { ethers } from "ethers";
import { YieldSource, IYieldSource } from "../models/YieldSource";
import { v4 as uuidv4 } from "uuid";
import { YieldDecision } from "../models/YieldDecision";

interface StrategyConfig {
    minApy: number;          // e.g. 0.05 (5%)
    minConfidence: number;   // 0.0 - 1.0
    maxInactivityMs: number; // e.g. 6 hours
    agentAddress: string;
    privateKey?: string;     // Facilitator Private Key
}

export class StrategyEngine {
    private config: StrategyConfig;
    private wallet: ethers.Wallet;

    constructor(config?: Partial<StrategyConfig>) {
        this.config = {
            minApy: 0.1, // 0.1% Conservative Minimum
            minConfidence: 0.8,
            maxInactivityMs: 6 * 60 * 60 * 1000,
            agentAddress: "0x0000000000000000000000000000000000000000",
            privateKey: process.env.FACILITATOR_PRIVATE_KEY, // Load from Env
            ...config
        };

        // Initialize Facilitator Wallet
        if (this.config.privateKey) {
            this.wallet = new ethers.Wallet(this.config.privateKey);
        } else {
            // 🟡 Production Safeguard: Fail hard if no key in production
            if (process.env.NODE_ENV === "production") {
                throw new Error("❌ [StrategyEngine] CRITICAL: FACILITATOR_PRIVATE_KEY missing in production!");
            }
            console.warn("⚠️ [StrategyEngine] No Private Key provided. Generating RANDOM key for dev.");
            // Cast to Wallet to satisfy TS (behaves like Wallet for signing)
            this.wallet = ethers.Wallet.createRandom() as unknown as ethers.Wallet;
        }
        console.log(`🧠 [StrategyEngine] Facilitator Authority: ${this.wallet.address}`);
    }

    /**
     * EVALUATE ALL SOURCES
     * Returns a decision for the specific requested source.
     */
    async evaluate(sourceId: string, agentAddr: string): Promise<YieldDecision> {
        const source = await YieldSource.findOne({ id: sourceId });
        const allSources = await YieldSource.find({});

        if (!source) {
            return this.createDecision(agentAddr, "UNKNOWN", 0, "DENY", "Source not found");
        }

        const confidence = this.calculateConfidence(source, allSources);
        const apy = this.parseApy(source.estimatedAPY);

        // --- RULES ENGINE ---

        // 1. Safety Check: Stale Data
        const timeDiff = Date.now() - (source.updatedAt * 1000); // updatedAt is unix seconds
        if (timeDiff > this.config.maxInactivityMs) {
            return this.createDecision(agentAddr, source.vaultAddress, source.chainId, "DENY", `Stale Data: ${Math.floor(timeDiff / 3600000)}h old`);
        }

        // 2. Safety Check: Inactive
        if (source.status !== "ACTIVE") {
            return this.createDecision(agentAddr, source.vaultAddress, source.chainId, "DENY", "Source reported INACTIVE");
        }

        // 3. Confidence Check
        if (confidence < this.config.minConfidence) {
            return this.createDecision(agentAddr, source.vaultAddress, source.chainId, "HOLD", `Low Confidence Score: ${confidence.toFixed(2)}`);
        }

        // 4. Profitability Check
        if (isNaN(apy)) {
            return this.createDecision(agentAddr, source.vaultAddress, source.chainId, "DENY", "Invalid APY Data");
        }
        if (apy < this.config.minApy) {
            return this.createDecision(agentAddr, source.vaultAddress, source.chainId, "HOLD", `APY ${apy.toFixed(2)}% below threshold ${this.config.minApy}%`);
        }

        // 5. APPROVE
        return this.createDecision(agentAddr, source.vaultAddress, source.chainId, "APPROVE", `Good APY (${apy.toFixed(2)}%) & Confidence (${confidence.toFixed(2)})`);
    }

    /**
     * CONFIDENCE SCORE (0.0 - 1.0)
     * Factors:
     * - Age: <5min = 1.0, <1hr = 0.8, >1hr = 0.5
     * - Consensus: If other sources are also ACTIVE, boost confidence (Network Health)
     */
    private calculateConfidence(target: IYieldSource, all: IYieldSource[]): number {
        let score = 0.0;
        const now = Date.now();
        const lastUpdate = target.updatedAt * 1000;
        const ageMs = now - lastUpdate;

        // 1. Freshness Score
        if (ageMs < 5 * 60 * 1000) score = 1.0;
        else if (ageMs < 60 * 60 * 1000) score = 0.8;
        else score = 0.5;

        // 2. Consensus / Network Health
        // Exclude self from consensus check
        const others = all.filter(s => s.id !== target.id);
        const activeCount = others.filter(s => s.status === "ACTIVE").length;
        const totalCount = others.length;

        if (totalCount > 0) {
            const healthRatio = activeCount / totalCount;
            // Weighted average: 70% Freshness, 30% Consensus
            score = (score * 0.7) + (healthRatio * 0.3);
        }

        return score;
    }

    private parseApy(apyStr: string | undefined): number {
        if (!apyStr) return NaN;
        const val = parseFloat(apyStr.replace("%", ""));
        return isFinite(val) ? val : NaN;
    }

    private async createDecision(
        agent: string,
        vault: string,
        chain: number,
        type: "APPROVE" | "DENY" | "HOLD",
        reason: string
    ): Promise<YieldDecision> {
        const now = Date.now();

        // 1. Construct Full Payload (Includes metadata like Reason)
        const fullPayload = {
            agentAddress: agent,
            vaultAddress: vault,
            chainId: chain,
            decision: type,
            scope: "YIELD_ONLY",
            reason: reason,
            nonce: uuidv4(),
            issuedAt: now,
            expiresAt: now + (15 * 60 * 1000), // 15 min Valid
        };

        // 2. Construct Signing Payload (EXCLUDES Reason)
        // 🔴 CRITICAL: reason is NOT signed (metadata only)
        const signingPayload = {
            agentAddress: agent,
            vaultAddress: vault,
            chainId: chain,
            decision: type,
            scope: "YIELD_ONLY",
            nonce: fullPayload.nonce,
            issuedAt: now,
            expiresAt: fullPayload.expiresAt
        };

        // 3. EIP-712 Signing
        const domain = {
            name: "Cronos Merchant Facilitator",
            version: "1",
            chainId: 25 // Cronos Mainnet
        };

        const types = {
            YieldDecision: [
                { name: "agentAddress", type: "address" },
                { name: "vaultAddress", type: "address" },
                { name: "chainId", type: "uint256" },
                { name: "decision", type: "string" },
                { name: "scope", type: "string" },
                // 🔴 Reason REMOVED from signature type definition
                { name: "nonce", type: "string" },
                { name: "issuedAt", type: "uint256" },
                { name: "expiresAt", type: "uint256" }
            ]
        };

        // Sign ONLY the critical fields
        const signature = await this.wallet.signTypedData(domain, types, signingPayload);

        return {
            ...fullPayload,
            scope: "YIELD_ONLY",
            signature
        };
    }
}
