// types.ts
export interface PaymentRequest {
    amount: number;
    currency: string;
    payTo: string;
    merchantId: string;
    facilitatorUrl: string;

    // [NEW] Replay protection & Security
    chainId: number;
    route: string;
    nonce: string;
}

export interface WalletContext {
    chainId: number; // Changed from string network to number
    merchantId?: string; // [FIX] Required for multi-tenancy in x402 headers
    pendingYield?: number;
}

export interface AgentWalletConfig {
    dailyLimit?: number;
    trustedFacilitators?: string[];
    allowedMerchants?: string[];
}
