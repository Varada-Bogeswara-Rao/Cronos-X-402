export type YieldDecision = {
    agentAddress: string;
    vaultAddress: string;
    chainId: number;

    decision: "APPROVE" | "DENY" | "HOLD";
    action?: "WITHDRAW"; // future-proof
    amount?: string;     // bigint as string

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
