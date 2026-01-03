export type YieldDecision = {
    agentAddress: string;
    vaultAddress: string;
    chainId: number;

    decision: "APPROVE" | "DENY" | "HOLD" | "PARTIAL_WITHDRAW" | "EMERGENCY_EXIT" | "FORCE_GAS_REFILL";
    amount?: string;     // bigint as string
    minAmountOut?: string; // bigint as string (Slippage protection)

    scope: "YIELD_ONLY"; // Domain separation

    reason: string;

    nonce: string;
    issuedAt: number;
    expiresAt: number;

    signature: string; // facilitator signature
};

export type StoredDecision = YieldDecision & {
    status: "INGESTED" | "EXECUTED";
    ingestedAt: number;
    executedAt?: number;
    txHash?: string;
};
