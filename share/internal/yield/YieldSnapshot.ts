export type YieldSnapshot = {
    agentAddress: string;
    vaultAddress: string;

    shares: bigint;
    underlyingValue: bigint;

    timestamp: number; // unix seconds
};
